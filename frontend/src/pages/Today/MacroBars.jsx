function MacroBar({ label, consumed, target, color, badge }) {
  const pct = Math.min((consumed / Math.max(target, 1)) * 100, 100);
  const over = consumed > target;

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-600">{label}</span>
          {badge}
        </div>
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

export default function MacroBars({ protein, carbs, fat, targets, aminoScore }) {
  const qualityBadge = aminoScore != null ? (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
      aminoScore >= 80 ? 'bg-primary-light text-primary' :
      aminoScore >= 50 ? 'bg-amber-50 text-amber-600' :
      'bg-red-50 text-red-500'
    }`}>
      Quality: {aminoScore}%
    </span>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <MacroBar label="Protein" consumed={protein} target={targets?.proteinTarget || 150} color="bg-blue-500" badge={qualityBadge} />
      <MacroBar label="Carbs"   consumed={carbs}   target={targets?.carbTarget   || 250} color="bg-amber-400" />
      <MacroBar label="Fat"     consumed={fat}      target={targets?.fatTarget    || 65}  color="bg-rose-400" />
    </div>
  );
}
