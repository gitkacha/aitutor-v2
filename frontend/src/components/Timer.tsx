import { useEffect, useRef } from 'react';
import Countdown, { CountdownApi, CountdownRenderProps } from 'react-countdown';

interface TimerProps {
  endTime: number; // epoch ms — owned by the parent so remounts never reset the clock
  total: number; // total seconds (30 min = 1800), for the progress ring
  running: boolean;
  onTick: (remainingSeconds: number) => void;
  onTimeUp: () => void;
}

// Countdown driven by react-countdown (L2): remaining time derives from Date.now()
// against a fixed end timestamp, so it never drifts and stays exam-accurate even in
// background tabs — unlike the previous tick-decrement engine.
export default function Timer({ endTime, total, running, onTick, onTimeUp }: TimerProps) {
  const apiRef = useRef<CountdownApi | null>(null);

  useEffect(() => {
    if (!running) apiRef.current?.pause();
  }, [running]);

  const renderer = ({ total: remainingMs }: CountdownRenderProps) => {
    const timeLeft = Math.max(0, Math.round(remainingMs / 1000));
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
              stroke={isLow ? '#ef4444' : isMedium ? 'var(--brand-amber)' : 'var(--brand-green)'}
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
  };

  return (
    <Countdown
      date={endTime}
      intervalDelay={1000}
      precision={0}
      renderer={renderer}
      onTick={({ total: remainingMs }) => onTick(Math.max(0, Math.round(remainingMs / 1000)))}
      onComplete={onTimeUp}
      ref={(instance) => {
        apiRef.current = instance?.getApi() ?? null;
      }}
    />
  );
}
