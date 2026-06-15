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
  const [faceDescriptors, setFaceDescriptors] = useState([]);
  const [captureStep, setCaptureStep] = useState(0);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const navigate = useNavigate();

  const captureInstructions = [
    'Look straight into the camera.',
    'Turn your head slightly to the left.',
    'Turn your head slightly to the right.',
  ];

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
    if (captureStep >= 3) {
      setMessage('Biometric profile already completed.');
      return;
    }
    try {
      setMessage(`Capturing... ${captureInstructions[captureStep]}`);
      const descriptor = await getFaceDescriptor(videoRef.current);
      const updatedDescriptors = [...faceDescriptors, descriptor];
      setFaceDescriptors(updatedDescriptors);
      if (captureStep < 2) {
        setCaptureStep((prev) => prev + 1);
        setMessage(
          `✓ Capture ${captureStep + 1}/3 completed.\n${captureInstructions[captureStep + 1]}`
        );
      } else {
        setCaptureStep(3);
        setMessage('✓ Biometric profile created successfully.\nYou can now submit your signup.');
      }
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
    if (faceDescriptors.length < 3) {
      setMessage(`Complete biometric enrollment.\n${3 - faceDescriptors.length} capture(s) remaining.`);
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
        faceDescriptors,
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

      <div className="status-box">
        <strong>{t('status')}</strong>
        <p style={{ whiteSpace: 'pre-line' }}>{td(message)}</p>
        <p>Face Enrollment Progress: {faceDescriptors.length}/3</p>
      </div>

      <div className="signup-layout">
        <div className="signup-main">
          <div className="video-box">
            <video
  ref={videoRef}
  width="500"
  height="270"
  autoPlay
  muted
  className="camera-video"
/>
          </div>

          <div className="button-row">
            <button onClick={startCamera} type="button">
              {t('startCamera')}
            </button>
            <button
              onClick={captureFace}
              type="button"
              disabled={!isCameraOn || !modelsLoaded || captureStep >= 3}
            >
              {captureStep >= 3 ? 'Face Enrollment Complete' : `Capture Face (${captureStep + 1}/3)`}
            </button>
          </div>

          
        </div>{/* end signup-main */}

        <div className="signup-sidebar">
          <div className="tips-card">
            <h3>Face Capture Tips</h3>
            <h4>✓ DO's</h4>
            <ul>
              <li>Ensure good lighting.</li>
              <li>Keep your face centered.</li>
              <li>Remove sunglasses or masks.</li>
              <li>Follow the angle instructions.</li>
            </ul>
            <h4>✗ DON'Ts</h4>
            <ul>
              <li>Don't use poor lighting.</li>
              <li>Don't move during capture.</li>
              <li>Don't cover your face.</li>
              <li>Don't enroll another person's face.</li>
            </ul>
          </div>
        </div>{/* end signup-sidebar */}
      </div>{/* end signup-layout */}
<form className="form-card" onSubmit={handleSubmit}>
            <label>
              {t('username')}
              <input value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
            <label>
              {t('email')}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <div className="button-row">
              <button onClick={handleSendOtp} type="button" disabled={otpSending}>
                {otpSending ? t('sending') : t('sendVerificationCode')}
              </button>
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
            <button type="submit" disabled={loading}>
              {loading ? t('signingUp') : t('signup')}
            </button>
          </form>
    </div>
  );
};

export default Signup;