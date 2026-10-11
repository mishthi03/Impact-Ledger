interface ProgressBarProps {
  value: number;
  max: number;
  showLabel?: boolean;
}

export default function ProgressBar({ value, max, showLabel = false }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = value > max;
  const color = isOver ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-teal-500';

  return (
    <div className="w-full">
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-stone-400">
          <span>{pct.toFixed(0)}%</span>
          <span>{isOver ? 'Over budget' : `${(100 - pct).toFixed(0)}% remaining`}</span>
        </div>
      )}
    </div>
  );
}
