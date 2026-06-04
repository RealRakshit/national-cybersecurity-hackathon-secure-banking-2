import { useEffect, useState } from 'react';
import { getCaptcha } from '../api/auth';

const CaptchaField = ({ answer, onAnswer, onChallenge, refreshKey }) => {
  const [prompt, setPrompt] = useState('Loading challenge...');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await getCaptcha();
      setPrompt(data.prompt);
      onChallenge(data.challengeId);
      onAnswer('');
    } catch (error) {
      setPrompt('Challenge unavailable. Refresh and try again.');
      onChallenge('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refreshKey]);

  return (
    <div className="challenge-field">
      <label>
        CAPTCHA: {prompt}
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={answer}
          onChange={(event) => onAnswer(event.target.value)}
          required
        />
      </label>
      <button type="button" className="quiet-button" onClick={refresh} disabled={loading}>
        New challenge
      </button>
    </div>
  );
};

export default CaptchaField;
