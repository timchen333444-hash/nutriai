import { useUnits } from '../../context/UnitsContext';

export default function CalorieRing({ consumed, target, burned = 0 }) {
  const { displayEnergy, energyLabel } = useUnits();

  const size        = 180;
  const strokeWidth = 16;
  const radius      = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const netMode = burned > 0;
  const net     = Math.max(consumed - burned, 0);

  // Ring fills toward the goal using net calories when synced, consumed when not
  const ringValue = netMode ? net : consumed;
  const pct       = Math.min(ringValue / Math.max(target, 1), 1);
  const offset    = circumference * (1 - pct);
  const over      = ringValue > target;
  const remaining = Math.max(target - ringValue, 0);

  const dispRing      = displayEnergy(ringValue);
  const dispTarget    = displayEnergy(target);
  const dispRemaining = displayEnergy(remaining);
  const dispConsumed  = displayEnergy(consumed);
  const dispBurned    = displayEnergy(burned);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#e8f5ec" strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={over ? '#f59e0b' : '#4a7c59'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="ring-progress"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-syne font-bold text-3xl text-gray-900">
            {dispRing.toLocaleString()}
          </span>
          {netMode ? (
            <span className="text-xs text-primary font-semibold mt-0.5">net {energyLabel}</span>
          ) : (
            <span className="text-xs text-gray-400 font-medium">
              of {dispTarget.toLocaleString()} {energyLabel}
            </span>
          )}
          {over ? (
            <span className="text-xs text-amber-500 font-semibold mt-0.5">over goal</span>
          ) : (
            <span className="text-xs text-primary font-medium mt-0.5">
              {dispRemaining.toLocaleString()} left
            </span>
          )}
        </div>
      </div>

      {/* Net breakdown row shown when fitness is connected */}
      {netMode && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-white/70 font-medium">
          <span>{dispConsumed} eaten</span>
          <span className="text-white/40">−</span>
          <span>{dispBurned} burned</span>
          <span className="text-white/40">=</span>
          <span className="text-white font-bold">{dispRing} net</span>
        </div>
      )}
    </div>
  );
}
