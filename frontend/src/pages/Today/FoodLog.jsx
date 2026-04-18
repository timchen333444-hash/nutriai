import { useState } from 'react';
import axios from 'axios';
import { Trash2, ChevronDown, ChevronUp, UtensilsCrossed, BookmarkPlus, Loader2, Globe } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useUnits } from '../../context/UnitsContext';
import Modal from '../../components/ui/Modal';
import { getServingLabel } from '../../components/ui/ServingSizeSelector';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙' },
  { key: 'snack',     label: 'Snack',     emoji: '🍎' },
];

const COMMUNITY_TAGS = [
  'High Protein', 'Low Calorie', 'Low Carb', 'Keto', 'Vegan', 'Vegetarian',
  'Gluten Free', 'High Fiber', 'Quick', 'Meal Prep', 'Budget Friendly', 'Dairy Free',
];

// ── Save-as-template mini modal ───────────────────────────────────────────────

function SaveTemplateModal({ isOpen, onClose, mealLabel, mealLogs }) {
  const [name,         setName]         = useState('');
  const [desc,         setDesc]         = useState('');
  const [saving,       setSaving]       = useState(false);
  const [isPublic,     setIsPublic]     = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const toast = useToast();

  const toggleTag = (tag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Enter a template name'); return; }
    if (!mealLogs.length) { toast.error('No foods to save'); return; }

    const foods = mealLogs.map(log => ({
      foodId:            log.food.id,
      foodName:          log.food.name,
      portionMultiplier: log.multiplier,
      calories:          log.calories,
      protein:           log.protein,
      carbs:             log.carbs,
      fat:               log.fat,
    }));

    setSaving(true);
    try {
      await axios.post('/api/templates', {
        name:        name.trim(),
        description: desc.trim(),
        foods,
        isPublic,
        tags: selectedTags,
      });
      toast.success(`"${name.trim()}" saved as template!`);
      onClose();
      setName('');
      setDesc('');
      setIsPublic(false);
      setSelectedTags([]);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Save ${mealLabel} as Template`}>
      <div className="p-5 flex flex-col gap-4">
        {/* Food preview */}
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">
            {mealLogs.length} food{mealLogs.length !== 1 ? 's' : ''} will be saved
          </p>
          {mealLogs.map(log => (
            <div key={log.id} className="flex items-center justify-between py-1">
              <p className="text-sm text-gray-700 truncate flex-1">{log.food.name}</p>
              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                {Math.round(log.calories)} kcal
              </span>
            </div>
          ))}
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Template Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder={`e.g. My ${mealLabel} Routine`}
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Short description…"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Share with community */}
        <div className="border border-gray-100 rounded-2xl p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe size={14} className={isPublic ? 'text-primary' : 'text-gray-400'} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Share with community</p>
                <p className="text-xs text-gray-400">Visible to all NutriAI users</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic((p) => !p)}
              className={`relative inline-flex items-center rounded-full transition-colors flex-shrink-0 ${isPublic ? 'bg-primary' : 'bg-gray-200'}`}
              style={{ height: '22px', width: '40px' }}
            >
              <span
                className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>

          {isPublic && (
            <div className="mt-3">
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-2.5">
                Your template will be visible to all NutriAI users. Your name will be shown as the creator.
              </p>
              <p className="text-xs font-semibold text-gray-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMUNITY_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3.5 rounded-2xl hover:bg-primary-dark disabled:opacity-60 transition-colors">
          {saving
            ? <><Loader2 size={16} className="animate-spin" />Saving…</>
            : <><BookmarkPlus size={16} />Save Template</>}
        </button>
      </div>
    </Modal>
  );
}

// ── Main food log ─────────────────────────────────────────────────────────────

export default function FoodLog({ logs, onDelete }) {
  const [collapsed, setCollapsed]       = useState({});
  const [saveModal,  setSaveModal]       = useState(null); // { mealKey, mealLabel, mealLogs }
  const toast = useToast();
  const { displayEnergy, energyLabel, units } = useUnits();
  const preferImperial = units.weightUnit === 'lbs';

  const toggle = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  const handleDelete = async (id, name) => {
    try {
      await axios.delete(`/api/log/${id}`);
      onDelete();
      toast.success(`Removed ${name}`);
    } catch {
      toast.error('Failed to remove item');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {MEALS.map(({ key, label, emoji }) => {
          const mealLogs = logs.filter(l => l.meal === key);
          const mealCal  = mealLogs.reduce((s, l) => s + l.calories, 0);
          const isOpen   = !collapsed[key];

          return (
            <div key={key} className="bg-gray-50 rounded-2xl overflow-hidden">
              {/* Meal header */}
              <button
                aria-expanded={isOpen}
                aria-label={`${label} — ${mealLogs.length} items${mealCal > 0 ? `, ${Math.round(mealCal)} calories` : ''}`}
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between px-4 py-3.5 min-h-[52px]">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{emoji}</span>
                  <span className="font-bold text-base text-gray-900">{label}</span>
                  {mealLogs.length > 0 && (
                    <span className="text-xs bg-primary-muted text-primary-dark px-2 py-0.5 rounded-full font-semibold">
                      {mealLogs.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  {mealCal > 0 && (
                    <span className="text-base font-bold text-gray-700">{displayEnergy(mealCal)} {energyLabel}</span>
                  )}
                  {isOpen
                    ? <ChevronUp size={18} className="text-gray-400" />
                    : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-2 pb-2">
                  {mealLogs.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 px-3 py-5 text-center">
                      <UtensilsCrossed size={22} className="text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">Nothing logged yet</p>
                      <p className="text-xs text-gray-300">Use the search bar above to add foods</p>
                    </div>
                  ) : (
                    <>
                      {mealLogs.map(log => (
                        <div key={log.id}
                          className="flex items-center justify-between bg-white rounded-xl px-3 py-3 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-gray-900 truncate">{log.food.name}</p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {getServingLabel(log.multiplier * (log.food?.servingSize || 100), log.food, preferImperial)} · P{Math.round(log.protein)}g C{Math.round(log.carbs)}g F{Math.round(log.fat)}g
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                            <span className="text-base font-bold text-primary">{displayEnergy(log.calories)} {energyLabel}</span>
                            <button
                              aria-label={`Remove ${log.food.name}`}
                              onClick={() => handleDelete(log.id, log.food.name)}
                              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Save as template */}
                      <button
                        onClick={() => setSaveModal({ mealKey: key, mealLabel: label, mealLogs })}
                        className="w-full flex items-center justify-center gap-1.5 mt-1 py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 hover:border-primary hover:text-primary transition-all font-medium">
                        <BookmarkPlus size={13} />
                        Save {label} as template
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save-as-template modal */}
      {saveModal && (
        <SaveTemplateModal
          isOpen
          onClose={() => setSaveModal(null)}
          mealLabel={saveModal.mealLabel}
          mealLogs={saveModal.mealLogs}
        />
      )}
    </>
  );
}
