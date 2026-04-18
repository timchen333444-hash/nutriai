import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Loader2, Trash2, Pencil, Plus, Search, ChevronLeft, X,
  BookmarkPlus, UtensilsCrossed,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner', snack: '🍎 Snack' };

// ── Macro chip ────────────────────────────────────────────────────────────────

function MacroChip({ label, value }) {
  return (
    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
      {label}{Math.round(value * 10) / 10}g
    </span>
  );
}

// ── Food row inside builder ───────────────────────────────────────────────────

function BuilderFoodRow({ food, onRemove, onMultiplierChange }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{food.foodName}</p>
        <p className="text-xs text-gray-400">
          {Math.round(food.calories)} kcal · P{Math.round(food.protein * 10) / 10}g
        </p>
      </div>
      {/* Portion stepper */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onMultiplierChange(-0.25)}
          className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold hover:bg-gray-300">
          −
        </button>
        <span className="text-xs font-medium w-9 text-center tabular-nums">
          {food.portionMultiplier}×
        </span>
        <button
          onClick={() => onMultiplierChange(0.25)}
          className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold hover:bg-gray-300">
          +
        </button>
      </div>
      <button
        onClick={onRemove}
        className="p-1 text-gray-300 hover:text-red-400 transition-colors ml-1">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Food search result row ────────────────────────────────────────────────────

function SearchResultRow({ food, onSelect, importing }) {
  return (
    <button
      onClick={onSelect}
      disabled={importing}
      className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-primary-light text-left mb-0.5 transition-colors disabled:opacity-60">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 truncate">{food.name}</p>
          {food._usda && (
            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
              USDA
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">{food.servingSize}{food.servingUnit}</p>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        {importing
          ? <Loader2 size={14} className="animate-spin text-primary" />
          : <>
              <p className="text-sm font-semibold text-primary">{Math.round(food.calories ?? 0)} kcal</p>
              <p className="text-xs text-gray-400">P{Math.round(food.protein ?? 0)}g</p>
            </>
        }
      </div>
    </button>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, selectedMeal, onAddToLog, onEdit, onDelete, adding, deleting }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">{template.name}</p>
          {template.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{template.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-sm font-bold text-primary">
              {Math.round(template.totalCalories)} kcal
            </span>
            <MacroChip label="P" value={template.totalProtein} />
            <MacroChip label="C" value={template.totalCarbs} />
            <MacroChip label="F" value={template.totalFat} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {template.foods.length} food{template.foods.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-primary transition-colors rounded-lg hover:bg-gray-50"
            title="Edit template">
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-50"
            title="Delete template">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      <button
        onClick={onAddToLog}
        disabled={adding}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-2.5 rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors text-sm">
        {adding
          ? <><Loader2 size={15} className="animate-spin" />Adding…</>
          : <>Add to {MEAL_LABELS[selectedMeal]}</>
        }
      </button>
    </div>
  );
}

// ── Builder view (create + edit) ──────────────────────────────────────────────

function BuilderView({ mode, initialName, initialDesc, initialFoods, onBack, onSave, saving }) {
  const toast = useToast();

  const [name,   setName]   = useState(initialName  || '');
  const [desc,   setDesc]   = useState(initialDesc  || '');
  const [foods,  setFoods]  = useState(initialFoods || []);

  const [searchQ,       setSearchQ]       = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [importingId,   setImportingId]   = useState(null);

  const timerRef = useRef(null);

  // Debounced food search
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); setSearching(false); return; }
    clearTimeout(timerRef.current);
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const [lr, ur] = await Promise.allSettled([
          axios.get(`/api/foods?q=${encodeURIComponent(searchQ)}`),
          axios.get(`/api/usda/search?q=${encodeURIComponent(searchQ)}`),
        ]);
        const local = lr.status === 'fulfilled' ? lr.value.data.slice(0, 5) : [];
        const usda  = ur.status === 'fulfilled'
          ? ur.value.data.slice(0, 4).map(f => ({ ...f, _usda: true }))
          : [];
        setSearchResults([...local, ...usda]);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [searchQ]);

  const addFood = async (food) => {
    let resolved = food;
    if (food._usda) {
      setImportingId(food.fdcId);
      try {
        const { data } = await axios.post('/api/usda/import', { fdcId: food.fdcId });
        resolved = data;
      } catch { toast.error('Failed to load food details'); return; }
      finally { setImportingId(null); }
    }
    setFoods(prev => [...prev, {
      foodId:            resolved.id,
      foodName:          resolved.name,
      portionMultiplier: 1,
      calories:          Math.round(resolved.calories ?? 0),
      protein:           Math.round((resolved.protein  ?? 0) * 10) / 10,
      carbs:             Math.round((resolved.carbs    ?? 0) * 10) / 10,
      fat:               Math.round((resolved.fat      ?? 0) * 10) / 10,
    }]);
    setSearchQ('');
    setSearchResults([]);
  };

  const removeFood = (idx) => setFoods(prev => prev.filter((_, i) => i !== idx));

  const changeMultiplier = (idx, delta) => {
    setFoods(prev => prev.map((f, i) => {
      if (i !== idx) return f;
      const newMult = Math.max(0.25, Math.round((f.portionMultiplier + delta) * 4) / 4);
      const ratio   = newMult / f.portionMultiplier;
      return {
        ...f,
        portionMultiplier: newMult,
        calories: Math.round(f.calories * ratio),
        protein:  Math.round(f.protein  * ratio * 10) / 10,
        carbs:    Math.round(f.carbs    * ratio * 10) / 10,
        fat:      Math.round(f.fat      * ratio * 10) / 10,
      };
    }));
  };

  const handleSave = () => {
    if (!name.trim())    { toast.error('Enter a template name'); return; }
    if (!foods.length)   { toast.error('Add at least one food'); return; }
    onSave(name.trim(), desc.trim(), foods);
  };

  const totals = foods.reduce(
    (a, f) => ({ cal: a.cal + f.calories, prot: a.prot + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 },
  );

  return (
    <div className="flex flex-col h-full">
      {/* Nav */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-700 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <p className="font-syne font-semibold text-base">
          {mode === 'edit' ? 'Edit Template' : 'New Template'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Template Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. High Protein Breakfast"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Description <span className="text-gray-300 font-normal normal-case">(optional)</span>
          </label>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Short description…"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Foods list */}
        {foods.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Foods ({foods.length})
              </label>
              <span className="text-xs text-primary font-semibold">
                {Math.round(totals.cal)} kcal total
              </span>
            </div>
            {foods.map((f, i) => (
              <BuilderFoodRow
                key={i}
                food={f}
                onRemove={() => removeFood(i)}
                onMultiplierChange={delta => changeMultiplier(i, delta)}
              />
            ))}
          </div>
        )}

        {/* Food search */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Add Food
          </label>
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search library + USDA…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searching
              ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
              : searchQ && <button onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>
            }
          </div>

          {searchResults.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {searchResults.map((food, i) => (
                <SearchResultRow
                  key={food.id ?? food.fdcId ?? i}
                  food={food}
                  onSelect={() => addFood(food)}
                  importing={importingId === food.fdcId}
                />
              ))}
            </div>
          )}
          {searchQ.trim() && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No results for &ldquo;{searchQ}&rdquo;</p>
          )}
        </div>
      </div>

      {/* Save button (sticky footer) */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3.5 rounded-2xl hover:bg-primary-dark disabled:opacity-60 transition-colors">
          {saving
            ? <><Loader2 size={18} className="animate-spin" />Saving…</>
            : <><BookmarkPlus size={18} />{mode === 'edit' ? 'Update Template' : 'Save Template'}</>}
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function TemplatesModal({ isOpen, onClose, onAdd }) {
  const toast = useToast();

  const [view,      setView]      = useState('list'); // 'list' | 'create' | 'edit'
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [addingId,  setAddingId]  = useState(null);
  const [deletingId,setDeletingId]= useState(null);
  const [saving,    setSaving]    = useState(false);
  const [editTarget,setEditTarget]= useState(null); // template being edited

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/templates');
      setTemplates(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen) { loadTemplates(); setView('list'); }
  }, [isOpen]);

  const handleAddToLog = async (template) => {
    setAddingId(template.id);
    let added = 0;
    for (const food of template.foods) {
      try {
        await axios.post('/api/log', {
          foodId:     food.foodId,
          meal:       selectedMeal,
          multiplier: food.portionMultiplier,
        });
        added++;
      } catch { /* skip failed item */ }
    }
    setAddingId(null);
    if (added > 0) {
      toast.success(
        `Added "${template.name}" — ${added} food${added !== 1 ? 's' : ''}, ${Math.round(template.totalCalories)} kcal`
      );
      onAdd();
      onClose();
    } else {
      toast.error('Could not add foods — check the food library');
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await axios.delete(`/api/templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch { toast.error('Failed to delete template'); }
    finally { setDeletingId(null); }
  };

  const handleSaveBuilder = async (name, desc, foods) => {
    setSaving(true);
    try {
      if (view === 'edit' && editTarget) {
        const { data } = await axios.patch(`/api/templates/${editTarget.id}`, { name, description: desc, foods });
        setTemplates(prev => prev.map(t => t.id === data.id ? data : t));
        toast.success('Template updated!');
      } else {
        const { data } = await axios.post('/api/templates', { name, description: desc, foods });
        setTemplates(prev => [data, ...prev]);
        toast.success('Template saved!');
      }
      setView('list');
    } catch { toast.error('Failed to save template'); }
    finally { setSaving(false); }
  };

  const openEdit = (template) => {
    setEditTarget(template);
    setView('edit');
  };

  // Title shown in the Modal header
  const title = view === 'list' ? 'Meal Templates' : null; // builder manages its own nav

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} fullHeight>
      {/* ── Builder view (create / edit) ── */}
      {(view === 'create' || view === 'edit') && (
        <BuilderView
          mode={view}
          initialName={view === 'edit' ? editTarget?.name        : ''}
          initialDesc={view === 'edit' ? editTarget?.description : ''}
          initialFoods={view === 'edit' ? editTarget?.foods.map(f => ({ ...f })) : []}
          onBack={() => setView('list')}
          onSave={handleSaveBuilder}
          saving={saving}
        />
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="flex flex-col h-full">
          {/* Meal selector */}
          <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-500 mb-2 font-medium">Add templates to:</p>
            <div className="flex gap-1.5">
              {MEALS.map(m => (
                <button key={m} onClick={() => setSelectedMeal(m)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                    selectedMeal === m ? 'border-primary bg-primary-light text-primary' : 'border-gray-200 text-gray-500'
                  }`}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Create from scratch */}
          <div className="px-5 py-3 flex-shrink-0">
            <button
              onClick={() => setView('create')}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-3 text-sm text-gray-400 hover:border-primary hover:text-primary transition-all font-medium">
              <Plus size={16} />Create from scratch
            </button>
          </div>

          {/* Templates list */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {loading && (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            )}

            {!loading && templates.length === 0 && (
              <div className="text-center py-12">
                <UtensilsCrossed size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">No templates yet</p>
                <p className="text-xs text-gray-300 mt-1">
                  Create one above, or save a meal from Today's log
                </p>
              </div>
            )}

            {!loading && templates.length > 0 && (
              <div className="flex flex-col gap-3">
                {templates.map(t => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    selectedMeal={selectedMeal}
                    onAddToLog={() => handleAddToLog(t)}
                    onEdit={() => openEdit(t)}
                    onDelete={() => handleDelete(t.id)}
                    adding={addingId === t.id}
                    deleting={deletingId === t.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
