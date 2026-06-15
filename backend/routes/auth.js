const express = require('express');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Session = require('../models/Session');
const {
  clearAuthFailures,
  clearSessionCookie,
  createCaptcha,
  createSession,
  getRequestIp,
  recordAuthFailure,
  requireSession,
  throttleAuthByIp,
  verifyCaptcha,
} = require('../security');
const {
  TYPING_PROFILE_LIMIT,
  cleanTypingProfile,
  evaluateTypingBehavior,
} = require('../typingBehavior');

const router = express.Router();
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const pendingEmailOtps = new Map();

const computeDistance = (desc1, desc2) => {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
  return Math.sqrt(desc1.reduce((sum, value, index) => {
    const diff = value - desc2[index];
    return sum + diff * diff;
  }, 0));
};

const validPassword = (password) => typeof password === 'string'
  && password.length >= 12
  && password.length <= 72
  && /[A-Za-z]/.test(password)
  && /[0-9]/.test(password);
const cleanUsername = (username) => String(username || '').trim();
const cleanEmail = (email) => String(email || '').trim().toLowerCase();
const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const isValidOtp = (otp) => typeof otp === 'string' && /^\d{6}$/.test(otp.trim());
const cleanFaceDescriptors = (faceDescriptors) => {
  if (
    !Array.isArray(faceDescriptors)
    || faceDescriptors.length < 3
  ) {
    return null;
  }

  const cleanedDescriptors = faceDescriptors.map((descriptor) => {
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return null;
    }

    const cleaned = descriptor.map(Number);

    return cleaned.every(
      (value) => Number.isFinite(value) && Math.abs(value) <= 2,
    )
      ? cleaned
      : null;
  });

  return cleanedDescriptors.every(Boolean)
    ? cleanedDescriptors
    : null;
};
const cleanFaceDescriptor = (faceDescriptor) => {
  if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
    return null;
  }

  const cleaned = faceDescriptor.map(Number);

  return cleaned.every(
    (value) => Number.isFinite(value) && Math.abs(value) <= 2,
  )
    ? cleaned
    : null;
};
const storePendingEmailOtp = async (email, otp) => {
  pendingEmailOtps.set(email, {
    otpHash: await bcrypt.hash(otp, 4),
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
};
const verifyPendingEmailOtp = async (email, otp) => {
  const record = pendingEmailOtps.get(email);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    pendingEmailOtps.delete(email);
    return false;
  }
  const match = await bcrypt.compare(String(otp), record.otpHash);
  if (match) pendingEmailOtps.delete(email);
  return match;
};
const sendEmailOtp = async (email, otp) => {
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;
  const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.log(`[EMAIL-OTP] ${otp} for ${email}`);
    return { sent: false, fallback: true };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: 'Your signup verification code',
    text: `Your verification code is ${otp}. It expires in 5 minutes.`,
  });

  return { sent: true, fallback: false, messageId: info.messageId };
};

router.get('/captcha', async (req, res) => {
  try {
    return res.json(await createCaptcha());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Unable to create CAPTCHA challenge.' });
  }
});

router.post('/send-otp', throttleAuthByIp, async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const otp = generateOtp();
    await storePendingEmailOtp(email, otp);
    const result = await sendEmailOtp(email, otp);
    if (result.fallback) {
      return res.json({ message: `Verification code sent. For local testing, use: ${otp}` });
    }
    return res.json({ message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Unable to send verification code.' });
  }
});

router.post('/signup', throttleAuthByIp, async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const email = cleanEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const { password, captchaId, captchaAnswer } = req.body;
    const faceDescriptors = cleanFaceDescriptors(
  req.body.faceDescriptors,
);
    if (!USERNAME_PATTERN.test(username)) {
      return res.status(400).json({ message: 'Username must be 3-24 letters, numbers, or underscores.' });
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ message: 'Password must be 12-72 characters with letters and numbers.' });
    }
    if (!isValidOtp(otp)) {
      return res.status(400).json({ message: 'Enter the 6-digit verification code from your email.' });
    }
    if (!faceDescriptors) {
  return res.status(400).json({
    message: 'Three valid face descriptors are required.',
  });
}
    if (!await verifyCaptcha(captchaId, captchaAnswer)) {
      recordAuthFailure(req);
      return res.status(400).json({ message: 'CAPTCHA challenge expired or was incorrect.' });
    }
    if (!await verifyPendingEmailOtp(email, otp)) {
      return res.status(400).json({ message: 'Verification code is invalid or has expired.' });
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.status(400).json({ message: 'Username or email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, faceDescriptors });
    await user.save();
    clearAuthFailures(req);

    return res.status(201).json({ message: 'Signup successful. Face profile saved.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error during signup.' });
  }
});

router.post('/login', throttleAuthByIp, async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const { password, captchaId, captchaAnswer } = req.body;
    const faceDescriptor = cleanFaceDescriptor(req.body.faceDescriptor);
    const typingProfile = cleanTypingProfile(req.body.typingProfile);
    if (!USERNAME_PATTERN.test(username) || !password || !faceDescriptor) {
      return res.status(400).json({ message: 'Username, password, and face descriptor are required for login.' });
    }
    if (!typingProfile) {
      return res.status(400).json({ message: 'Type the password so login typing behavior can be verified.' });
    }
    if (!await verifyCaptcha(captchaId, captchaAnswer)) {
      recordAuthFailure(req);
      return res.status(400).json({ message: 'CAPTCHA challenge expired or was incorrect.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      recordAuthFailure(req);
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      recordAuthFailure(req);
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const threshold = 0.45;

const distances = user.faceDescriptors.map(
  (storedDescriptor) => computeDistance(
    storedDescriptor,
    faceDescriptor,
  ),
);

const bestDistance = Math.min(...distances);

const confidence = Math.max(
  0,
  Math.round((1 - bestDistance / threshold) * 100),
);

if (bestDistance > threshold) {
  recordAuthFailure(req);

  return res.status(401).json({
    message:
      'Face recognition failed. Try again with a clearer view.',
  });
}

    const typingHistory = (user.typingProfiles || []).slice(0, TYPING_PROFILE_LIMIT);
    let typingResult;
    try {
      typingResult = await evaluateTypingBehavior(typingHistory, typingProfile);
    } catch (error) {
      console.error('Typing behavior verification failed:', error.message);
      return res.status(503).json({ message: 'Typing behavior verification is unavailable. Try again.' });
    }
    if (typingResult.suspicious) {
      recordAuthFailure(req);
      return res.status(401).json({ message: 'Typing behavior changed unexpectedly. Login blocked.' });
    }

    if (!user.typingProfiles) user.typingProfiles = [];
    user.typingProfiles.unshift({ ...typingProfile, capturedAt: new Date() });
    user.typingProfiles = user.typingProfiles.slice(0, TYPING_PROFILE_LIMIT);
    user.loginIps.unshift({ ipAddress: getRequestIp(req), seenAt: new Date() });
    user.loginIps = user.loginIps.slice(0, 12);
    await user.save();
    await createSession(user, req, res);
    clearAuthFailures(req);
    return res.json({
  message: 'Login successful.',
  user: { username: user.username },
  faceVerification: {
    matched: true,
    confidence,
  },
});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

router.get('/me', requireSession, (req, res) => res.json({
  user: {
    username: req.user.username,
    email: req.user.email,
    balanceCents: req.user.balanceCents,
  },
}));

router.post('/activity', requireSession, (req, res) => res.status(204).send());

router.post('/logout', requireSession, async (req, res) => {
  await Session.deleteOne({ _id: req.sessionRecord._id });
  clearSessionCookie(res);
  return res.status(204).send();
});

module.exports = router;
