import { Hands } from '@mediapipe/hands';

let hands;

export const initializeHands = async () => {
  hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });
};

export const detectThreeFingers = (landmarks) => {
  if (!landmarks) return false;

  const hand = landmarks[0];

  if (!hand) return false;

  const fingerUp = (tip, pip) =>
    hand[tip].y < hand[pip].y;

  const indexUp = fingerUp(8, 6);
  const middleUp = fingerUp(12, 10);
  const ringUp = fingerUp(16, 14);

  const pinkyUp = fingerUp(20, 18);

  return (
    indexUp &&
    middleUp &&
    ringUp &&
    !pinkyUp
  );
};

export const getHands = () => hands;