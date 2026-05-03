const SCORE_COLOR = (score) => {
  if (score >= 80) return '#4a7c59';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
};

const SCORE_LABEL = (score) => {
  if (score >= 80) return 'Great';
  if (score >= 50) return 'Good';
  return 'Low';
};

export default function AminoAcidScore({ data }) {
  if (!data) return null;

  const { score, weakestLinks } = data;
  const color = SCORE_COLOR(score);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-base">🔬</span>
        <h3 className="font-semibold text-sm text-gray-800">Protein Quality Score</h3>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-auto"
          style={{ backgroundColor: color + '18', color }}>
          {SCORE_LABEL(score)}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-4 leading-snug">
        How complete your protein intake is across all 9 essential amino acids
      </p>

      <div className="flex items-center gap-5">
        {/* Circular score */}
        <div className="relative flex-shrink-0" style={{ width: 112, height: 112 }}>
          <svg width={112} height={112} className="-rotate-90">
            <circle cx={56} cy={56} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={10} />
            <circle
              cx={56} cy={56} r={radius}
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-syne font-bold text-2xl leading-none" style={{ color }}>{score}</span>
            <span className="text-[10px] text-gray-400 mt-0.5">/ 100</span>
          </div>
        </div>

        {/* Weakest links */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            Weakest links
          </p>
          {weakestLinks.map((aa) => {
            const c = SCORE_COLOR(aa.pct);
            return (
              <div key={aa.key} className="mb-2.5">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-gray-600 truncate">{aa.name}</span>
                  <span className="text-xs font-semibold ml-2 flex-shrink-0" style={{ color: c }}>
                    {aa.pct}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${aa.pct}%`, backgroundColor: c, transition: 'width 0.6s ease' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tip */}
      <div className="mt-3 bg-primary-light rounded-xl px-3 py-2.5">
        <p className="text-xs text-primary-dark leading-snug">
          <span className="font-semibold">💡 Tip:</span> Complete proteins include meat, fish, eggs, dairy and soy.
          Combine rice&nbsp;+&nbsp;beans or bread&nbsp;+&nbsp;peanut butter for complete plant protein.
        </p>
      </div>
    </div>
  );
}
