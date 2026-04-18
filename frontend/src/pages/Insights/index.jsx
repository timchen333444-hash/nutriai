import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  Flame, Droplets, TrendingUp, TrendingDown, Zap, Scale,
  Bell, BellOff, X, ChevronRight, CheckCircle2, Footprints,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlerts } from '../../context/AlertsContext';
import HelpModal from '../../components/ui/HelpModal';
import { useUnits } from '../../context/UnitsContext';

const INSIGHTS_HELP = `Insights shows how your nutrition looks over the past 7 days. You'll see a calorie bar chart, your average intake compared to your goal, your logging streak, weight progress, and which vitamins and minerals you're getting plenty of or falling short on. Log food for at least 3 days to start seeing meaningful trends.`;

const COLORS = ['#4a7c59', '#f59e0b', '#f87171'];

const WEIGHT_RANGES = [
  { label: '7d',  value: '7d'  },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'all' },
];

// ── Deficiency Alerts constants ───────────────────────────────────────────────

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

const HEALTH_IMPACTS = {
  vitaminD:   'May affect bone health, immunity, and mood',
  iron:       'May cause fatigue and reduced focus',
  magnesium:  'May affect sleep quality and muscle function',
  calcium:    'Important for bone strength and nerve function',
  zinc:       'Supports immune system and wound healing',
  vitaminB12: 'Essential for energy and nerve function',
  folate:     'Important for cell repair and energy',
  potassium:  'Supports heart health and blood pressure',
  omega3:     'Supports brain health and reduces inflammation',
  vitaminC:   'Boosts immunity and iron absorption',
};

const SEVERITY_LABELS = {
  low:      { label: 'Low',       color: 'text-amber-600',  bg: 'bg-amber-50',  bar: 'bg-amber-400' },
  very_low: { label: 'Very Low',  color: 'text-red-600',    bg: 'bg-red-50',    bar: 'bg-red-500'   },
  critical: { label: 'Critical',  color: 'text-red-700',    bg: 'bg-red-100',   bar: 'bg-red-600'   },
};

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, onDismiss, showFoodSuggestions }) {
  const sev    = SEVERITY_LABELS[alert.severity] || SEVERITY_LABELS.low;
  const barPct = Math.min(alert.currentPercent, 100);
  const barColor = alert.currentPercent < 20 ? 'bg-red-500' : 'bg-amber-400';

  return (
    <div className={`rounded-2xl p-4 border ${sev.bg} border-opacity-50 ${
      alert.severity === 'critical' ? 'border-red-200' :
      alert.severity === 'very_low' ? 'border-red-100' : 'border-amber-100'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{NUTRIENT_ICONS[alert.nutrientKey] || '⚠️'}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-gray-800">{alert.nutrientName}</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sev.bg} ${sev.color}`}>
                {sev.label}
              </span>
              {alert.streakDays >= 3 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  {alert.streakDays} days in a row
                </span>
              )}
            </div>
            {HEALTH_IMPACTS[alert.nutrientKey] && (
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                {HEALTH_IMPACTS[alert.nutrientKey]}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Today&apos;s intake</span>
          <span className={`font-semibold ${alert.currentPercent < 20 ? 'text-red-600' : 'text-amber-600'}`}>
            {alert.currentPercent}% DV
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Food suggestions */}
      {showFoodSuggestions && alert.suggestions?.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Top foods to boost this:</p>
          <div className="flex flex-wrap gap-1.5">
            {alert.suggestions.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 bg-white border border-gray-200 text-xs text-gray-700 px-2.5 py-1 rounded-full font-medium"
              >
                {s.emoji} {s.name}
                <span className="text-gray-400 font-normal">+{s.percentDV}% DV</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deficiency Alerts section ─────────────────────────────────────────────────

function DeficiencyAlertsSection() {
  const { user } = useAuth();
  const { alerts, loading, triggerAnalysis, dismiss } = useAlerts();
  const navigate = useNavigate();

  const settings       = user?.alertSettings;
  const neverConfigured = settings === null;
  const alertsEnabled  = settings?.deficiencyAlerts === true;
  const showFoodSugs   = settings?.foodSuggestions === true;

  // Trigger analysis when the page loads (if enabled)
  useEffect(() => {
    if (alertsEnabled) triggerAnalysis();
  }, [alertsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Case 1: Never configured → show opt-in banner
  if (neverConfigured) {
    return (
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Bell size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-blue-800 mb-1">
              Want personalised nutrition alerts?
            </p>
            <p className="text-xs text-blue-600 leading-relaxed mb-3">
              Turn on Deficiency Alerts in Settings to get notified when you&apos;re missing key nutrients.
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors"
            >
              Turn on <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Alerts are off (but configured)
  if (!alertsEnabled) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellOff size={16} className="text-gray-400" />
            <p className="text-sm text-gray-500">Deficiency alerts are off.</p>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="text-xs font-semibold text-primary bg-primary-light px-3 py-1.5 rounded-xl hover:bg-primary-muted transition-colors"
          >
            Settings
          </button>
        </div>
      </div>
    );
  }

  // Case 3: Alerts enabled — show loading spinner while analyzing
  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={16} className="text-primary" />
          <p className="font-semibold text-sm">Deficiency Alerts</p>
        </div>
        <div className="py-6 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Case 4: Alerts enabled, no deficiencies → success state
  if (alerts.length === 0) {
    return (
      <div className="bg-primary-light border border-primary-muted rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} className="text-primary flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-primary-dark">All nutrients looking good today!</p>
            <p className="text-xs text-primary/70 mt-0.5">Keep it up — you&apos;re hitting your targets.</p>
          </div>
        </div>
      </div>
    );
  }

  // Case 5: Active deficiencies
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-amber-500" />
        <p className="font-semibold text-sm text-gray-700">
          Deficiency Alerts
          <span className="ml-2 text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {alerts.length} gap{alerts.length !== 1 ? 's' : ''} today
          </span>
        </p>
      </div>
      {alerts.map(alert => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onDismiss={dismiss}
          showFoodSuggestions={showFoodSugs}
        />
      ))}
    </div>
  );
}

// ── Weight unit normalisation ─────────────────────────────────────────────────
// Weight entries created before the kg-only storage fix may have been stored in
// lbs with unit='imperial'. This converts any stored value to kg so displayWeight
// always receives kg regardless of when the entry was created.
function logWeightToKg(log) {
  const u = (log.unit || 'kg').toLowerCase();
  if (u === 'lbs' || u === 'imperial') return log.weight / 2.20462;
  return log.weight;
}

// ── Custom weight tooltip ─────────────────────────────────────────────────────

function WeightTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-900">{d.weight} {d.unit}</p>
      <p className="text-gray-400">{d.dateLabel}</p>
      {d.notes && <p className="text-gray-400 italic mt-0.5">{d.notes}</p>}
    </div>
  );
}

// ── Weight progress section ───────────────────────────────────────────────────

function WeightProgress() {
  const { user } = useAuth();
  const { displayWeight, weightLabel } = useUnits();
  const [range,    setRange]    = useState('30d');
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/weight?range=${range}`)
      .then(r => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Scale size={16} className="text-primary" />
          <p className="font-semibold text-sm">Weight Progress</p>
        </div>
        <div className="h-40 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-primary" />
            <p className="font-semibold text-sm">Weight Progress</p>
          </div>
          <RangeSelector range={range} setRange={setRange} />
        </div>
        <div className="py-10 text-center text-gray-400 text-sm">
          No weight entries yet.{' '}
          <span className="text-primary font-medium">Log your first weight on the Profile page.</span>
        </div>
      </div>
    );
  }

  // Build chart data — normalise stored value to kg first, then convert to display unit
  const chartData = logs.map(l => ({
    weight:    displayWeight(logWeightToKg(l)),
    rawWeight: l.weight,
    notes:     l.notes,
    dateLabel: new Date(l.loggedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    timestamp: new Date(l.loggedAt).getTime(),
    unit:      weightLabel,
  }));

  const first   = displayWeight(logWeightToKg(logs[0]));
  const current = displayWeight(logWeightToKg(logs[logs.length - 1]));
  const change  = Math.round((current - first) * 10) / 10;
  const unit    = weightLabel;

  // Average weekly change
  const daySpan = (new Date(logs[logs.length - 1].loggedAt) - new Date(logs[0].loggedAt)) / 86400_000;
  const weeks   = Math.max(daySpan / 7, 1);
  const avgPerWeek = logs.length > 1 ? Math.round((change / weeks) * 100) / 100 : null;

  // Colour the line based on overall trend
  const trendingDown = change < 0;
  const lineColor    = trendingDown ? '#4a7c59' : change > 0 ? '#ef4444' : '#6b7280';

  // Y-axis domain with padding
  const weights   = chartData.map(d => d.weight);
  const minW      = Math.min(...weights);
  const maxW      = Math.max(...weights);
  const pad       = Math.max((maxW - minW) * 0.15, 0.5);
  const yDomain   = [Math.floor((minW - pad) * 10) / 10, Math.ceil((maxW + pad) * 10) / 10];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-primary" />
          <p className="font-semibold text-sm">Weight Progress</p>
        </div>
        <RangeSelector range={range} setRange={setRange} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Start',   value: `${first} ${unit}` },
          { label: 'Current', value: `${current} ${unit}` },
          {
            label: 'Change',
            value: change === 0 ? '—' : `${change > 0 ? '+' : ''}${change} ${unit}`,
            color: change < 0 ? 'text-green-600' : change > 0 ? 'text-red-500' : 'text-gray-500',
            icon:  change < 0 ? <TrendingDown size={12} /> : change > 0 ? <TrendingUp size={12} /> : null,
          },
          {
            label: 'Per week',
            value: avgPerWeek !== null && logs.length > 1
              ? `${avgPerWeek > 0 ? '+' : ''}${avgPerWeek} ${unit}`
              : '—',
            color: avgPerWeek !== null && avgPerWeek < 0 ? 'text-green-600' : avgPerWeek > 0 ? 'text-red-500' : 'text-gray-500',
          },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
            <p className={`font-semibold text-xs flex items-center justify-center gap-0.5 ${s.color ?? 'text-gray-900'}`}>
              {s.icon}{s.value}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Line chart */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickCount={4}
          />
          <Tooltip content={<WeightTooltip />} />
          <Line
            type="monotone"
            dataKey="weight"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={{ fill: lineColor, r: 3.5, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: lineColor, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-gray-400 text-center mt-2">
        {logs.length} {logs.length === 1 ? 'entry' : 'entries'} · {unit}
      </p>
    </div>
  );
}

function RangeSelector({ range, setRange }) {
  return (
    <div className="flex gap-1">
      {WEIGHT_RANGES.map(r => (
        <button key={r.value} onClick={() => setRange(r.value)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            range === r.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
          }`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ── Activity Trends section ───────────────────────────────────────────────────

function ActivityTrends() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/fitness/history?range=7d')
      .then(r => setHistory(r.data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const hasData = history.some(d => d.steps > 0 || d.caloriesBurned > 0);

  const chartData = history.map(d => ({
    day:           new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }),
    steps:         d.steps,
    caloriesBurned: Math.round(d.caloriesBurned || 0),
  }));

  const avgSteps = hasData
    ? Math.round(history.filter(d => d.steps > 0).reduce((s, d) => s + d.steps, 0) / Math.max(history.filter(d => d.steps > 0).length, 1))
    : 0;

  const bestDay = hasData
    ? history.reduce((best, d) => d.steps > (best?.steps || 0) ? d : best, null)
    : null;

  const bestDayLabel = bestDay
    ? new Date(bestDay.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  // Days with ≥10k steps
  const highStepDays = history.filter(d => d.steps >= 10_000);
  const avgBurnHighStep = highStepDays.length
    ? Math.round(highStepDays.reduce((s, d) => s + (d.caloriesBurned || 0), 0) / highStepDays.length)
    : 0;
  const avgBurnLowStep = history.filter(d => d.steps > 0 && d.steps < 10_000).length
    ? Math.round(history.filter(d => d.steps > 0 && d.steps < 10_000).reduce((s, d) => s + (d.caloriesBurned || 0), 0) / history.filter(d => d.steps > 0 && d.steps < 10_000).length)
    : 0;
  const burnDiff = avgBurnHighStep - avgBurnLowStep;

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Footprints size={16} className="text-primary" />
          <p className="font-semibold text-sm">Activity Trends</p>
        </div>
        <div className="h-32 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Footprints size={16} className="text-primary" />
          <p className="font-semibold text-sm">Activity Trends</p>
        </div>
        <p className="text-sm text-gray-400 py-4 text-center">
          No activity data yet. Connect Google Fit or import from Apple Health on the Today page.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Footprints size={16} className="text-primary" />
        <p className="font-semibold text-sm">Activity Trends</p>
      </div>

      {/* Steps bar chart */}
      <p className="text-xs text-gray-400 mb-2">Daily steps (7 days)</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} barSize={24}>
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            formatter={(v, name) => [name === 'steps' ? `${v.toLocaleString()} steps` : `${v} kcal`, name === 'steps' ? 'Steps' : 'Burned']}
          />
          <Bar dataKey="steps" fill="#4a7c59" radius={[5, 5, 0, 0]}
            label={{ position: 'top', fontSize: 9, fill: '#9ca3af', formatter: v => v > 0 ? v.toLocaleString() : '' }}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-4 mb-3">
        {[
          { label: 'Avg steps/day', value: avgSteps.toLocaleString()                                },
          { label: 'Best day',      value: bestDayLabel || '—'                                      },
          { label: 'Best steps',    value: bestDay ? bestDay.steps.toLocaleString() : '—'           },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
            <p className="font-semibold text-xs text-gray-900 leading-snug">{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Calories burned trend */}
      <p className="text-xs text-gray-400 mb-2">Calories burned (7 days)</p>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickCount={3} />
          <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} formatter={v => [`${v} kcal`, 'Burned']} />
          <Line type="monotone" dataKey="caloriesBurned" stroke="#f59e0b" strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Correlation note */}
      {highStepDays.length >= 2 && burnDiff > 0 && (
        <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-700">
            On days you hit 10k steps you averaged <strong>{burnDiff} more kcal burned</strong> than other active days.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Insights page ────────────────────────────────────────────────────────

export default function Insights() {
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/insights').then(r => {
      setData(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { dailyData, streak, avgCalories, calorieTarget, gaps, wins } = data;
  const { displayEnergy, energyLabel } = useUnits();

  const NUTRIENT_LABELS = {
    vitaminD: 'Vitamin D', vitaminB12: 'Vitamin B12', vitaminC: 'Vitamin C',
    iron: 'Iron', calcium: 'Calcium', magnesium: 'Magnesium',
    potassium: 'Potassium', omega3: 'Omega-3', zinc: 'Zinc', selenium: 'Selenium',
  };

  // No-data state — still show alerts and weight
  if (avgCalories < 100) {
    return (
      <div className="pb-24 min-h-screen">
        <div className="bg-white sticky top-0 z-10 px-5 pt-12 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-syne font-bold text-2xl">Insights</h1>
              <p className="text-sm text-gray-400">Last 7 days</p>
            </div>
            <HelpModal title="Insights" description={INSIGHTS_HELP} />
          </div>
        </div>
        <div className="px-5 pt-4 flex flex-col gap-5">
          <DeficiencyAlertsSection />
          <div className="flex flex-col items-center justify-center px-8 py-16 text-center bg-gray-50 rounded-2xl">
            <span className="text-6xl mb-4">📊</span>
            <p className="font-syne font-bold text-xl text-gray-800 mb-2">No data yet</p>
            <p className="text-base text-gray-500 leading-relaxed">
              Log your meals for at least 3 days to start seeing your nutrition trends, calorie charts, and personalised insights here.
            </p>
          </div>
          <WeightProgress />
          <ActivityTrends />
        </div>
      </div>
    );
  }

  const barData = dailyData.map(d => ({
    day:      new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }),
    calories: displayEnergy(d.calories),
    target:   displayEnergy(calorieTarget),
  }));

  const latestDay  = dailyData[dailyData.length - 1];
  const macroTotal = (latestDay?.protein || 0) * 4 + (latestDay?.carbs || 0) * 4 + (latestDay?.fat || 0) * 9;
  const pieData    = macroTotal > 0 ? [
    { name: 'Protein', value: Math.round(((latestDay.protein * 4) / macroTotal) * 100) },
    { name: 'Carbs',   value: Math.round(((latestDay.carbs   * 4) / macroTotal) * 100) },
    { name: 'Fat',     value: Math.round(((latestDay.fat     * 9) / macroTotal) * 100) },
  ] : [];

  return (
    <div className="pb-24 min-h-screen">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 px-5 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-syne font-bold text-2xl">Insights</h1>
            <p className="text-sm text-gray-400">Last 7 days</p>
          </div>
          <HelpModal title="Insights" description={INSIGHTS_HELP} />
        </div>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-5">
        {/* ── Deficiency Alerts ── */}
        <DeficiencyAlertsSection />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-primary-light rounded-2xl p-3.5 text-center">
            <Flame size={20} className="text-primary mx-auto mb-1" />
            <p className="font-syne font-bold text-xl text-primary">{streak}</p>
            <p className="text-xs text-gray-500">Day streak</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-3.5 text-center">
            <Zap size={20} className="text-amber-500 mx-auto mb-1" />
            <p className="font-syne font-bold text-xl text-amber-600">{displayEnergy(avgCalories)}</p>
            <p className="text-xs text-gray-500">Avg {energyLabel}/day</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-3.5 text-center">
            <Droplets size={20} className="text-blue-500 mx-auto mb-1" />
            <p className="font-syne font-bold text-xl text-blue-600">
              {Math.round(dailyData.reduce((s, d) => s + d.water, 0) / 7 * 10) / 10}
            </p>
            <p className="text-xs text-gray-500">Avg glasses/day</p>
          </div>
        </div>

        {/* Calorie bar chart */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="font-semibold text-sm mb-4">Calories this week</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} barSize={28}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                formatter={v => [`${v} kcal`]}
              />
              <Bar dataKey="calories" fill="#4a7c59" radius={[6, 6, 0, 0]}
                label={{ position: 'top', fontSize: 9, fill: '#9ca3af', formatter: v => v > 0 ? v : '' }}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-gray-400">Daily target: {displayEnergy(calorieTarget)} {energyLabel}</span>
          </div>
        </div>

        {/* ── Weight Progress ── */}
        <WeightProgress />

        {/* ── Activity Trends ── */}
        <ActivityTrends />

        {/* Macro pie */}
        {pieData.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="font-semibold text-sm mb-2">Today&apos;s macro split</p>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" label={({ name, value }) => `${name} ${value}%`}
                    labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={v => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Nutrient gaps */}
        {gaps.length > 0 && (
          <div className="bg-red-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown size={16} className="text-red-500" />
              <p className="font-semibold text-sm text-red-700">Nutrient gaps this week</p>
            </div>
            {gaps.map(g => (
              <div key={g.nutrient} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-red-700">{NUTRIENT_LABELS[g.nutrient] || g.nutrient}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-red-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${g.pct}%` }} />
                  </div>
                  <span className="text-xs text-red-500 font-medium w-8">{g.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nutrition wins */}
        {wins.length > 0 && (
          <div className="bg-primary-light rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-primary" />
              <p className="font-semibold text-sm text-primary-dark">Nutrition wins this week</p>
            </div>
            {wins.map(w => (
              <div key={w.nutrient} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-primary-dark">{NUTRIENT_LABELS[w.nutrient] || w.nutrient}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-primary-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(w.pct, 100)}%` }} />
                  </div>
                  <span className="text-xs text-primary font-medium w-8">{Math.min(w.pct, 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Weekly log table */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="font-semibold text-sm">Weekly summary</p>
          </div>
          <div className="divide-y divide-gray-50">
            {dailyData.map(d => (
              <div key={d.date} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-400">{d.loggedMeals} items · {d.water} glasses</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${d.calories === 0 ? 'text-gray-300' : d.calories > calorieTarget ? 'text-amber-500' : 'text-primary'}`}>
                    {displayEnergy(d.calories)} {energyLabel}
                  </p>
                  {d.calories > 0 && (
                    <p className="text-xs text-gray-400">
                      P{Math.round(d.protein)}g C{Math.round(d.carbs)}g F{Math.round(d.fat)}g
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
