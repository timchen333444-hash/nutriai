import { useState } from 'react';
import axios from 'axios';
import { Plus, X, Loader2, ChevronLeft, Pill } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';

// ── Preset supplements ─────────────────────────────────────────────────────────
// nutrients structure mirrors NutritionAccordion's totals:
// { vitamins:{...}, minerals:{...}, aminoAcids:{...}, fattyAcids:{...} }
// Values are in the same units as DRV table (mg/mcg/g per unit).

export const SUPPLEMENT_PRESETS = [
  {
    name: 'Vitamin D3 1000 IU',
    brand: 'Generic',
    dosage: 1000, dosageUnit: 'IU',
    emoji: '☀️',
    keyNutrient: '25 mcg Vitamin D',
    nutrients: { vitamins: { vitaminD: 25 } },
  },
  {
    name: 'Vitamin D3 2000 IU',
    brand: 'Generic',
    dosage: 2000, dosageUnit: 'IU',
    emoji: '☀️',
    keyNutrient: '50 mcg Vitamin D',
    nutrients: { vitamins: { vitaminD: 50 } },
  },
  {
    name: 'Vitamin C 500mg',
    brand: 'Generic',
    dosage: 500, dosageUnit: 'mg',
    emoji: '🍊',
    keyNutrient: '500 mg Vitamin C',
    nutrients: { vitamins: { vitaminC: 500 } },
  },
  {
    name: 'Vitamin C 1000mg',
    brand: 'Generic',
    dosage: 1000, dosageUnit: 'mg',
    emoji: '🍊',
    keyNutrient: '1,000 mg Vitamin C',
    nutrients: { vitamins: { vitaminC: 1000 } },
  },
  {
    name: 'Magnesium Glycinate 400mg',
    brand: 'Generic',
    dosage: 400, dosageUnit: 'mg',
    emoji: '💎',
    keyNutrient: '~65 mg elemental Mg',
    nutrients: { minerals: { magnesium: 65 } },
  },
  {
    name: 'Zinc 25mg',
    brand: 'Generic',
    dosage: 25, dosageUnit: 'mg',
    emoji: '🔵',
    keyNutrient: '25 mg Zinc',
    nutrients: { minerals: { zinc: 25 } },
  },
  {
    name: 'Omega-3 Fish Oil 1000mg',
    brand: 'Generic',
    dosage: 1000, dosageUnit: 'mg',
    emoji: '🐟',
    keyNutrient: '~300 mg EPA+DHA',
    nutrients: { fattyAcids: { omega3: 0.3 } },
  },
  {
    name: 'Iron 18mg',
    brand: 'Generic',
    dosage: 18, dosageUnit: 'mg',
    emoji: '🩸',
    keyNutrient: '18 mg Iron',
    nutrients: { minerals: { iron: 18 } },
  },
  {
    name: 'Folate 400mcg',
    brand: 'Generic',
    dosage: 400, dosageUnit: 'mcg',
    emoji: '🟢',
    keyNutrient: '400 mcg Folate',
    nutrients: { vitamins: { folate: 400 } },
  },
  {
    name: 'Vitamin B12 500mcg',
    brand: 'Generic',
    dosage: 500, dosageUnit: 'mcg',
    emoji: '⚡',
    keyNutrient: '500 mcg B12',
    nutrients: { vitamins: { vitaminB12: 500 } },
  },
  {
    name: 'Multivitamin Men',
    brand: 'Generic',
    dosage: 1, dosageUnit: 'tablet',
    emoji: '💊',
    keyNutrient: 'Daily vitamins + minerals',
    nutrients: {
      vitamins: {
        vitaminA: 900, vitaminC: 90, vitaminD: 20, vitaminE: 22,
        vitaminK: 120, thiamine: 1.5, riboflavin: 1.7, niacin: 20,
        pantothenicAcid: 10, vitaminB6: 2, biotin: 30, folate: 400, vitaminB12: 6,
      },
      minerals: {
        calcium: 200, iron: 8, magnesium: 50, zinc: 11, selenium: 55,
        copper: 0.9, manganese: 2.3, chromium: 35, molybdenum: 45,
      },
    },
  },
  {
    name: 'Multivitamin Women',
    brand: 'Generic',
    dosage: 1, dosageUnit: 'tablet',
    emoji: '💊',
    keyNutrient: 'Daily vitamins + minerals',
    nutrients: {
      vitamins: {
        vitaminA: 700, vitaminC: 90, vitaminD: 20, vitaminE: 22,
        vitaminK: 90, thiamine: 1.1, riboflavin: 1.1, niacin: 14,
        pantothenicAcid: 5, vitaminB6: 1.3, biotin: 30, folate: 800, vitaminB12: 6,
      },
      minerals: {
        calcium: 500, iron: 18, magnesium: 50, zinc: 8, selenium: 55,
        copper: 0.9, manganese: 1.8, chromium: 25, molybdenum: 45,
      },
    },
  },
  {
    name: 'Calcium 500mg',
    brand: 'Generic',
    dosage: 500, dosageUnit: 'mg',
    emoji: '🦴',
    keyNutrient: '500 mg Calcium',
    nutrients: { minerals: { calcium: 500 } },
  },
  {
    name: 'Vitamin K2 100mcg',
    brand: 'Generic',
    dosage: 100, dosageUnit: 'mcg',
    emoji: '🩸',
    keyNutrient: '100 mcg Vitamin K2',
    nutrients: { vitamins: { vitaminK: 100 } },
  },
  {
    name: 'Creatine 5g',
    brand: 'Generic',
    dosage: 5, dosageUnit: 'g',
    emoji: '💪',
    keyNutrient: 'Performance / muscle',
    nutrients: {},
  },
  {
    name: 'Whey Protein 30g',
    brand: 'Generic',
    dosage: 30, dosageUnit: 'g',
    emoji: '🥛',
    keyNutrient: '~24g protein + BCAAs',
    nutrients: {
      aminoAcids: {
        histidine: 0.5, isoleucine: 1.6, leucine: 2.9, lysine: 2.4,
        methionine: 0.5, phenylalanine: 0.7, threonine: 1.0, tryptophan: 0.4,
        valine: 1.6, alanine: 1.2, arginine: 0.5, aspartate: 2.7,
        cysteine: 0.5, glutamate: 4.2, glycine: 0.4, proline: 1.4,
        serine: 1.2, tyrosine: 0.7,
      },
    },
  },
  {
    name: 'Collagen Peptides 10g',
    brand: 'Generic',
    dosage: 10, dosageUnit: 'g',
    emoji: '✨',
    keyNutrient: 'Glycine + Proline',
    nutrients: {
      aminoAcids: {
        glycine: 2.6, proline: 1.2, alanine: 0.9,
        arginine: 0.8, glutamate: 1.0, serine: 0.3,
      },
    },
  },
  {
    name: 'Probiotic 10B CFU',
    brand: 'Generic',
    dosage: 10, dosageUnit: 'B CFU',
    emoji: '🦠',
    keyNutrient: '10 Billion live cultures',
    nutrients: {},
  },
  {
    name: 'Ashwagandha 600mg',
    brand: 'Generic',
    dosage: 600, dosageUnit: 'mg',
    emoji: '🌿',
    keyNutrient: 'Adaptogen / stress',
    nutrients: {},
  },
  {
    name: 'Magnesium L-Threonate 144mg',
    brand: 'Generic',
    dosage: 144, dosageUnit: 'mg',
    emoji: '🧠',
    keyNutrient: '144 mg elemental Mg',
    nutrients: { minerals: { magnesium: 144 } },
  },
];

const DOSE_UNITS = ['mg', 'mcg', 'g', 'IU', 'ml', 'tablet', 'capsule', 'B CFU'];

// ── Supplement chip ────────────────────────────────────────────────────────────

function SupplementChip({ log, onRemove, removing }) {
  return (
    <div className="flex items-center gap-1.5 bg-primary-light border border-primary/20 rounded-full pl-3 pr-2 py-1.5">
      <span className="text-xs font-semibold text-primary-dark leading-none">
        {log.name}
      </span>
      <span className="text-[10px] text-primary/70 leading-none">
        {log.dosage}{log.dosageUnit}
      </span>
      <button
        onClick={onRemove}
        disabled={removing}
        className="ml-0.5 text-primary/50 hover:text-red-400 transition-colors disabled:opacity-40"
      >
        {removing
          ? <Loader2 size={11} className="animate-spin" />
          : <X size={11} />}
      </button>
    </div>
  );
}

// ── Preset card ────────────────────────────────────────────────────────────────

function PresetCard({ preset, onSelect, adding }) {
  return (
    <button
      onClick={() => onSelect(preset)}
      disabled={adding}
      className="flex items-start gap-3 bg-white border border-gray-100 rounded-2xl p-3 text-left hover:border-primary hover:bg-primary-light transition-all disabled:opacity-60 w-full"
    >
      <span className="text-2xl flex-shrink-0 mt-0.5">{preset.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 leading-tight">{preset.name}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{preset.keyNutrient}</p>
      </div>
      {adding && <Loader2 size={14} className="animate-spin text-primary flex-shrink-0 mt-1" />}
    </button>
  );
}

// ── Custom entry form ──────────────────────────────────────────────────────────

function CustomForm({ onBack, onSave, saving }) {
  const [name,       setName]       = useState('');
  const [brand,      setBrand]      = useState('');
  const [dosage,     setDosage]     = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [notes,      setNotes]      = useState('');
  const toast = useToast();

  const handleSave = () => {
    if (!name.trim()) { toast.error('Enter a supplement name'); return; }
    onSave({ name: name.trim(), brand: brand.trim(), dosage: parseFloat(dosage) || 0, dosageUnit, nutrients: {}, notes: notes.trim() });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-700 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <p className="font-syne font-semibold text-base">Custom Supplement</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Supplement Name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CoQ10"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Brand <span className="text-gray-300 font-normal normal-case">(optional)</span>
          </label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Nature Made"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Dosage
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. 200"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="w-32 flex-shrink-0">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Unit
            </label>
            <select
              value={dosageUnit}
              onChange={(e) => setDosageUnit(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Notes <span className="text-gray-300 font-normal normal-case">(optional)</span>
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. with food"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3.5 rounded-2xl hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {saving
            ? <><Loader2 size={18} className="animate-spin" />Logging…</>
            : <><Plus size={18} />Log Supplement</>}
        </button>
      </div>
    </div>
  );
}

// ── Main SupplementTracker ─────────────────────────────────────────────────────

export default function SupplementTracker({ supplements, onAdd, onRemove }) {
  const toast = useToast();

  const [modalOpen,  setModalOpen]  = useState(false);
  const [view,       setView]       = useState('presets'); // 'presets' | 'custom'
  const [addingName, setAddingName] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [saving,     setSaving]     = useState(false);

  const logSupplement = async (payload) => {
    try {
      await axios.post('/api/supplements/log', payload);
      onAdd();
      setModalOpen(false);
      setView('presets');
      toast.success(`${payload.name} logged`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to log supplement');
    }
  };

  const handlePreset = async (preset) => {
    setAddingName(preset.name);
    await logSupplement({
      name:       preset.name,
      brand:      preset.brand,
      dosage:     preset.dosage,
      dosageUnit: preset.dosageUnit,
      nutrients:  preset.nutrients,
      notes:      '',
    });
    setAddingName(null);
  };

  const handleCustom = async (payload) => {
    setSaving(true);
    await logSupplement(payload);
    setSaving(false);
  };

  const handleRemove = async (id) => {
    setRemovingId(id);
    try {
      await axios.delete(`/api/supplements/log/${id}`);
      onRemove(id);
    } catch {
      toast.error('Failed to remove supplement');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pill size={15} className="text-primary" />
            <h3 className="font-syne font-bold text-sm text-gray-900">Supplements</h3>
          </div>
          <button
            onClick={() => { setView('presets'); setModalOpen(true); }}
            className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary-light px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-all"
          >
            <Plus size={12} />Add
          </button>
        </div>

        {/* Logged supplement chips */}
        {supplements.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {supplements.map((s) => (
              <SupplementChip
                key={s.id}
                log={s}
                onRemove={() => handleRemove(s.id)}
                removing={removingId === s.id}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">None logged today — tap Add to track your supplements</p>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setView('presets'); }}
        title={view === 'presets' ? 'Add Supplement' : null}
        fullHeight
      >
        {/* ── Custom form ── */}
        {view === 'custom' && (
          <CustomForm
            onBack={() => setView('presets')}
            onSave={handleCustom}
            saving={saving}
          />
        )}

        {/* ── Preset grid ── */}
        {view === 'presets' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-2.5">
                {SUPPLEMENT_PRESETS.map((preset) => (
                  <PresetCard
                    key={preset.name}
                    preset={preset}
                    onSelect={handlePreset}
                    adding={addingName === preset.name}
                  />
                ))}
              </div>
            </div>

            {/* Custom entry footer */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setView('custom')}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-3 text-sm text-gray-400 hover:border-primary hover:text-primary transition-all font-medium"
              >
                <Plus size={15} />Enter a custom supplement
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
