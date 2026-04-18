import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Footprints, Flame, Timer, RefreshCw, Link2, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';

const STEP_GOAL = 10_000;

// Parse Apple Health export.xml entirely in the browser so we never upload a
// potentially huge raw file to the backend — only the aggregated summary goes up.
function parseAppleHealthXML(xmlText) {
  const parser  = new DOMParser();
  const doc     = parser.parseFromString(xmlText, 'text/xml');
  const records = doc.querySelectorAll('Record');
  const byDate  = {};

  for (const rec of records) {
    const type      = rec.getAttribute('type');
    const value     = parseFloat(rec.getAttribute('value')) || 0;
    const startDate = rec.getAttribute('startDate') || rec.getAttribute('creationDate');
    if (!startDate || !value) continue;

    const date = startDate.slice(0, 10); // YYYY-MM-DD
    if (!byDate[date]) byDate[date] = { date, steps: 0, caloriesBurned: 0, activeMinutes: 0, distanceKm: 0, hrReadings: [] };
    const d = byDate[date];

    if      (type === 'HKQuantityTypeIdentifierStepCount')              d.steps          += Math.round(value);
    else if (type === 'HKQuantityTypeIdentifierActiveEnergyBurned')     d.caloriesBurned += Math.round(value);
    else if (type === 'HKQuantityTypeIdentifierBasalEnergyBurned')      d.caloriesBurned += Math.round(value);
    else if (type === 'HKQuantityTypeIdentifierAppleExerciseTime')      d.activeMinutes  += Math.round(value);
    else if (type === 'HKQuantityTypeIdentifierDistanceWalkingRunning') {
      const unit = rec.getAttribute('unit');
      d.distanceKm += unit === 'mi' ? value * 1.60934 : value;
    }
    else if (type === 'HKQuantityTypeIdentifierHeartRate')              d.hrReadings.push(value);
  }

  return Object.values(byDate).map(d => ({
    date:          d.date,
    steps:         d.steps,
    caloriesBurned: Math.round(d.caloriesBurned),
    activeMinutes: d.activeMinutes,
    distanceKm:    Math.round(d.distanceKm * 100) / 100,
    heartRateAvg:  d.hrReadings.length ? Math.round(d.hrReadings.reduce((a, b) => a + b, 0) / d.hrReadings.length) : null,
  }));
}

export default function ActivityTracker({ onCaloriesBurnedChange }) {
  const [fitness,         setFitness]         = useState(null);
  const [integration,     setIntegration]     = useState(null);
  const [syncing,         setSyncing]         = useState(false);
  const [showManual,      setShowManual]      = useState(false);
  const [showApple,       setShowApple]       = useState(false);
  const [importing,       setImporting]       = useState(false);
  const [importSummary,   setImportSummary]   = useState(null);
  const [manualForm,      setManualForm]      = useState({ steps: '', caloriesBurned: '', activeMinutes: '' });
  const fileRef = useRef(null);
  const toast   = useToast();
  const todayDate = new Date().toISOString().slice(0, 10);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [fitRes, intRes] = await Promise.allSettled([
        axios.get('/api/fitness/today'),
        axios.get('/api/integrations/status'),
      ]);
      if (fitRes.status === 'fulfilled') {
        setFitness(fitRes.value.data);
        onCaloriesBurnedChange?.(fitRes.value.data.caloriesBurned || 0);
      }
      if (intRes.status === 'fulfilled') {
        setIntegration(intRes.value.data.google_fit || { isConnected: false });
      }
    } catch {}
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.get('/api/integrations/google/sync');
      await fetchAll();
      toast.success('Synced with Google Fit');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSave = async () => {
    try {
      await axios.post('/api/fitness/manual', {
        steps:          parseInt(manualForm.steps)          || 0,
        caloriesBurned: parseFloat(manualForm.caloriesBurned) || 0,
        activeMinutes:  parseInt(manualForm.activeMinutes)  || 0,
        date: todayDate,
      });
      await fetchAll();
      setShowManual(false);
      setManualForm({ steps: '', caloriesBurned: '', activeMinutes: '' });
      toast.success('Activity logged!');
    } catch {
      toast.error('Failed to save activity');
    }
  };

  const handleAppleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const text    = await file.text();
      const records = parseAppleHealthXML(text);
      if (!records.length) { toast.error('No fitness data found in the file'); return; }

      const { data } = await axios.post('/api/fitness/apple-health', { records });
      await fetchAll();
      setImportSummary(data);
    } catch {
      toast.error('Import failed — make sure you selected export.xml');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const steps   = fitness?.steps         || 0;
  const burned  = Math.round(fitness?.caloriesBurned || 0);
  const active  = fitness?.activeMinutes || 0;
  const stepPct = Math.min((steps / STEP_GOAL) * 100, 100);

  const lastSyncLabel = integration?.lastSyncedAt
    ? new Date(integration.lastSyncedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Footprints size={16} className="text-primary" />
          <p className="font-semibold text-sm">Activity</p>
          {integration?.isConnected && (
            <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Google Fit
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {integration?.isConnected ? (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:text-primary-dark transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          ) : (
            <a
              href="/api/integrations/google/auth"
              className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors"
            >
              <Link2 size={12} /> Connect Google Fit
            </a>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Steps',      value: steps.toLocaleString(),   color: 'text-gray-900'  },
            { label: 'Burned',     value: `${burned} kcal`,          color: 'text-amber-500' },
            { label: 'Active min', value: String(active),            color: 'text-blue-500'  },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`font-syne font-bold text-xl ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Step progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>{steps.toLocaleString()} steps</span>
            <span>Goal: {STEP_GOAL.toLocaleString()}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${stepPct}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 text-right mt-1">{Math.round(stepPct)}% of daily goal</p>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          {lastSyncLabel
            ? <p className="text-[10px] text-gray-300">Synced {lastSyncLabel}</p>
            : <span />}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowApple(true)}
              className="text-xs text-gray-400 hover:text-primary transition-colors font-medium"
            >
              Apple Health
            </button>
            <span className="text-gray-200 text-xs">·</span>
            <button
              onClick={() => setShowManual(true)}
              className="text-xs text-gray-400 hover:text-primary transition-colors font-medium"
            >
              Enter manually
            </button>
          </div>
        </div>
      </div>

      {/* ── Manual entry modal ── */}
      <Modal isOpen={showManual} onClose={() => setShowManual(false)} title="Log Activity Manually">
        <div className="p-5 flex flex-col gap-4">
          {[
            { key: 'steps',          label: 'Steps',            placeholder: 'e.g. 8 500' },
            { key: 'caloriesBurned', label: 'Calories burned',  placeholder: 'e.g. 320'   },
            { key: 'activeMinutes',  label: 'Active minutes',   placeholder: 'e.g. 45'    },
          ].map(f => (
            <div key={f.key}>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">{f.label}</label>
              <input
                type="number"
                inputMode="numeric"
                value={manualForm[f.key]}
                onChange={e => setManualForm(m => ({ ...m, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          ))}
          <button
            onClick={handleManualSave}
            className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl hover:bg-primary-dark transition-colors"
          >
            Save Activity
          </button>
        </div>
      </Modal>

      {/* ── Apple Health import modal ── */}
      <Modal isOpen={showApple} onClose={() => { setShowApple(false); setImportSummary(null); }} title="Import from Apple Health">
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-blue-50 rounded-2xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-2">How to export Apple Health data</p>
            <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside leading-snug">
              <li>Open the <strong>Health</strong> app on your iPhone</li>
              <li>Tap your profile picture in the top-right corner</li>
              <li>Scroll down and tap <strong>Export All Health Data</strong></li>
              <li>Share the ZIP to your computer, unzip it</li>
              <li>Select the <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800">export.xml</code> file below</li>
            </ol>
          </div>

          <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleAppleFile} />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-500 hover:border-primary hover:text-primary transition-all disabled:opacity-60"
          >
            {importing
              ? <><Loader2 size={16} className="animate-spin" /> Importing…</>
              : 'Select export.xml file'}
          </button>

          {importSummary && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700 font-medium">
              Imported {importSummary.imported} day{importSummary.imported !== 1 ? 's' : ''} of fitness data
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Data is parsed locally in your browser and stored only in your NutriAI account.
          </p>
        </div>
      </Modal>
    </div>
  );
}
