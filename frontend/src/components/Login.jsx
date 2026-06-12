import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { getFaceDescriptor, loadFaceModels } from '../face/faceUtils';
import { useLanguage } from '../i18n';
import CaptchaField from './CaptchaField';

const Login = () => {
  const { t, td } = useLanguage();
  const videoRef = useRef(null);
  const typingSessionRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [message, setMessage] = useState('Loading face models...');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const resetTypingSession = () => {
    typingSessionRef.current = {
      startedAt: 0,
      lastKeyAt: 0,
      previousKeyDownAt: 0,
      printableKeyCount: 0,
      backspaceCount: 0,
      heldKeys: new Map(),
      holdTimes: [],
      keyDelays: [],
    };
  };

  if (!typingSessionRef.current) resetTypingSession();

  useEffect(() => {
    loadFaceModels()
      .then(() => {
        setModelsLoaded(true);
        setMessage('Face models loaded. Start camera and capture your face.');
      })
      .catch(() => setMessage('Failed to load face models. Refresh to retry.'));
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraOn(true);
      setMessage('Camera started. Please position your face clearly.');
    } catch (error) {
      setMessage('Unable to open camera. Allow camera access and try again.');
    }
  };

  const captureFace = async () => {
    if (!modelsLoaded || !videoRef.current) {
      setMessage('Face models are still loading. Please wait.');
      return;
    }

    try {
      setMessage('Detecting face...');
      const descriptor = await getFaceDescriptor(videoRef.current);
      setFaceDescriptor(descriptor);
      setMessage('Face captured successfully. Now press Login.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const isTrackedTypingKey = (key) => key.length === 1 || key === 'Backspace';

  const handlePasswordKeyDown = (event) => {
    if (event.repeat || !isTrackedTypingKey(event.key)) return;
    const now = performance.now();
    const session = typingSessionRef.current;
    if (!session.startedAt) session.startedAt = now;
    if (session.previousKeyDownAt) session.keyDelays.push(now - session.previousKeyDownAt);
    session.previousKeyDownAt = now;
    session.lastKeyAt = now;
    session.heldKeys.set(event.code, now);

    if (event.key === 'Backspace') {
      session.backspaceCount += 1;
      return;
    }
    session.printableKeyCount += 1;
  };

  const handlePasswordKeyUp = (event) => {
    if (!isTrackedTypingKey(event.key)) return;
    const pressedAt = typingSessionRef.current.heldKeys.get(event.code);
    if (!pressedAt) return;
    const now = performance.now();
    typingSessionRef.current.holdTimes.push(now - pressedAt);
    typingSessionRef.current.lastKeyAt = now;
    typingSessionRef.current.heldKeys.delete(event.code);
  };

  const buildTypingProfile = () => {
    const session = typingSessionRef.current;
    if (
      session.printableKeyCount < 2
      || !session.startedAt
      || session.holdTimes.length === 0
      || session.keyDelays.length === 0
    ) return null;

    const typingDurationMs = Math.max(session.lastKeyAt - session.startedAt, 250);
    return {
      wpm: (session.printableKeyCount / 5) / (typingDurationMs / 60000),
      keyHoldTimeMs: average(session.holdTimes),
      keyDelayMs: average(session.keyDelays),
      backspaceCount: session.backspaceCount,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!faceDescriptor) {
      setMessage('Please capture your face before logging in.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await login({
        username,
        password,
        typingProfile: buildTypingProfile(),
        faceDescriptor,
        captchaId,
        captchaAnswer,
      });
      setMessage(data.message);
      navigate('/dashboard');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Login failed.');
      setCaptchaRefreshKey((key) => key + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-card">
      <h2>{t('loginTitle')}</h2>
      <p>{t('loginIntro')}</p>

      <div className="video-box">
        <video ref={videoRef} width="360" height="270" autoPlay muted className="camera-video" />
      </div>

      <div className="button-row">
        <button onClick={startCamera} type="button">{t('startCamera')}</button>
        <button onClick={captureFace} type="button" disabled={!isCameraOn || !modelsLoaded}>{t('captureFace')}</button>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <label>
          {t('username')}
          <input value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label>
          {t('password')}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={handlePasswordKeyDown}
            onKeyUp={handlePasswordKeyUp}
            onFocus={() => {
              if (!password) resetTypingSession();
            }}
            required
          />
        </label>
        <CaptchaField
          answer={captchaAnswer}
          onAnswer={setCaptchaAnswer}
          onChallenge={setCaptchaId}
          refreshKey={captchaRefreshKey}
        />
        <button type="submit" disabled={loading}>{loading ? t('loggingIn') : t('login')}</button>
      </form>

      <div className="status-box">
        <strong>{t('status')}</strong>
        <p>{td(message)}</p>
      </div>
    </div>
  );
};

export default Login;
