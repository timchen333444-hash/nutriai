function MacroBar({ label, consumed, target, color }) {
  const pct = Math.min((consumed / Math.max(target, 1)) * 100, 100);
  const over = consumed > target;

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-xs text-gray-400">
          <span className={`font-semibold ${over ? 'text-amber-500' : 'text-gray-700'}`}>
            {Math.round(consumed)}
          </span>
          /{target}g
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-bar ${over ? 'bg-amber-400' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function MacroBars({ protein, carbs, fat, targets }) {
  return (
    <div className="flex flex-col gap-3">
      <MacroBar label="Protein" consumed={protein} target={targets?.proteinTarget || 150} color="bg-blue-500" />
      <MacroBar label="Carbs" consumed={carbs} target={targets?.carbTarget || 250} color="bg-amber-400" />
      <MacroBar label="Fat" consumed={fat} target={targets?.fatTarget || 65} color="bg-rose-400" />
    </div>
  );
}
