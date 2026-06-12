import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, signup } from '../api/auth';
import { getFaceDescriptor, loadFaceModels } from '../face/faceUtils';
import { useLanguage } from '../i18n';
import CaptchaField from './CaptchaField';

const Signup = () => {
  const { t, td } = useLanguage();
  const videoRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [message, setMessage] = useState('Loading face models...');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const navigate = useNavigate();

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
      setMessage('Face captured successfully. You can now submit your signup.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setMessage('Enter your email before requesting a verification code.');
      return;
    }

    try {
      setOtpSending(true);
      const { data } = await sendOtp({ email });
      setMessage(data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to send verification code.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!faceDescriptor) {
      setMessage('Please capture your face before signing up.');
      return;
    }
    if (!otp.trim()) {
      setMessage('Please enter the 6-digit verification code from your email.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await signup({
        username,
        email,
        otp,
        password,
        faceDescriptor,
        captchaId,
        captchaAnswer,
      });
      setMessage(data.message);
      setTimeout(() => navigate('/login'), 800);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Signup failed.');
      setCaptchaRefreshKey((key) => key + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-card">
      <h2>{t('signupTitle')}</h2>
      <p>{t('signupIntro')}</p>

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
          {t('email')}
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <div className="button-row">
          <button onClick={handleSendOtp} type="button" disabled={otpSending}>{otpSending ? t('sending') : t('sendVerificationCode')}</button>
        </div>
        <label>
          {t('verificationCode')}
          <input value={otp} onChange={(event) => setOtp(event.target.value)} required />
        </label>
        <label>
          {t('password')}
          <input
            type="password"
            minLength="12"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <CaptchaField
          answer={captchaAnswer}
          onAnswer={setCaptchaAnswer}
          onChallenge={setCaptchaId}
          refreshKey={captchaRefreshKey}
        />
        <button type="submit" disabled={loading}>{loading ? t('signingUp') : t('signup')}</button>
      </form>

      <div className="status-box">
        <strong>{t('status')}</strong>
        <p>{td(message)}</p>
      </div>
    </div>
  );
};

export default Signup;
