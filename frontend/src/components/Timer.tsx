import { useEffect, useRef, useCallback } from 'react';

interface TimerProps {
  timeLeft: number; // seconds remaining
  total: number;    // total seconds (30 min = 1800)
  onTick: () => void;
  onTimeUp: () => void;
  running: boolean;
}

export default function Timer({ timeLeft, total, onTick, onTimeUp, running }: TimerProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  const tick = useCallback(() => {
    onTick();
  }, [onTick]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, tick]);

  useEffect(() => {
    if (timeLeft <= 0 && running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      onTimeUpRef.current();
    }
  }, [timeLeft, running]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const percentage = (timeLeft / total) * 100;
  const isLow = timeLeft <= 60;
  const isMedium = timeLeft <= 300;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        {/* Circular progress */}
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64" cy="64" r="56"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="6"
          />
          <circle
            cx="64" cy="64" r="56"
            fill="none"
            stroke={isLow ? '#ef4444' : isMedium ? '#f2a71b' : '#2e9e5b'}
            strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 56}`}
            strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${isLow ? 'text-red-500' : isMedium ? 'text-brand-amber' : 'text-gray-700'}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}