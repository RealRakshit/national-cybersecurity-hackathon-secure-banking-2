import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signup } from '../api/auth';
import { getFaceDescriptor, loadFaceModels } from '../face/faceUtils';
import CaptchaField from './CaptchaField';

const Signup = () => {
  const videoRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [message, setMessage] = useState('Loading face models...');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!faceDescriptor) {
      setMessage('Please capture your face before signing up.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await signup({
        username,
        email,
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
      <h2>Sign Up with Face Recognition</h2>
      <p>Start your webcam, capture your face, then submit your sign up details.</p>

      <div className="video-box">
        <video ref={videoRef} width="360" height="270" autoPlay muted className="camera-video" />
      </div>

      <div className="button-row">
        <button onClick={startCamera} type="button">Start Camera</button>
        <button onClick={captureFace} type="button" disabled={!isCameraOn || !modelsLoaded}>Capture Face</button>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
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
        <button type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign Up'}</button>
      </form>

      <div className="status-box">
        <strong>Status:</strong>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default Signup;
