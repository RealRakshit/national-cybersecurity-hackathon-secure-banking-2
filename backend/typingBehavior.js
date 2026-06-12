const { spawn } = require('child_process');
const path = require('path');

const TYPING_PROFILE_LIMIT = 5;
const predictorPath = path.resolve(__dirname, '..', 'ml', 'predict_typing_behavior.py');
const PREDICTOR_TIMEOUT_MS = Number(process.env.TYPING_PREDICTOR_TIMEOUT_MS || 15000);

const clampRounded = (value, decimalPlaces = 2) => Number(Number(value).toFixed(decimalPlaces));
const finiteInRange = (value, minimum, maximum) => Number.isFinite(value)
  && value >= minimum
  && value <= maximum;

const cleanTypingProfile = (profile) => {
  const cleaned = {
    wpm: Number(profile?.wpm),
    keyHoldTimeMs: Number(profile?.keyHoldTimeMs),
    keyDelayMs: Number(profile?.keyDelayMs),
    backspaceCount: Number(profile?.backspaceCount),
  };

  const valid = finiteInRange(cleaned.wpm, 1, 320)
    && finiteInRange(cleaned.keyHoldTimeMs, 10, 1200)
    && finiteInRange(cleaned.keyDelayMs, 0, 4000)
    && Number.isInteger(cleaned.backspaceCount)
    && finiteInRange(cleaned.backspaceCount, 0, 120);
  if (!valid) return null;

  return {
    wpm: clampRounded(cleaned.wpm),
    keyHoldTimeMs: clampRounded(cleaned.keyHoldTimeMs),
    keyDelayMs: clampRounded(cleaned.keyDelayMs),
    backspaceCount: cleaned.backspaceCount,
  };
};

const evaluateTypingBehavior = (history, candidate) => new Promise((resolve, reject) => {
  if (history.length < TYPING_PROFILE_LIMIT) {
    resolve({ suspicious: false, reason: 'baseline_pending' });
    return;
  }

  const python = process.env.PYTHON_BIN || 'python';
  const child = spawn(python, [predictorPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  const timeout = setTimeout(() => child.kill(), PREDICTOR_TIMEOUT_MS);

  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.on('error', (error) => {
    clearTimeout(timeout);
    reject(error);
  });
  child.on('close', (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      reject(new Error(stderr.trim() || `Typing behavior predictor exited with code ${code}.`));
      return;
    }

    try {
      const result = JSON.parse(stdout);
      const metrics = result.evaluation?.metrics;
      if (metrics) {
        console.info(
          `Typing behavior model synthetic metrics: accuracy=${metrics.accuracy}`
          + ` precision=${metrics.precision} recall=${metrics.recall} f1=${metrics.f1}`,
        );
      }
      resolve(result);
    } catch (error) {
      reject(new Error('Typing behavior predictor returned invalid JSON.'));
    }
  });

  child.stdin.end(JSON.stringify({ history, candidate }));
});

module.exports = {
  TYPING_PROFILE_LIMIT,
  cleanTypingProfile,
  evaluateTypingBehavior,
};
