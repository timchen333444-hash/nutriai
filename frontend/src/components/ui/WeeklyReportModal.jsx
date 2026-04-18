import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, TrendingUp, TrendingDown, Lightbulb, Loader2 } from 'lucide-react';

const NUTRIENT_ICONS = {
  vitaminD:   '☀️',
  iron:       '🩸',
  magnesium:  '💎',
  calcium:    '🦴',
  zinc:       '🔩',
  vitaminB12: '💊',
  folate:     '🌿',
  potassium:  '🍌',
  omega3:     '🐟',
  vitaminC:   '🍊',
};

const STORAGE_KEY = 'nutriai_weekly_report_dismissed';

function dismissedThisWeek() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  // Mark is the ISO date of the most recent Sunday
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  const lastSundayStr = lastSunday.toISOString().slice(0, 10);
  return raw === lastSundayStr;
}

function markDismissed() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  localStorage.setItem(STORAGE_KEY, lastSunday.toISOString().slice(0, 10));
}

export default function WeeklyReportModal({ onClose }) {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    axios.get('/api/alerts/weekly-report')
      .then(r => setReport(r.data))
      .catch(e => setError(e.response?.data?.error || 'Could not load report'))
      .finally(() => setLoading(false));
  }, []);

  const handleClose = () => {
    markDismissed();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-syne font-bold text-lg">Your weekly nutrition report</p>
            <p className="text-xs text-gray-400 mt-0.5">Last 7 days summary</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm">Generating your report…</p>
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-sm text-gray-500">{error}</div>
        )}

        {report && (
          <div className="flex flex-col gap-4">
            {/* Wins */}
            {report.wins.length > 0 && (
              <div className="bg-primary-light rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={15} className="text-primary" />
                  <p className="font-semibold text-sm text-primary-dark">Great work this week</p>
                </div>
                <div className="flex flex-col gap-2">
                  {report.wins.map(w => (
                    <div key={w.nutrientKey} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{NUTRIENT_ICONS[w.nutrientKey] || '✅'}</span>
                        <span className="text-sm font-medium text-primary-dark">{w.name}</span>
                      </div>
                      <span className="text-xs font-bold text-primary bg-white px-2 py-0.5 rounded-full">
                        {Math.min(w.avgPercent, 100)}% avg
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gaps */}
            {report.gaps.length > 0 && (
              <div className="bg-red-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={15} className="text-red-500" />
                  <p className="font-semibold text-sm text-red-700">Needs attention</p>
                </div>
                <div className="flex flex-col gap-2">
                  {report.gaps.map(g => (
                    <div key={g.nutrientKey} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{NUTRIENT_ICONS[g.nutrientKey] || '⚠️'}</span>
                        <span className="text-sm font-medium text-red-700">{g.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-red-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: `${Math.min(g.avgPercent, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-red-500 w-8 text-right">
                          {g.avgPercent}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.wins.length === 0 && report.gaps.length === 0 && (
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500">Not enough data this week. Log more meals to see your trends.</p>
              </div>
            )}

            {/* Claude tip */}
            {report.tip && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <Lightbulb size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-700 mb-1">Personalized tip</p>
                    <p className="text-sm text-amber-800 leading-relaxed">{report.tip}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-dark transition-colors"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { dismissedThisWeek };
