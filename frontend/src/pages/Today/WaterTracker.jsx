import { Droplets } from 'lucide-react';
import { useUnits } from '../../context/UnitsContext';

export default function WaterTracker({ glasses, onUpdate }) {
  const { formatWater, waterLabel } = useUnits();

  return (
    <div className="bg-blue-50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets size={18} className="text-blue-500" />
          <span className="font-semibold text-sm text-blue-900">Water</span>
        </div>
        <div className="text-right">
          <span className="text-sm text-blue-700 font-medium">{glasses}/8 glasses</span>
          {glasses > 0 && (
            <span className="text-xs text-blue-400 ml-1.5">
              · {formatWater(glasses)}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 8 }, (_, i) => {
          const filled = i < glasses;
          return (
            <button
              key={i}
              aria-label={`${i + 1} glass${i + 1 !== 1 ? 'es' : ''}`}
              onClick={() => onUpdate(filled && glasses === i + 1 ? i : i + 1)}
              className={`flex-1 h-9 rounded-lg transition-all ${
                filled ? 'bg-blue-500 shadow-sm' : 'bg-blue-100 hover:bg-blue-200'
              }`}
            >
              <div className="w-full h-full rounded-lg flex items-center justify-center">
                <Droplets size={13} className={filled ? 'text-white' : 'text-blue-300'} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Volume label below */}
      <p className="text-xs text-blue-400 text-center mt-2">
        1 glass = 8 fl oz / 240 ml · goal: {formatWater(8)} total
      </p>
    </div>
  );
}
