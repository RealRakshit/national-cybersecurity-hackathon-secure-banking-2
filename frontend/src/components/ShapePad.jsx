import { useEffect, useRef, useState } from 'react';

const ShapePad = ({ challenge, onTrace }) => {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [points, setPoints] = useState([]);

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (context) context.clearRect(0, 0, canvas.width, canvas.height);
    setPoints([]);
    onTrace([]);
  };

  useEffect(() => {
    clear();
  }, [challenge.challengeId]);

  const normalize = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const drawSegment = (from, to) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.strokeStyle = '#0f766e';
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(from.x * canvas.width, from.y * canvas.height);
    context.lineTo(to.x * canvas.width, to.y * canvas.height);
    context.stroke();
  };

  const begin = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = normalize(event);
    setPoints([point]);
    onTrace([point]);
  };

  const move = (event) => {
    if (!drawingRef.current) return;
    const point = normalize(event);
    setPoints((current) => {
      const next = [...current, point].slice(-320);
      if (current.length) drawSegment(current[current.length - 1], point);
      onTrace(next);
      return next;
    });
  };

  const end = () => {
    drawingRef.current = false;
  };

  return (
    <div className="shape-pad">
      <p>{challenge.prompt}</p>
      <canvas
        aria-label={challenge.prompt}
        ref={canvasRef}
        width="520"
        height="220"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="button-row compact-row">
        <button type="button" className="quiet-button" onClick={clear}>Clear drawing</button>
        <span>{points.length ? `${points.length} trace points captured` : 'Draw in one stroke.'}</span>
      </div>
    </div>
  );
};

export default ShapePad;
