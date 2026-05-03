import { Component, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Sparkles, Loader2, ChevronDown, ChevronUp, Leaf, AlertCircle,
  BookmarkPlus, Trash2, FolderOpen, Pencil, RefreshCw, Plus, X, Search,
  ShoppingCart,
} from 'lucide-react';
import GroceryList from './GroceryList';
import HelpModal from '../../components/ui/HelpModal';

const AIPLAN_HELP = `The AI Plan page lets Claude, our AI assistant, create a personalised meal plan based on your calorie and nutrition goals. Set your daily calorie target, choose how many meals per day, add any dietary restrictions, and tap Generate. You can then edit individual foods, regenerate single meals, save the plan for later, or turn it into a grocery shopping list automatically.`;

// ── Constants ─────────────────────────────────────────────────────────────────

const RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free',
  'Low-Carb', 'Keto', 'Paleo', 'Halal', 'Kosher',
  'Low-Sodium', 'Low-Sugar', 'High-Fiber',
];

const MICRONUTRIENTS = [
  'Vitamin D', 'Vitamin B12', 'Iron', 'Calcium', 'Magnesium', 'Zinc',
  'Omega-3', 'Folate', 'Potassium', 'Selenium', 'Vitamin C', 'Vitamin A',
];

const HEALTH_FOCUS_OPTIONS = [
  'Prioritize omega-3', 'Maximize fiber', 'Minimize saturated fat',
  'Include fermented foods', 'Prioritize anti-inflammatory foods',
];

const MACRO_SLIDERS = [
  { key: 'protein', label: 'Protein', min: 50,  max: 300, step: 5,  unit: 'g' },
  { key: 'carbs',   label: 'Carbs',   min: 50,  max: 500, step: 10, unit: 'g' },
  { key: 'fat',     label: 'Fat',     min: 20,  max: 200, step: 5,  unit: 'g' },
];

const VARIETY_OPTIONS = [
  { key: 'noRepeatedProteins', label: 'No repeated proteins across days' },
  { key: 'rotateCuisines',     label: 'Rotate cuisine styles (Mediterranean, Asian, American, Mexican, Middle Eastern)' },
  { key: 'includeNewFoods',    label: 'Include at least one new food per day' },
  { key: 'mixCookingMethods',  label: 'Mix cooking methods (grilled, baked, steamed, raw, stir-fried)' },
];

const PLAN_DURATIONS = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 5, label: '5 days' },
  { days: 7, label: '7 days' },
];

// ── Pure utility functions ────────────────────────────────────────────────────

/** Normalise a plan item to always have multiplier + base nutrition fields. */
function normalizeItem(item) {
  const baseCal   = item._baseCal   ?? item.calories ?? 0;
  const baseProt  = item._baseProt  ?? item.protein  ?? 0;
  const baseCarbs = item._baseCarbs ?? item.carbs    ?? 0;
  const baseFat   = item._baseFat   ?? item.fat      ?? 0;
  const mult      = item.multiplier ?? 1;
  return {
    ...item,
    multiplier:  mult,
    _baseCal:    baseCal,
    _baseProt:   baseProt,
    _baseCarbs:  baseCarbs,
    _baseFat:    baseFat,
    calories:    Math.round(baseCal   * mult),
    protein:     Math.round(baseProt  * mult * 10) / 10,
    carbs:       Math.round(baseCarbs * mult * 10) / 10,
    fat:         Math.round(baseFat   * mult * 10) / 10,
  };
}

/** Convert a food-library entry into a plan item. */
function libToItem(food) {
  const cal   = Math.round(food.calories ?? 0);
  const prot  = Math.round((food.protein  ?? 0) * 10) / 10;
  const carbs = Math.round((food.carbs    ?? 0) * 10) / 10;
  const fat   = Math.round((food.fat      ?? 0) * 10) / 10;
  return {
    food:       food.name,
    amount:     `${food.servingSize ?? 100}${food.servingUnit ?? 'g'}`,
    calories:   cal,
    protein:    prot,
    carbs:      carbs,
    fat:        fat,
    notes:      '',
    multiplier: 1,
    _baseCal:   cal,
    _baseProt:  prot,
    _baseCarbs: carbs,
    _baseFat:   fat,
  };
}

function recalcMeal(meal) {
  const sums = (meal.items ?? []).reduce(
    (a, i) => ({ calories: a.calories + (i.calories || 0), protein: a.protein + (i.protein || 0), carbs: a.carbs + (i.carbs || 0), fat: a.fat + (i.fat || 0) }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    ...meal,
    calories: Math.round(sums.calories),
    protein:  Math.round(sums.protein * 10) / 10,
    carbs:    Math.round(sums.carbs * 10) / 10,
    fat:      Math.round(sums.fat * 10) / 10,
  };
}

function recalcDay(day) {
  const meals = (day.meals ?? []);
  const sums  = meals.reduce(
    (a, m) => ({ cal: a.cal + (m.calories || 0), prot: a.prot + (m.protein || 0), carbs: a.carbs + (m.carbs || 0), fat: a.fat + (m.fat || 0) }),
    { cal: 0, prot: 0, carbs: 0, fat: 0 },
  );
  return {
    ...day,
    totalCalories: Math.round(sums.cal),
    totalProtein:  Math.round(sums.prot  * 10) / 10,
    totalCarbs:    Math.round(sums.carbs * 10) / 10,
    totalFat:      Math.round(sums.fat   * 10) / 10,
  };
}

/** Normalise every item in every meal of the whole plan. */
function normalizePlan(planData) {
  return {
    ...planData,
    days: (planData.days ?? []).map(day => ({
      ...day,
      meals: (day.meals ?? []).map(meal => ({
        ...meal,
        items: (meal.items ?? []).map(normalizeItem),
      })),
    })),
  };
}

// Immutable plan mutators — all return a new plan object with recalculated totals

function setPlanItem(plan, di, mi, ii, newItem) {
  return {
    ...plan,
    days: plan.days.map((day, d) => {
      if (d !== di) return day;
      const meals = day.meals.map((meal, m) => {
        if (m !== mi) return meal;
        return recalcMeal({ ...meal, items: meal.items.map((it, i) => i === ii ? newItem : it) });
      });
      return recalcDay({ ...day, meals });
    }),
  };
}

function removePlanItem(plan, di, mi, ii) {
  return {
    ...plan,
    days: plan.days.map((day, d) => {
      if (d !== di) return day;
      const meals = day.meals.map((meal, m) => {
        if (m !== mi) return meal;
        return recalcMeal({ ...meal, items: meal.items.filter((_, i) => i !== ii) });
      });
      return recalcDay({ ...day, meals });
    }),
  };
}

function addPlanItem(plan, di, mi, newItem) {
  return {
    ...plan,
    days: plan.days.map((day, d) => {
      if (d !== di) return day;
      const meals = day.meals.map((meal, m) => {
        if (m !== mi) return meal;
        return recalcMeal({ ...meal, items: [...(meal.items ?? []), newItem] });
      });
      return recalcDay({ ...day, meals });
    }),
  };
}

function setPlanMeal(plan, di, mi, newMeal) {
  return {
    ...plan,
    days: plan.days.map((day, d) => {
      if (d !== di) return day;
      const meals = day.meals.map((meal, m) => m === mi ? newMeal : meal);
      return recalcDay({ ...day, meals });
    }),
  };
}

// ── Tiny shared UI ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2.5">{children}</p>;
}

function Pill({ label, active, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${active ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600'}`}>
      {label}
    </button>
  );
}

// ── Food search modal ─────────────────────────────────────────────────────────

function FoodResultRow({ food, onSelect, importing }) {
  return (
    <button onClick={onSelect} disabled={importing}
      className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-primary-light transition-colors text-left mb-0.5 disabled:opacity-60">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 truncate">{food.name}</p>
          {food._usda && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">USDA</span>}
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

function FoodSearchModal({ isOpen, onClose, onSelect, currentItem, title }) {
  const [query,        setQuery]        = useState('');
  const [localResults, setLocalResults] = useState([]);
  const [usdaResults,  setUsdaResults]  = useState([]);
  const [searching,    setSearching]    = useState(false);
  const [importingId,  setImportingId]  = useState(null);
  const timer = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) { setQuery(''); setLocalResults([]); setUsdaResults([]); }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) { setLocalResults([]); setUsdaResults([]); setSearching(false); return; }
    clearTimeout(timer.current);
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const [lr, ur] = await Promise.allSettled([
          axios.get(`/api/foods?q=${encodeURIComponent(query)}`),
          axios.get(`/api/usda/search?q=${encodeURIComponent(query)}`),
        ]);
        setLocalResults(lr.status === 'fulfilled' ? lr.value.data.slice(0, 6) : []);
        setUsdaResults(ur.status === 'fulfilled'  ? ur.value.data.slice(0, 5) : []);
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query]);

  const handleSelect = async (food) => {
    if (food._usda) {
      setImportingId(food.fdcId);
      try {
        const { data } = await axios.post('/api/usda/import', { fdcId: food.fdcId });
        onSelect(libToItem(data));
        onClose();
      } catch { toast.error('Failed to load food details'); }
      finally { setImportingId(null); }
    } else {
      onSelect(libToItem(food));
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 max-h-[82vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="font-syne font-bold text-base">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        {/* Replacing indicator */}
        {currentItem && (
          <div className="bg-primary-light rounded-xl px-3 py-2.5 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Currently</p>
            <p className="text-sm font-medium text-gray-900">{currentItem.food}</p>
            <p className="text-xs text-gray-400">
              {currentItem.calories} kcal · P{currentItem.protein}g C{currentItem.carbs}g F{currentItem.fat}g
            </p>
          </div>
        )}

        {/* Search input */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search your library + USDA…"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          {searching
            ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
            : query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={13} /></button>
          }
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {!query.trim() && (
            <p className="text-sm text-gray-400 text-center py-8">Type to search your library and USDA database</p>
          )}
          {query.trim() && !searching && localResults.length === 0 && usdaResults.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No results for &ldquo;{query}&rdquo;</p>
          )}

          {localResults.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 px-1">Your Library</p>
              {localResults.map(f => (
                <FoodResultRow key={f.id} food={f} onSelect={() => handleSelect(f)} />
              ))}
            </div>
          )}

          {usdaResults.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 px-1">USDA Database</p>
              {usdaResults.map((f, i) => (
                <FoodResultRow key={f.fdcId ?? i}
                  food={{ ...f, _usda: true }}
                  onSelect={() => handleSelect({ ...f, _usda: true })}
                  importing={importingId === f.fdcId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Editable food row ─────────────────────────────────────────────────────────

function EditableFoodRow({ item, onUpdate, onDelete, onEditClick }) {
  const changeMultiplier = (delta) => {
    const next = Math.max(0.25, Math.round((item.multiplier + delta) * 4) / 4);
    onUpdate({
      ...item,
      multiplier: next,
      calories: Math.round(item._baseCal   * next),
      protein:  Math.round(item._baseProt  * next * 10) / 10,
      carbs:    Math.round(item._baseCarbs * next * 10) / 10,
      fat:      Math.round(item._baseFat   * next * 10) / 10,
    });
  };

  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-gray-50 last:border-0">
      {/* Food name + portion row */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug">
          {item.food}
          {item.notes ? <span className="text-xs text-gray-400 font-normal ml-1 italic">{item.notes}</span> : null}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">{item.amount}</span>
          {/* Portion stepper */}
          <div className="flex items-center gap-1">
            <button onClick={() => changeMultiplier(-0.25)}
              className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center leading-none text-[13px] font-bold hover:bg-gray-200 transition-colors flex-shrink-0">
              −
            </button>
            <span className="text-xs text-gray-600 font-medium w-7 text-center tabular-nums">{item.multiplier}×</span>
            <button onClick={() => changeMultiplier(0.25)}
              className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center leading-none text-[13px] font-bold hover:bg-gray-200 transition-colors flex-shrink-0">
              +
            </button>
          </div>
        </div>
      </div>

      {/* Calories + actions */}
      <div className="flex items-start gap-1 flex-shrink-0">
        <div className="text-right mr-1">
          <p className="text-sm font-semibold text-primary tabular-nums">{item.calories} kcal</p>
          <p className="text-[10px] text-gray-400 tabular-nums">
            P{item.protein}g C{item.carbs}g F{item.fat}g
          </p>
        </div>
        <button onClick={onEditClick}
          className="mt-0.5 p-1 text-gray-300 hover:text-blue-500 transition-colors" title="Swap food">
          <Pencil size={12} />
        </button>
        <button onClick={onDelete}
          className="mt-0.5 p-1 text-gray-300 hover:text-red-400 transition-colors" title="Remove">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Editable meal card ────────────────────────────────────────────────────────

function EditableMealCard({ meal, dayIdx, mealIdx, onMealChange, onOpenSearch, onRegenerate, regenerating, defaultOpen }) {
  const [open,        setOpen]        = useState(defaultOpen);
  const [editingName, setEditingName] = useState(false);
  const [editingTime, setEditingTime] = useState(false);

  const updateItem = (ii, newItem) =>
    onMealChange(recalcMeal({ ...meal, items: meal.items.map((it, i) => i === ii ? newItem : it) }));

  const deleteItem = (ii) =>
    onMealChange(recalcMeal({ ...meal, items: meal.items.filter((_, i) => i !== ii) }));

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center px-4 py-3.5 gap-2">
        {/* Name + time (editable) */}
        <div className="flex-1 min-w-0" onClick={() => !editingName && !editingTime && setOpen(o => !o)}>
          <div className="flex items-center gap-1">
            {editingName ? (
              <input autoFocus value={meal.name}
                onChange={e => onMealChange({ ...meal, name: e.target.value })}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                className="font-syne font-semibold text-sm border-b-2 border-primary outline-none bg-transparent w-full max-w-[160px]"
                onClick={e => e.stopPropagation()} />
            ) : (
              <button className="flex items-center gap-1 font-syne font-semibold text-sm text-gray-900 hover:text-primary"
                onClick={e => { e.stopPropagation(); setEditingName(true); }}>
                {meal.name}
                <Pencil size={10} className="text-gray-300" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {editingTime ? (
              <input autoFocus value={meal.time}
                onChange={e => onMealChange({ ...meal, time: e.target.value })}
                onBlur={() => setEditingTime(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingTime(false)}
                className="text-xs text-gray-400 border-b border-primary outline-none bg-transparent w-24"
                onClick={e => e.stopPropagation()} />
            ) : (
              <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary"
                onClick={e => { e.stopPropagation(); setEditingTime(true); }}>
                {meal.time} · {meal.calories} kcal
                <Pencil size={9} className="text-gray-300" />
              </button>
            )}
          </div>
        </div>

        {/* Macro summary */}
        <p className="text-xs text-gray-400 hidden sm:block flex-shrink-0">
          P{meal.protein}g C{meal.carbs}g F{meal.fat}g
        </p>

        {/* Regenerate */}
        <button onClick={onRegenerate} disabled={regenerating}
          title="Regenerate this meal"
          className="p-1.5 text-gray-400 hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0">
          {regenerating
            ? <Loader2 size={15} className="animate-spin text-primary" />
            : <RefreshCw size={15} />}
        </button>

        {/* Collapse toggle */}
        <button onClick={() => setOpen(o => !o)} className="text-gray-400 flex-shrink-0">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-50 px-4 pb-4">
          {/* Food rows */}
          <div className="mt-2">
            {(meal.items ?? []).map((item, ii) => (
              <EditableFoodRow key={ii} item={item}
                onUpdate={newItem => updateItem(ii, newItem)}
                onDelete={() => deleteItem(ii)}
                onEditClick={() => onOpenSearch({
                  dayIdx, mealIdx, itemIdx: ii, mode: 'replace', currentItem: item,
                })} />
            ))}
          </div>

          {/* Add food */}
          <button
            onClick={() => onOpenSearch({ dayIdx, mealIdx, itemIdx: null, mode: 'add', currentItem: null })}
            className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-400 hover:border-primary hover:text-primary transition-all">
            <Plus size={13} />Add food
          </button>
        </div>
      )}
    </div>
  );
}

// ── Day card ──────────────────────────────────────────────────────────────────

function DayCard({ dayPlan, dayIdx, onDayChange, onOpenSearch, regeneratingMeal, onRegenerateMeal, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  const handleMealChange = (mi, newMeal) => {
    const updatedMeals = dayPlan.meals.map((m, i) => i === mi ? newMeal : m);
    onDayChange(recalcDay({ ...dayPlan, meals: updatedMeals }));
  };

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Day header */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-4 bg-white text-left">
        <div>
          <p className="font-syne font-semibold text-base">{dayPlan.dayLabel ?? `Day ${dayPlan.dayNumber}`}</p>
          <p className="text-xs text-gray-400">{dayPlan.totalCalories} kcal · {dayPlan.meals?.length} meals</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400 hidden sm:block">
            P{dayPlan.totalProtein}g C{dayPlan.totalCarbs}g F{dayPlan.totalFat}g
          </p>
          {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Macro bar */}
          <div className="bg-primary-light px-4 py-3 grid grid-cols-4 gap-2 text-center">
            {[
              { l: 'Calories', v: dayPlan.totalCalories, u: 'kcal' },
              { l: 'Protein',  v: dayPlan.totalProtein,  u: 'g' },
              { l: 'Carbs',    v: dayPlan.totalCarbs,    u: 'g' },
              { l: 'Fat',      v: dayPlan.totalFat,      u: 'g' },
            ].map(m => (
              <div key={m.l}>
                <p className="font-bold text-primary text-base tabular-nums">{m.v}</p>
                <p className="text-[10px] text-gray-500">{m.u}</p>
                <p className="text-[10px] text-gray-400">{m.l}</p>
              </div>
            ))}
          </div>

          <div className="p-4 flex flex-col gap-3">
            {/* Nutrition highlights */}
            {(dayPlan.nutritionHighlights ?? []).length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-3">
                <p className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-primary" />Nutrition highlights
                </p>
                {dayPlan.nutritionHighlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <span className="text-primary text-xs mt-0.5">✓</span>
                    <p className="text-xs text-gray-600">{h}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Meal cards */}
            {(dayPlan.meals ?? []).map((meal, mi) => (
              <EditableMealCard
                key={mi}
                meal={meal}
                dayIdx={dayIdx}
                mealIdx={mi}
                onMealChange={newMeal => handleMealChange(mi, newMeal)}
                onOpenSearch={onOpenSearch}
                onRegenerate={() => onRegenerateMeal(dayIdx, mi)}
                regenerating={regeneratingMeal?.dayIdx === dayIdx && regeneratingMeal?.mealIdx === mi}
                defaultOpen
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Saved plan card ───────────────────────────────────────────────────────────

function SavedPlanCard({ plan, onLoad, onDelete, deleting }) {
  const date = new Date(plan.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <p className="font-semibold text-sm text-gray-900 truncate">{plan.name}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {date} · {plan.days} {plan.days === 1 ? 'day' : 'days'} · {plan.calorieTarget} kcal/day
      </p>
      <div className="flex gap-2 mt-3">
        <button onClick={onLoad}
          className="flex-1 flex items-center justify-center gap-1.5 bg-primary-light text-primary text-xs font-semibold py-2.5 rounded-xl hover:bg-primary hover:text-white transition-all">
          <FolderOpen size={13} />Load Plan
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="flex items-center justify-center w-10 border border-red-100 text-red-400 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50">
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

// ── Grocery list card (My Lists section) ─────────────────────────────────────

function GroceryListCard({ list, onLoad, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const date  = new Date(list.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const items = Array.isArray(list.items) ? list.items : [];
  const remaining = items.filter(i => !i.checked).length;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{list.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {date} · {items.length} item{items.length !== 1 ? 's' : ''}
            {remaining < items.length && ` · ${remaining} remaining`}
          </p>
          <p className="text-sm font-bold text-primary mt-1.5">~${list.totalEstimatedCost.toFixed(2)}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={onLoad}
          className="flex-1 flex items-center justify-center gap-1.5 bg-primary-light text-primary text-xs font-semibold py-2.5 rounded-xl hover:bg-primary hover:text-white transition-all">
          <ShoppingCart size={13} />View List
        </button>
        <button
          onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false); }}
          disabled={deleting}
          className="flex items-center justify-center w-10 border border-red-100 text-red-400 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50">
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function AIPlan() {
  const { user } = useAuth();
  const toast    = useToast();

  // ── Preferences ──
  const [calorieTarget, setCalorieTarget] = useState(
    user?.calorieTarget ? Math.round(user.calorieTarget) : 2000,
  );
  const [mealsPerDay,  setMealsPerDay]  = useState(3);
  const [macroGoals,   setMacroGoals]   = useState({
    protein: user?.proteinTarget ? Math.round(user.proteinTarget) : 150,
    carbs:   user?.carbTarget    ? Math.round(user.carbTarget)    : 200,
    fat:     user?.fatTarget     ? Math.round(user.fatTarget)     : 65,
  });
  const [micronutrients, setMicronutrients] = useState([]);
  const [restrictions,   setRestrictions]   = useState(user?.dietaryRestrictions || []);
  const [healthFocus,    setHealthFocus]     = useState([]);
  const [planDays,       setPlanDays]        = useState(1);
  const [varietySettings, setVarietySettings] = useState({
    noRepeatedProteins: false, rotateCuisines: false,
    includeNewFoods: false,    mixCookingMethods: false,
  });

  // ── Generation ──
  const [currentPlan,       setCurrentPlan]       = useState(null);
  const [loading,           setLoading]           = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ── Edit state ──
  const [searchModal,      setSearchModal]      = useState(null);   // { dayIdx, mealIdx, itemIdx, mode, currentItem }
  const [regeneratingMeal, setRegeneratingMeal] = useState(null);   // { dayIdx, mealIdx }

  // ── Saved plans ──
  const [savedPlans,    setSavedPlans]    = useState([]);
  const [saveName,      setSaveName]      = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [deletingId,    setDeletingId]    = useState(null);
  const [usage,         setUsage]         = useState(null);

  // Shared fetch so both mount and post-save can use the same call
  const fetchSavedPlans = async () => {
    try {
      const { data } = await axios.get('/api/plans');
      setSavedPlans(data);
    } catch (e) {
      console.warn('[fetchSavedPlans] failed:', e.response?.data?.error || e.message);
    }
  };

  // Load saved plans on mount
  useEffect(() => { fetchSavedPlans(); }, []);

  // Load usage on mount
  useEffect(() => {
    axios.get('/api/usage').then(r => setUsage(r.data)).catch(() => {});
  }, []);

  // ── Grocery lists ──
  const [groceryLists,    setGroceryLists]    = useState([]);
  const [showGrocery,     setShowGrocery]     = useState(false);
  const [grocerySavedList, setGrocerySavedList] = useState(null); // null = generate from currentPlan

  const fetchGroceryLists = async () => {
    try {
      const { data } = await axios.get('/api/grocery');
      setGroceryLists(data);
    } catch (e) {
      console.warn('[fetchGroceryLists]', e.message);
    }
  };

  useEffect(() => { fetchGroceryLists(); }, []);

  // ── Helpers ──
  const toggleArr = (setter, val) =>
    setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  /** Apply a plan update and mark unsaved changes. */
  const editPlan = (newPlan) => {
    setCurrentPlan(newPlan);
    setHasUnsavedChanges(true);
  };

  // ── Generate ──
  const generate = async () => {
    setLoading(true);
    setCurrentPlan(null);
    setShowSaveInput(false);
    setHasUnsavedChanges(false);
    try {
      const { data } = await axios.post('/api/ai/meal-plan', {
        calorieTarget, mealsPerDay, restrictions, macroGoals,
        micronutrientPriorities: micronutrients,
        healthFocus, days: planDays, varietySettings,
      });
      setCurrentPlan(normalizePlan(data));
      setUsage(prev => prev && !prev.isPremium
        ? { ...prev, aiPlans: { ...prev.aiPlans, used: prev.aiPlans.used + 1 } }
        : prev);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  // ── Regenerate single meal ──
  const handleRegenerateMeal = async (dayIdx, mealIdx) => {
    setRegeneratingMeal({ dayIdx, mealIdx });
    try {
      const day  = currentPlan.days[dayIdx];
      const meal = day.meals[mealIdx];
      const otherMeals = day.meals.filter((_, i) => i !== mealIdx);
      const { data: newMeal } = await axios.post('/api/ai/regenerate-meal', {
        mealName:          meal.name,
        mealCalorieTarget: meal.calories,
        existingMeals:     otherMeals,
        restrictions, macroGoals, healthFocus,
      });
      const normalised = { ...newMeal, items: (newMeal.items ?? []).map(normalizeItem) };
      editPlan(setPlanMeal(currentPlan, dayIdx, mealIdx, normalised));
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to regenerate meal');
    } finally {
      setRegeneratingMeal(null);
    }
  };

  // ── Search modal handlers ──
  const handleSearchSelect = (newItem) => {
    if (!searchModal) return;
    const { dayIdx, mealIdx, itemIdx, mode } = searchModal;
    if (mode === 'replace' && itemIdx != null) {
      editPlan(setPlanItem(currentPlan, dayIdx, mealIdx, itemIdx, newItem));
    } else {
      editPlan(addPlanItem(currentPlan, dayIdx, mealIdx, newItem));
    }
  };

  // ── Day change from DayCard ──
  const handleDayChange = (di, newDay) => {
    editPlan({ ...currentPlan, days: currentPlan.days.map((d, i) => i === di ? newDay : d) });
  };

  // ── Save plan ──
  const savePlan = async () => {
    if (!saveName.trim()) { toast.error('Enter a name for this plan'); return; }
    if (!currentPlan?.days?.length) { toast.error('Generate a plan first'); return; }
    setSaving(true);
    try {
      await axios.post('/api/plans', {
        name:          saveName.trim(),
        planData:      currentPlan.days,
        days:          currentPlan.days.length,
        calorieTarget: calorieTarget,
      });
      // Re-fetch from server so the list is always in sync
      await fetchSavedPlans();
      setSaveName('');
      setShowSaveInput(false);
      setHasUnsavedChanges(false);
      toast.success('Plan saved!');
    } catch (e) {
      console.error('[savePlan] error:', e.response?.data?.error || e.message);
      toast.error(e.response?.data?.error || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete saved plan ──
  const deleteSavedPlan = async (id) => {
    setDeletingId(id);
    try {
      await axios.delete(`/api/plans/${id}`);
      await fetchSavedPlans();
    } catch (e) {
      console.error('[deleteSavedPlan] error:', e.response?.data?.error || e.message);
      toast.error('Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Load saved plan ──
  const loadSavedPlan = (plan) => {
    setCurrentPlan(normalizePlan({ days: plan.planData }));
    setPlanDays(plan.days);
    setShowSaveInput(false);
    setHasUnsavedChanges(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateLabel = planDays === 1 ? 'Generate Day Plan' : `Generate ${planDays}-Day Plan`;

  return (
    <div className="pb-24 min-h-screen">

      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary-dark px-5 pt-12 pb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-white/80" />
            <span className="font-syne font-bold text-white text-xl">AI Meal Plan</span>
          </div>
          <div className="opacity-80">
            <HelpModal title="AI Meal Plan" description={AIPLAN_HELP} />
          </div>
        </div>
        <p className="text-white/60 text-sm">Personalised nutrition powered by Claude AI</p>
      </div>

      <div className="px-5 pt-5 flex flex-col gap-5">

        {/* Preferences card */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100">

          {/* Calorie target */}
          <div className="p-4">
            <SectionLabel>Calorie Target</SectionLabel>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Daily goal</span>
              <span className="text-sm font-bold text-primary">{calorieTarget} kcal</span>
            </div>
            <input type="range" min="1200" max="4000" step="50" value={calorieTarget}
              onChange={e => setCalorieTarget(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1200</span><span>4000</span></div>
          </div>

          {/* Meals per day */}
          <div className="p-4">
            <SectionLabel>Meals Per Day</SectionLabel>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setMealsPerDay(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${mealsPerDay === n ? 'border-primary bg-primary-light text-primary' : 'border-gray-200 text-gray-500'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Macro goals */}
          <div className="p-4">
            <SectionLabel>Macro Goals</SectionLabel>
            <div className="flex flex-col gap-4">
              {MACRO_SLIDERS.map(({ key, label, min, max, step, unit }) => (
                <div key={key}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm text-gray-600">{label}</span>
                    <span className="text-sm font-bold text-primary">{macroGoals[key]}{unit}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={macroGoals[key]}
                    onChange={e => setMacroGoals(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>{min}{unit}</span><span>{max}{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Micronutrient priorities */}
          <div className="p-4">
            <SectionLabel>Micronutrient Priorities</SectionLabel>
            <p className="text-xs text-gray-400 mb-2.5">Select nutrients to prioritise</p>
            <div className="flex flex-wrap gap-1.5">
              {MICRONUTRIENTS.map(n => (
                <Pill key={n} label={n} active={micronutrients.includes(n)}
                  onToggle={() => toggleArr(setMicronutrients, n)} />
              ))}
            </div>
          </div>

          {/* Dietary restrictions */}
          <div className="p-4">
            <SectionLabel>Dietary Restrictions</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {RESTRICTIONS.map(r => (
                <Pill key={r} label={r} active={restrictions.includes(r)}
                  onToggle={() => toggleArr(setRestrictions, r)} />
              ))}
            </div>
          </div>

          {/* Health focus */}
          <div className="p-4">
            <SectionLabel>Health Focus</SectionLabel>
            <p className="text-xs text-gray-400 mb-2.5">Toggle priorities to shape the plan</p>
            <div className="flex flex-wrap gap-1.5">
              {HEALTH_FOCUS_OPTIONS.map(f => (
                <Pill key={f} label={f} active={healthFocus.includes(f)}
                  onToggle={() => toggleArr(setHealthFocus, f)} />
              ))}
            </div>
          </div>

          {/* Variety settings */}
          <div className="p-4">
            <SectionLabel>Variety Settings</SectionLabel>
            <p className="text-xs text-gray-400 mb-3">Applied to multi-day plans</p>
            <div className="flex flex-col gap-3">
              {VARIETY_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => setVarietySettings(prev => ({ ...prev, [key]: !prev[key] }))}
                  className="flex items-start gap-3 text-left">
                  <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${varietySettings[key] ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                    {varietySettings[key] && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 leading-snug">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Plan duration */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <SectionLabel>Plan Duration</SectionLabel>
          <p className="text-xs text-gray-400 mb-3">Multi-day plans generate each day in parallel</p>
          <div className="flex gap-2">
            {PLAN_DURATIONS.map(({ days, label }) => (
              <button key={days} onClick={() => setPlanDays(days)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${planDays === days ? 'border-primary bg-primary-light text-primary' : 'border-gray-200 text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        {(() => {
          const atLimit = usage && !usage.isPremium && usage.aiPlans.used >= usage.aiPlans.limit;
          const resetLabel = usage?.aiPlans?.resetsAt
            ? new Date(usage.aiPlans.resetsAt + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
            : null;
          return (
            <>
              <button onClick={generate} disabled={loading || atLimit}
                className="w-full flex items-center justify-center gap-3 bg-primary text-white font-bold py-4 rounded-2xl hover:bg-primary-dark disabled:opacity-60 transition-colors text-base shadow-lg shadow-primary/20">
                {loading
                  ? <><Loader2 size={20} className="animate-spin" />Creating your {planDays > 1 ? `${planDays}-day ` : ''}plan…</>
                  : <><Sparkles size={20} />{generateLabel}</>}
              </button>
              {usage && !usage.isPremium && (
                <p className="text-center text-xs text-gray-400 -mt-3">
                  {atLimit
                    ? `Monthly limit reached · Resets ${resetLabel}`
                    : `${usage.aiPlans.used} of ${usage.aiPlans.limit} free AI plans used this month${resetLabel ? ` · Resets ${resetLabel}` : ''}`}
                </p>
              )}
            </>
          );
        })()}

        {loading && (
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Leaf size={16} className="text-primary animate-pulse" />
              {planDays > 1
                ? `Claude is generating ${planDays} unique days in parallel…`
                : 'Claude is crafting your personalised meal plan…'}
            </div>
          </div>
        )}

        {/* Plan results */}
        {currentPlan && (
          <div className="flex flex-col gap-4">
            {(currentPlan.days ?? []).map((dayPlan, di) => (
              <DayCard
                key={dayPlan.dayNumber ?? di}
                dayPlan={dayPlan}
                dayIdx={di}
                onDayChange={newDay => handleDayChange(di, newDay)}
                onOpenSearch={setSearchModal}
                regeneratingMeal={regeneratingMeal}
                onRegenerateMeal={handleRegenerateMeal}
                defaultOpen={di === 0}
              />
            ))}

            {/* Disclaimer */}
            <div className="flex items-start gap-2 bg-amber-50 rounded-2xl p-4">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                AI-generated plan — for guidance only. Consult a registered dietitian for personalised nutrition advice.
              </p>
            </div>

            {/* Save plan */}
            {!showSaveInput ? (
              <button onClick={() => { setShowSaveInput(true); setSaveName(''); }}
                className={`w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl border-2 transition-all ${
                  hasUnsavedChanges
                    ? 'bg-primary text-white border-primary hover:bg-primary-dark'
                    : 'bg-white border-primary text-primary hover:bg-primary-light'
                }`}>
                <BookmarkPlus size={18} />
                {hasUnsavedChanges ? 'Save Plan  •  Unsaved changes' : 'Save This Plan'}
              </button>
            ) : (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-sm font-semibold text-gray-800">Name this plan</p>
                <input type="text" placeholder="e.g. My Mediterranean Week" value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePlan()}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoFocus />
                <div className="flex gap-2">
                  <button onClick={savePlan} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-all">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <BookmarkPlus size={16} />}
                    {saving ? 'Saving…' : 'Save Plan'}
                  </button>
                  <button onClick={() => setShowSaveInput(false)}
                    className="px-4 py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Generate Grocery List */}
            <button
              onClick={() => { setGrocerySavedList(null); setShowGrocery(true); }}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-700 font-semibold py-3.5 rounded-2xl hover:border-primary hover:text-primary hover:bg-primary-light transition-all"
            >
              <ShoppingCart size={18} />Generate Grocery List
            </button>
          </div>
        )}

        {/* Saved Plans */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={16} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Saved Plans</p>
            {savedPlans.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{savedPlans.length}</span>
            )}
          </div>
          {savedPlans.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center">
              <span className="text-4xl mb-2">📅</span>
              <p className="text-base font-semibold text-gray-700 mb-1">No saved plans yet</p>
              <p className="text-sm text-gray-400">Generate your first AI meal plan above, then tap "Save This Plan" to keep it here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {savedPlans.map(plan => (
                <SavedPlanCard key={plan.id} plan={plan}
                  onLoad={() => loadSavedPlan(plan)}
                  onDelete={() => deleteSavedPlan(plan.id)}
                  deleting={deletingId === plan.id} />
              ))}
            </div>
          )}
        </div>

        {/* My Grocery Lists */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart size={16} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">My Grocery Lists</p>
            {groceryLists.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{groceryLists.length}</span>
            )}
          </div>
          {groceryLists.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
              <p className="text-sm text-gray-400">No grocery lists yet</p>
              <p className="text-xs text-gray-300 mt-1">Generate a meal plan and tap &ldquo;Generate Grocery List&rdquo;</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groceryLists.map(list => (
                <GroceryListCard
                  key={list.id}
                  list={list}
                  onLoad={() => { setGrocerySavedList(list); setShowGrocery(true); }}
                  onDelete={async () => {
                    try {
                      await axios.delete(`/api/grocery/${list.id}`);
                      await fetchGroceryLists();
                    } catch { toast.error('Failed to delete list'); }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Food search modal */}
      <FoodSearchModal
        isOpen={!!searchModal}
        onClose={() => setSearchModal(null)}
        onSelect={handleSearchSelect}
        currentItem={searchModal?.mode === 'replace' ? searchModal.currentItem : null}
        title={searchModal?.mode === 'replace' ? 'Swap Food' : 'Add Food'}
      />

      {/* Grocery list overlay */}
      <GroceryList
        isOpen={showGrocery}
        onClose={() => { setShowGrocery(false); setGrocerySavedList(null); fetchGroceryLists(); }}
        plan={grocerySavedList ? null : currentPlan}
        savedList={grocerySavedList}
        onListSaved={() => fetchGroceryLists()}
      />
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────────────────────

class AIPlanErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[AIPlan crash]', error, info.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div className="pb-24 min-h-screen">
          <div className="bg-gradient-to-br from-primary to-primary-dark px-5 pt-12 pb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={20} className="text-white/80" />
              <span className="font-syne font-bold text-white text-xl">AI Meal Plan</span>
            </div>
          </div>
          <div className="px-5 pt-12 flex flex-col items-center text-center gap-4">
            <AlertCircle size={44} className="text-red-400" />
            <p className="font-syne font-bold text-lg text-gray-900">Something went wrong</p>
            <p className="text-sm text-gray-500 max-w-xs">{this.state.error?.message}</p>
            <button onClick={() => this.setState({ error: null })}
              className="mt-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-dark transition-colors">
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AIPlanPage() {
  return <AIPlanErrorBoundary><AIPlan /></AIPlanErrorBoundary>;
}
