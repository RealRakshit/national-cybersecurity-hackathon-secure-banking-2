const crypto = require('crypto');
const net = require('net');
const Challenge = require('./models/Challenge');
const Session = require('./models/Session');

const SESSION_COOKIE = 'bank_session';
const SESSION_IDLE_MS = 60 * 1000;
const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const SHAPE_TTL_MS = 3 * 60 * 1000;
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const authFailures = new Map();

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const secureCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const parseCookies = (req) => String(req.headers.cookie || '')
  .split(';')
  .map((cookie) => cookie.trim())
  .filter(Boolean)
  .reduce((cookies, cookie) => {
    const separator = cookie.indexOf('=');
    if (separator === -1) return cookies;
    cookies[cookie.slice(0, separator)] = decodeURIComponent(cookie.slice(separator + 1));
    return cookies;
  }, {});

const normalizeIp = (value) => String(value || '').replace(/^::ffff:/, '').trim();
const isValidForwardedChain = (value) => String(value || '')
  .split(',')
  .map(normalizeIp)
  .filter(Boolean)
  .every((ip) => net.isIP(ip));

const hasSpoofedIpHeaders = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (!TRUST_PROXY) return Boolean(forwardedFor || forwardedHost || forwardedProto);
  return Boolean(forwardedFor && !isValidForwardedChain(forwardedFor));
};

const getRequestIp = (req) => normalizeIp(req.ip || req.socket.remoteAddress || 'unknown');
const cookieOptions = () => [
  `${SESSION_COOKIE}=`,
  'HttpOnly',
  'Path=/',
  'SameSite=Strict',
  'Max-Age=0',
  process.env.NODE_ENV === 'production' ? 'Secure' : '',
].filter(Boolean).join('; ');

const clearSessionCookie = (res) => res.setHeader('Set-Cookie', cookieOptions());
const setSessionCookie = (res, token) => res.setHeader('Set-Cookie', [
  `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
  'HttpOnly',
  'Path=/',
  'SameSite=Strict',
  process.env.NODE_ENV === 'production' ? 'Secure' : '',
].filter(Boolean).join('; '));

const rejectSpoofedIpHeaders = (req, res, next) => {
  if (hasSpoofedIpHeaders(req)) {
    return res.status(400).json({ message: 'Untrusted or malformed forwarding headers were rejected.' });
  }
  return next();
};

const addSecurityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self)');
  return next();
};

const throttleAuthByIp = (req, res, next) => {
  const ipAddress = getRequestIp(req);
  const record = authFailures.get(ipAddress);
  if (record?.blockedUntil > Date.now()) {
    return res.status(429).json({ message: 'Too many authentication failures. Try again later.' });
  }
  return next();
};

const recordAuthFailure = (req) => {
  const ipAddress = getRequestIp(req);
  const current = authFailures.get(ipAddress);
  const recent = current && current.windowStartedAt > Date.now() - (15 * 60 * 1000)
    ? current
    : { count: 0, windowStartedAt: Date.now(), blockedUntil: 0 };
  recent.count += 1;
  if (recent.count >= 8) recent.blockedUntil = Date.now() + (15 * 60 * 1000);
  authFailures.set(ipAddress, recent);
};

const clearAuthFailures = (req) => authFailures.delete(getRequestIp(req));
const createSession = async (user, req, res) => {
  const token = crypto.randomBytes(32).toString('base64url');
  await Session.create({
    user: user._id,
    tokenHash: hash(token),
    ipAddress: getRequestIp(req),
    userAgent: String(req.headers['user-agent'] || 'unknown').slice(0, 240),
    expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS),
  });
  setSessionCookie(res, token);
};

const requireSession = async (req, res, next) => {
  try {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return res.status(401).json({ message: 'Login required.' });

    const session = await Session.findOne({ tokenHash: hash(token) }).populate('user');
    const idleExpired = session && session.lastSeenAt.getTime() < Date.now() - SESSION_IDLE_MS;
    const absoluteExpired = session && session.expiresAt.getTime() < Date.now();
    const ipChanged = session && session.ipAddress !== getRequestIp(req);
    const userAgentChanged = session
      && session.userAgent !== String(req.headers['user-agent'] || 'unknown').slice(0, 240);

    if (!session || !session.user || idleExpired || absoluteExpired || ipChanged || userAgentChanged) {
      if (session) await Session.deleteOne({ _id: session._id });
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Session expired or requires a fresh login.' });
    }

    session.lastSeenAt = new Date();
    await session.save();
    req.sessionRecord = session;
    req.user = session.user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const createCaptcha = async () => {
  const left = crypto.randomInt(2, 10);
  const right = crypto.randomInt(2, 10);
  const answerSalt = crypto.randomBytes(12).toString('hex');
  const challenge = await Challenge.create({
    type: 'captcha',
    prompt: `What is ${left} + ${right}?`,
    answerSalt,
    answerHash: hash(`${answerSalt}:${left + right}`),
    expiresAt: new Date(Date.now() + CAPTCHA_TTL_MS),
  });
  return { challengeId: challenge._id, prompt: challenge.prompt };
};

const verifyCaptcha = async (challengeId, answer) => {
  if (!challengeId || !/^[0-9]{1,3}$/.test(String(answer || '').trim())) return false;
  const challenge = await Challenge.findOne({
    _id: challengeId,
    type: 'captcha',
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) return false;
  challenge.usedAt = new Date();
  await challenge.save();
  return secureCompare(challenge.answerHash, hash(`${challenge.answerSalt}:${String(answer).trim()}`));
};

const createShapeChallenge = async (user) => {
  const shape = crypto.randomInt(0, 2) ? 'circle' : 'zigzag';
  const prompt = shape === 'circle'
    ? 'Draw one closed circle in the pad.'
    : 'Draw a wide zigzag from left to right in the pad.';
  const challenge = await Challenge.create({
    type: 'shape',
    user: user._id,
    shape,
    prompt,
    expiresAt: new Date(Date.now() + SHAPE_TTL_MS),
  });
  return { challengeId: challenge._id, prompt, shape };
};

const span = (values) => Math.max(...values) - Math.min(...values);
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const validTracePoint = (point) => Number.isFinite(point?.x)
  && Number.isFinite(point?.y)
  && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;

const looksLikeCircle = (points) => {
  const width = span(points.map((point) => point.x));
  const height = span(points.map((point) => point.y));
  return points.length >= 24
    && width > 0.35
    && height > 0.35
    && width / height > 0.55
    && width / height < 1.45
    && distance(points[0], points[points.length - 1]) < 0.28;
};

const looksLikeZigzag = (points) => {
  const width = span(points.map((point) => point.x));
  const height = span(points.map((point) => point.y));
  let directionChanges = 0;
  let previousDirection = 0;

  points.slice(1).forEach((point, index) => {
    const delta = point.y - points[index].y;
    const direction = Math.abs(delta) < 0.025 ? previousDirection : Math.sign(delta);
    if (previousDirection && direction && direction !== previousDirection) directionChanges += 1;
    previousDirection = direction;
  });

  return points.length >= 12 && width > 0.5 && height > 0.25 && directionChanges >= 2;
};

const verifyShapeChallenge = async (user, challengeId, trace) => {
  if (!challengeId || !Array.isArray(trace) || trace.length > 320 || !trace.every(validTracePoint)) {
    return false;
  }
  const challenge = await Challenge.findOne({
    _id: challengeId,
    type: 'shape',
    user: user._id,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) return false;

  challenge.usedAt = new Date();
  await challenge.save();
  return challenge.shape === 'circle' ? looksLikeCircle(trace) : looksLikeZigzag(trace);
};

module.exports = {
  SESSION_IDLE_MS,
  clearAuthFailures,
  clearSessionCookie,
  createCaptcha,
  createSession,
  createShapeChallenge,
  getRequestIp,
  recordAuthFailure,
  rejectSpoofedIpHeaders,
  requireSession,
  addSecurityHeaders,
  throttleAuthByIp,
  verifyCaptcha,
  verifyShapeChallenge,
  TRUST_PROXY,
};
