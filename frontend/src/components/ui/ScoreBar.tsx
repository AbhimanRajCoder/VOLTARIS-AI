'use client';

import { useEffect, useState } from 'react';

interface ScoreBarProps {
  label: string;
  score: number; // 0 to 1
  color?: string;
}

export default function ScoreBar({ label, score, color }: ScoreBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Animate on mount
    const timer = setTimeout(() => setWidth(score * 100), 50);
    return () => clearTimeout(timer);
  }, [score]);

  // Determine color if not provided
  let barColor = color;
  if (!barColor) {
    if (score >= 0.7) barColor = 'var(--color-success)';
    else if (score >= 0.4) barColor = 'var(--color-warning)';
    else barColor = 'var(--color-danger)';
  }

  return (
    <div className="flex items-center justify-between gap-3 w-full text-xs">
      <span className="text-[var(--color-text-secondary)] w-24 truncate">{label}</span>
      <div className="flex-1 h-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-600 ease-out"
          style={{ width: `${width}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="text-[var(--color-text-primary)] font-mono w-8 text-right">
        {score.toFixed(2)}
      </span>
    </div>
  );
}
