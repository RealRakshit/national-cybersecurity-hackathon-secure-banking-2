import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, recordActivity } from '../api/auth';

const IDLE_MS = 60 * 1000;
const ACTIVITY_SYNC_MS = 20 * 1000;

const useIdleSession = () => {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    const expire = async () => {
      try {
        await logout();
      } catch (error) {
        // The backend also expires idle sessions.
      }
      navigate('/login', { replace: true });
    };

    const resetTimer = () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(expire, IDLE_MS);
    };

    const noteActivity = () => {
      resetTimer();
      if (Date.now() - lastSyncRef.current > ACTIVITY_SYNC_MS) {
        lastSyncRef.current = Date.now();
        recordActivity().catch(() => navigate('/login', { replace: true }));
      }
    };

    const events = ['pointerdown', 'keydown', 'mousemove', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, noteActivity, { passive: true }));
    resetTimer();

    return () => {
      window.clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, noteActivity));
    };
  }, [navigate]);
};

export default useIdleSession;
