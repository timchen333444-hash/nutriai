import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LogOut, Save, User, Target, Activity, Utensils, Scale, X, TrendingDown, TrendingUp, Settings2, Bell, Link2, Unlink, Loader2 } from 'lucide-react';
import HelpModal from '../../components/ui/HelpModal';
import { useUnits } from '../../context/UnitsContext';
import { useAlerts } from '../../context/AlertsContext';

const PROFILE_HELP = `Your profile stores your personal details, health goal, activity level, and dietary preferences. NutriAI uses this information to calculate your daily calorie and macro targets. The more accurate your details, the better your personalised recommendations will be. You can log your weight here to track progress over time.`;

// ── Unit conversion helpers ────────────────────────────────────────────────────
// Base storage is always kg (weight) and cm (height).
// These functions convert for display / input.

/** kg → display string in the given unit system (no label, rounded to 1 dp). */
function kgToDisplay(kg, unitSys) {
  const v = parseFloat(kg);
  if (!v) return '';
  if (unitSys === 'imperial') return (Math.round(v * 2.20462 * 10) / 10).toFixed(1);
  return (Math.round(v * 10) / 10).toFixed(1);
}

/** cm → display string.  Imperial: "5'7\"".  Metric: "170.2". */
function cmToDisplay(cm, unitSys) {
  const v = parseFloat(cm);
  if (!v) return '';
  if (unitSys === 'imperial') {
    const totalIn = v / 2.54;
    const ft = Math.floor(totalIn / 12);
    const inch = Math.round(totalIn % 12);
    return `${ft}'${inch}"`;
  }
  return (Math.round(v * 10) / 10).toFixed(1);
}

/** Parse a display height string → cm (for storage).  Handles "5'7\"", "5 7", or plain cm. */
function displayToCm(str, unitSys) {
  const s = String(str ?? '').trim();
  if (!s) return undefined;
  if (unitSys === 'imperial') {
    const match = s.match(/^(\d+)['\s](\d*)"?$/);
    if (match) {
      const ft   = parseInt(match[1], 10);
      const inch = parseInt(match[2] || '0', 10);
      return Math.round((ft * 12 + inch) * 2.54 * 10) / 10;
    }
    // plain number treated as total inches
    const inches = parseFloat(s);
    return inches ? Math.round(inches * 2.54 * 10) / 10 : undefined;
  }
  return parseFloat(s) || undefined;
}

/** Parse a display weight string → kg (for storage). */
function displayToKg(str, unitSys) {
  const v = parseFloat(str);
  if (!v) return undefined;
  if (unitSys === 'imperial') return Math.round((v / 2.20462) * 10) / 10;
  return v;
}

// ── ─────────────────────────────────────────────────────────────────────────────

const GOALS = [
  { value: 'lose',     label: '📉 Lose Weight' },
  { value: 'maintain', label: '⚖️ Maintain' },
  { value: 'gain',     label: '💪 Gain Muscle' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary',          label: 'Sedentary' },
  { value: 'lightly_active',     label: 'Lightly Active' },
  { value: 'moderately_active',  label: 'Moderately Active' },
  { value: 'very_active',        label: 'Very Active' },
  { value: 'extra_active',       label: 'Extra Active' },
];

const RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free',
  'Nut-Free', 'Low-Carb', 'Keto', 'Paleo', 'Halal', 'Kosher',
];

// ── Log Weight Modal ──────────────────────────────────────────────────────────

function LogWeightModal({ isOpen, onClose, unit, onSaved }) {
  const [weight,  setWeight]  = useState('');
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const toast = useToast();

  // Reset when opened
  useEffect(() => {
    if (isOpen) { setWeight(''); setNotes(''); }
  }, [isOpen]);

  const handleSave = async () => {
    if (!weight || isNaN(Number(weight)) || Number(weight) <= 0) {
      toast.error('Enter a valid weight');
      return;
    }
    setSaving(true);
    try {
      const { data } = await axios.post('/api/weight', {
        weight: Number(weight),
        unit,
        notes,
      });
      toast.success('Weight logged!');
      onSaved(data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-primary" />
            <p className="font-syne font-bold text-base">Log Today&apos;s Weight</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Weight ({unit})
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="500"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
              placeholder={unit === 'kg' ? 'e.g. 74.5' : 'e.g. 164.2'}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. After morning workout"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Weight'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Weight unit normalisation (mirrors Insights helper) ──────────────────────
// Entries logged before the kg-only storage fix may be stored in lbs with
// unit='imperial'. Normalise to kg before passing to displayWeight.
function logWeightToKg(log) {
  if (!log) return null;
  const u = (log.unit || 'kg').toLowerCase();
  if (u === 'lbs' || u === 'imperial') return log.weight / 2.20462;
  return log.weight;
}

// ── Main Profile page ─────────────────────────────────────────────────────────

// ── Segmented control for a single unit preference ───────────────────────────

function UnitToggle({ label, value, options, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => value !== opt.value && onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              value === opt.value
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Profile page ─────────────────────────────────────────────────────────

// ── Alert settings toggle row ─────────────────────────────────────────────────

function AlertToggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 leading-snug">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5 leading-snug">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex-shrink-0 relative inline-flex w-11 h-6 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-0.5 ${
          checked ? 'bg-primary' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// ── Connected Apps section ────────────────────────────────────────────────────

function ConnectedApps() {
  const [googleStatus,  setGoogleStatus]  = useState(null); // null=loading, else {isConnected,lastSyncedAt}
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const toast = useToast();

  useEffect(() => {
    axios.get('/api/integrations/status')
      .then(r => setGoogleStatus(r.data.google_fit || { isConnected: false }))
      .catch(() => setGoogleStatus({ isConnected: false }));

    // Handle redirect params from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('fitness_connected') === 'google') {
      toast.success('Google Fit connected!');
      setGoogleStatus({ isConnected: true, lastSyncedAt: null });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('fitness_error')) {
      toast.error(`Google Fit error: ${params.get('fitness_error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await axios.delete('/api/integrations/google/disconnect');
      setGoogleStatus({ isConnected: false });
      toast.success('Google Fit disconnected');
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.get('/api/integrations/google/sync');
      const r = await axios.get('/api/integrations/status');
      setGoogleStatus(r.data.google_fit || { isConnected: false });
      toast.success('Synced with Google Fit');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const lastSync = googleStatus?.lastSyncedAt
    ? new Date(googleStatus.lastSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-primary" />
        <p className="font-semibold text-sm">Connected Apps</p>
      </div>

      {/* Google Fit card */}
      <div className="border border-gray-100 rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">🏃</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Google Fit</p>
              {googleStatus === null && <p className="text-xs text-gray-400">Checking…</p>}
              {googleStatus?.isConnected
                ? <p className="text-xs text-green-600 font-medium">Connected{lastSync ? ` · Synced ${lastSync}` : ''}</p>
                : googleStatus && <p className="text-xs text-gray-400">Not connected</p>}
            </div>
          </div>
          {googleStatus?.isConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-xs text-primary font-semibold hover:text-primary-dark transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : 'Sync now'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
              >
                <Unlink size={12} />
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            googleStatus !== null && (
              <a
                href="/api/integrations/google/auth"
                className="flex items-center gap-1 text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Link2 size={12} /> Connect
              </a>
            )
          )}
        </div>
      </div>

      {/* Apple Health card */}
      <div className="border border-gray-100 rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">🍎</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Apple Health</p>
              <p className="text-xs text-gray-400">Import via file export</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 font-medium">On Today page</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-snug">
        Activity data is used to show net calories on your daily ring and step trends on Insights.
      </p>
    </div>
  );
}

// ── Main Profile page ─────────────────────────────────────────────────────────

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const { units, saveUnits, displayWeight, weightLabel } = useUnits();
  const { fetchAlerts } = useAlerts();
  const toast = useToast();

  // Alert settings state (null = never configured)
  const DEFAULT_ALERT_SETTINGS = {
    deficiencyAlerts: false,
    dailySummary:     false,
    streakWarnings:   false,
    foodSuggestions:  false,
    weeklyReport:     false,
  };
  const [alertSettings, setAlertSettings] = useState(
    user?.alertSettings ?? DEFAULT_ALERT_SETTINGS
  );
  const [savingAlerts, setSavingAlerts] = useState(false);

  const initUnits = user?.units || 'metric';
  const [form, setForm] = useState({
    name:                user?.name                || '',
    age:                 user?.age                 || '',
    sex:                 user?.sex                 || 'male',
    // height and weight are stored in DISPLAY units (what the user sees / types)
    // and converted back to cm/kg on save.
    height:              cmToDisplay(user?.height, initUnits),
    weight:              kgToDisplay(user?.weight, initUnits),
    goal:                user?.goal                || 'maintain',
    activityLevel:       user?.activityLevel       || 'moderately_active',
    dietaryRestrictions: user?.dietaryRestrictions || [],
    units:               initUnits,
  });
  const [saving, setSaving] = useState(false);

  // Weight log state
  const [showWeightModal, setShowWeightModal]   = useState(false);
  const [latestWeightLog, setLatestWeightLog]   = useState(null);

  // Fetch most recent weight entry on mount
  useEffect(() => {
    axios.get('/api/weight?range=7d')
      .then(r => {
        if (r.data.length > 0) setLatestWeightLog(r.data[r.data.length - 1]);
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleRestriction = (r) =>
    set('dietaryRestrictions', form.dietaryRestrictions.includes(r)
      ? form.dietaryRestrictions.filter(x => x !== r)
      : [...form.dietaryRestrictions, r]);

  const handleAlertToggle = async (key, value) => {
    const next = { ...alertSettings, [key]: value };
    // If master toggle is turned off, disable all sub-toggles
    if (key === 'deficiencyAlerts' && !value) {
      next.dailySummary    = false;
      next.streakWarnings  = false;
      next.foodSuggestions = false;
      next.weeklyReport    = false;
    }
    setAlertSettings(next);
    setSavingAlerts(true);
    try {
      const { data } = await axios.put('/api/alerts/settings', { settings: next });
      updateUser({ alertSettings: data.settings });
      fetchAlerts();
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Unknown error';
      console.error('[AlertToggle] Save failed — status:', e.response?.status, '| error:', msg, e);
      toast.error('Could not save alert settings');
      setAlertSettings(alertSettings); // revert
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // form.height / form.weight are in display units — convert back to base (cm / kg)
      const heightCm = displayToCm(form.height, form.units);
      const weightKg = displayToKg(form.weight, form.units);
      const { data } = await axios.put('/api/auth/profile', {
        ...form,
        age:    parseInt(form.age) || undefined,
        height: heightCm,
        weight: weightKg,
      });
      updateUser(data);
      toast.success('Profile updated!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleWeightSaved = (log) => {
    setLatestWeightLog(log);
  };

  // Determine trend vs profile weight.
  // profileWeight is already in the user's display unit (kgToDisplay was used on load).
  // loggedWeight: normalise stored kg value → display unit so both are comparable.
  const profileWeight = parseFloat(form.weight) || null;
  const loggedWeight  = latestWeightLog ? displayWeight(logWeightToKg(latestWeightLog)) : null;
  const weightDelta = (profileWeight && loggedWeight)
    ? Math.round((loggedWeight - profileWeight) * 10) / 10
    : null;

  return (
    <div className="pb-24 min-h-screen">
      {/* Sticky header */}
      <div className="bg-white sticky top-0 z-10 px-5 pt-12 pb-4 border-b border-gray-100 flex items-center justify-between">
        <h1 className="font-syne font-bold text-2xl">Profile</h1>
        <div className="flex items-center gap-2">
          <HelpModal title="Profile" description={PROFILE_HELP} />
          <button
            onClick={logout}
            aria-label="Sign out"
            className="flex items-center gap-1.5 text-sm text-red-500 font-semibold hover:text-red-700 transition-colors px-2 py-1"
          >
            <LogOut size={16} />Sign out
          </button>
        </div>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-5">

        {/* Targets + latest weight summary */}
        <div className="bg-primary rounded-2xl p-4 text-white">
          <div className="flex items-start justify-between mb-3">
            <p className="font-syne font-bold text-xl">{user?.name}</p>
            {/* Latest weight badge */}
            {loggedWeight && (
              <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-xl">
                <Scale size={13} className="opacity-80" />
                <span className="text-sm font-bold">
                  {loggedWeight.toFixed(1)} {weightLabel}
                </span>
                {weightDelta !== null && weightDelta !== 0 && (
                  <span className={`text-xs font-medium ml-0.5 flex items-center gap-0.5 ${weightDelta < 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {weightDelta < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                    {weightDelta > 0 ? '+' : ''}{Math.abs(weightDelta).toFixed(1)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { l: 'Calories', v: user?.calorieTarget || '—' },
              { l: 'Protein',  v: user?.proteinTarget ? `${user.proteinTarget}g` : '—' },
              { l: 'Carbs',    v: user?.carbTarget    ? `${user.carbTarget}g`    : '—' },
              { l: 'Fat',      v: user?.fatTarget     ? `${user.fatTarget}g`     : '—' },
            ].map(m => (
              <div key={m.l}>
                <p className="font-bold text-lg">{m.v}</p>
                <p className="text-xs opacity-60">{m.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Log weight button */}
        <button
          onClick={() => setShowWeightModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border-2 border-primary text-primary font-semibold py-3.5 rounded-2xl hover:bg-primary-light transition-all"
        >
          <Scale size={18} />Log Today&apos;s Weight
        </button>

        {/* Personal info */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <User size={16} className="text-primary" />
            <p className="font-semibold text-sm">Personal info</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            {['metric', 'imperial'].map(u => (
              <button key={u} onClick={() => {
                if (u === form.units) return;
                // Convert current display values to base, then to the new unit
                const cm = displayToCm(form.height, form.units);
                const kg = displayToKg(form.weight, form.units);
                setForm(f => ({
                  ...f,
                  units:  u,
                  height: cmToDisplay(cm, u),
                  weight: kgToDisplay(kg, u),
                }));
              }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${form.units === u ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>
                {u === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lb/ft)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Age</label>
              <input type="number" value={form.age} onChange={e => set('age', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="25" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Sex</label>
              <div className="flex gap-1.5">
                {['male', 'female'].map(s => (
                  <button key={s} onClick={() => set('sex', s)}
                    className={`flex-1 py-3 rounded-xl text-xs font-medium border-2 transition-all ${form.sex === s ? 'border-primary bg-primary-light text-primary' : 'border-gray-200'}`}>
                    {s === 'male' ? '♂ Male' : '♀ Female'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Height {form.units === 'metric' ? '(cm)' : '(ft & in)'}
              </label>
              {/* text input to accept both "5'7\"" and "170.2" */}
              <input
                type="text"
                inputMode="text"
                value={form.height}
                onChange={e => set('height', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={form.units === 'metric' ? '175.0' : "5'10\""}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Weight ({form.units === 'metric' ? 'kg' : 'lbs'})
              </label>
              <input
                type="number"
                step="0.1"
                value={form.weight}
                onChange={e => set('weight', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={form.units === 'metric' ? '70.0' : '154.0'}
              />
            </div>
          </div>
        </div>

        {/* Units & Display */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-primary" />
            <p className="font-semibold text-sm">Units &amp; Display</p>
          </div>

          <div className="flex flex-col gap-3 divide-y divide-gray-50">
            <div className="flex flex-col gap-3 pb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Weight &amp; Body</p>
              <UnitToggle label="Weight" value={units.weightUnit}
                options={[{ value: 'lbs', label: 'lbs' }, { value: 'kg', label: 'kg' }]}
                onChange={v => saveUnits({ weightUnit: v, ...(v === 'kg' ? { units: 'metric' } : { units: 'imperial' }) })} />
              <UnitToggle label="Height" value={units.heightUnit}
                options={[{ value: 'ft', label: 'ft & in' }, { value: 'cm', label: 'cm' }]}
                onChange={v => saveUnits({ heightUnit: v })} />
            </div>

            <div className="flex flex-col gap-3 pt-3 pb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Food &amp; Nutrition</p>
              <UnitToggle label="Energy" value={units.energyUnit}
                options={[{ value: 'kcal', label: 'kcal' }, { value: 'kJ', label: 'kJ' }]}
                onChange={v => saveUnits({ energyUnit: v })} />
              <UnitToggle label="Water" value={units.waterUnit}
                options={[{ value: 'floz', label: 'fl oz' }, { value: 'ml', label: 'ml' }]}
                onChange={v => saveUnits({ waterUnit: v })} />
            </div>

            <div className="flex flex-col gap-3 pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Display</p>
              <UnitToggle label="Date format" value={units.dateFormat}
                options={[{ value: 'MM/DD/YYYY', label: 'MM/DD' }, { value: 'DD/MM/YYYY', label: 'DD/MM' }]}
                onChange={v => saveUnits({ dateFormat: v })} />
              <UnitToggle label="Week starts" value={units.firstDayOfWeek}
                options={[{ value: 'sunday', label: 'Sun' }, { value: 'monday', label: 'Mon' }]}
                onChange={v => saveUnits({ firstDayOfWeek: v })} />
            </div>
          </div>
        </div>

        {/* Goal */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-primary" />
            <p className="font-semibold text-sm">Goal</p>
          </div>
          <div className="flex flex-col gap-2">
            {GOALS.map(g => (
              <button key={g.value} onClick={() => set('goal', g.value)}
                className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${form.goal === g.value ? 'border-primary bg-primary-light' : 'border-gray-100'}`}>
                <span className="text-sm font-medium">{g.label}</span>
                {form.goal === g.value && <span className="text-primary">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            <p className="font-semibold text-sm">Activity level</p>
          </div>
          <select value={form.activityLevel} onChange={e => set('activityLevel', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
            {ACTIVITY_LEVELS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {/* Dietary restrictions */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Utensils size={16} className="text-primary" />
            <p className="font-semibold text-sm">Dietary restrictions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RESTRICTIONS.map(r => (
              <button key={r} onClick={() => toggleRestriction(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                  form.dietaryRestrictions.includes(r)
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 text-gray-600'
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications & Alerts */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-primary" />
              <p className="font-semibold text-sm">Notifications &amp; Alerts</p>
            </div>
            {savingAlerts && (
              <span className="text-[10px] text-gray-400 animate-pulse">Saving…</span>
            )}
          </div>

          <AlertToggle
            label="Deficiency Alerts"
            description="Master switch — enables all nutrition alerts"
            checked={alertSettings.deficiencyAlerts}
            onChange={v => handleAlertToggle('deficiencyAlerts', v)}
          />

          <div className={`pl-3 border-l-2 border-gray-100 flex flex-col transition-opacity duration-200 ${
            alertSettings.deficiencyAlerts ? 'opacity-100' : 'opacity-40 pointer-events-none'
          }`}>
            <AlertToggle
              label="Daily nutrient summary"
              description="Shows end-of-day gaps in your nutrition"
              checked={alertSettings.dailySummary}
              onChange={v => handleAlertToggle('dailySummary', v)}
            />
            <AlertToggle
              label="Streak warnings"
              description="Warns after 3+ days of the same deficiency"
              checked={alertSettings.streakWarnings}
              onChange={v => handleAlertToggle('streakWarnings', v)}
            />
            <AlertToggle
              label="Food suggestions"
              description="Shows food recommendations to fix nutrient gaps"
              checked={alertSettings.foodSuggestions}
              onChange={v => handleAlertToggle('foodSuggestions', v)}
            />
            <AlertToggle
              label="Weekly deficiency report"
              description="Summary every Sunday with a personalised tip"
              checked={alertSettings.weeklyReport}
              onChange={v => handleAlertToggle('weeklyReport', v)}
            />
          </div>
        </div>

        {/* Connected Apps */}
        <ConnectedApps />

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-4 rounded-2xl hover:bg-primary-dark disabled:opacity-60 transition-colors">
          <Save size={18} />
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        {/* Account info */}
        <div className="bg-gray-50 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-400">{user?.email}</p>
          <p className="text-xs text-gray-300 mt-1">NutriAI v1.0 · Powered by Claude AI</p>
        </div>
      </div>

      {/* Log Weight Modal */}
      <LogWeightModal
        isOpen={showWeightModal}
        onClose={() => setShowWeightModal(false)}
        unit={units.weightUnit}
        onSaved={handleWeightSaved}
      />
    </div>
  );
}
