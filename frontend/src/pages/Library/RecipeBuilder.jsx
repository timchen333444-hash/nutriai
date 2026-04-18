import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Search, X, Loader2, Plus, ChevronLeft, Trash2, Pencil,
  ChevronDown, ChevronUp, BookmarkPlus, UtensilsCrossed, Globe,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';
import ServingSizeSelector from '../../components/ui/ServingSizeSelector';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI = {
  Proteins: '🥩', Dairy: '🥛', Legumes: '🫘', Grains: '🌾',
  Vegetables: '🥦', Fruits: '🍎', 'Nuts & Seeds': '🥜',
  'Oils & Fats': '🫒', 'Dairy Alternatives': '🌱', Other: '🍫',
  Supplements: '💊', Beverages: '☕', Snacks: '🍿', 'Fast Food': '🍔',
};

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

const VITAMIN_KEYS = [
  'vitaminA', 'vitaminD', 'vitaminE', 'vitaminK', 'thiamine', 'riboflavin',
  'niacin', 'pantothenicAcid', 'vitaminB6', 'biotin', 'folate', 'vitaminB12',
  'vitaminC', 'choline',
];
const MINERAL_KEYS = [
  'calcium', 'phosphorus', 'magnesium', 'potassium', 'sodium', 'iron',
  'zinc', 'copper', 'manganese', 'selenium', 'iodine', 'molybdenum',
  'chromium', 'fluoride',
];

const DRV = {
  vitaminA: 900, vitaminD: 15, vitaminE: 15, vitaminK: 120,
  thiamine: 1.2, riboflavin: 1.3, niacin: 16, pantothenicAcid: 5,
  vitaminB6: 1.3, biotin: 30, folate: 400, vitaminB12: 2.4,
  vitaminC: 90, choline: 550,
  calcium: 1000, phosphorus: 700, magnesium: 420, potassium: 3500,
  sodium: 2300, iron: 8, zinc: 11, copper: 0.9, manganese: 2.3,
  selenium: 55, iodine: 150, molybdenum: 45, chromium: 35, fluoride: 4,
};

const UNITS_MAP = {
  vitaminA: 'mcg', vitaminD: 'mcg', vitaminE: 'mg', vitaminK: 'mcg',
  thiamine: 'mg', riboflavin: 'mg', niacin: 'mg', pantothenicAcid: 'mg',
  vitaminB6: 'mg', biotin: 'mcg', folate: 'mcg', vitaminB12: 'mcg',
  vitaminC: 'mg', choline: 'mg',
  calcium: 'mg', phosphorus: 'mg', magnesium: 'mg', potassium: 'mg',
  sodium: 'mg', iron: 'mg', zinc: 'mg', copper: 'mg', manganese: 'mg',
  selenium: 'mcg', iodine: 'mcg', molybdenum: 'mcg', chromium: 'mcg', fluoride: 'mg',
};

const LABELS_MAP = {
  vitaminA: 'Vitamin A', vitaminD: 'Vitamin D', vitaminE: 'Vitamin E', vitaminK: 'Vitamin K',
  thiamine: 'B1 Thiamine', riboflavin: 'B2 Riboflavin', niacin: 'B3 Niacin',
  pantothenicAcid: 'B5 Pantothenic', vitaminB6: 'B6', biotin: 'B7 Biotin',
  folate: 'B9 Folate', vitaminB12: 'B12', vitaminC: 'Vitamin C', choline: 'Choline',
  calcium: 'Calcium', phosphorus: 'Phosphorus', magnesium: 'Magnesium',
  potassium: 'Potassium', sodium: 'Sodium', iron: 'Iron', zinc: 'Zinc',
  copper: 'Copper', manganese: 'Manganese', selenium: 'Selenium',
  iodine: 'Iodine', molybdenum: 'Molybdenum', chromium: 'Chromium', fluoride: 'Fluoride',
};

// ── Nutrition helpers ─────────────────────────────────────────────────────────

function buildIngredientFromFood(food, grams) {
  const servingSize = food.servingSize || 100;
  const mult = grams / servingSize;
  const sc = (v) => Math.round((v ?? 0) * mult * 10) / 10;
  const scObj = (obj) =>
    Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, sc(v)]));

  return {
    foodId:      food.id,
    foodName:    food.name,
    category:    food.category,
    servingSize,
    grams,
    calories: sc(food.calories),
    protein:  sc(food.protein),
    carbs:    sc(food.carbs),
    fat:      sc(food.fat),
    fiber:    sc(food.fiber || 0),
    nutrients: {
      aminoAcids: scObj(food.aminoAcids || {}),
      fattyAcids: scObj(food.fattyAcids || {}),
      vitamins:   scObj(food.vitamins   || {}),
      minerals:   scObj(food.minerals   || {}),
    },
    // Base values per servingSize for recalculation when grams changes
    base: {
      calories: food.calories || 0,
      protein:  food.protein  || 0,
      carbs:    food.carbs    || 0,
      fat:      food.fat      || 0,
      fiber:    food.fiber    || 0,
      nutrients: {
        aminoAcids: { ...(food.aminoAcids || {}) },
        fattyAcids: { ...(food.fattyAcids || {}) },
        vitamins:   { ...(food.vitamins   || {}) },
        minerals:   { ...(food.minerals   || {}) },
      },
    },
  };
}

function recalcIngredient(ing, newGrams) {
  const mult = newGrams / ing.servingSize;
  const sc = (v) => Math.round((v ?? 0) * mult * 10) / 10;
  const scObj = (obj) =>
    Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, sc(v)]));
  return {
    ...ing,
    grams:    newGrams,
    calories: sc(ing.base.calories),
    protein:  sc(ing.base.protein),
    carbs:    sc(ing.base.carbs),
    fat:      sc(ing.base.fat),
    fiber:    sc(ing.base.fiber),
    nutrients: {
      aminoAcids: scObj(ing.base.nutrients.aminoAcids),
      fattyAcids: scObj(ing.base.nutrients.fattyAcids),
      vitamins:   scObj(ing.base.nutrients.vitamins),
      minerals:   scObj(ing.base.nutrients.minerals),
    },
  };
}

function sumTotals(ingredients) {
  const merge = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b || {})) out[k] = (out[k] || 0) + v;
    return out;
  };
  return ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein:  acc.protein  + ing.protein,
      carbs:    acc.carbs    + ing.carbs,
      fat:      acc.fat      + ing.fat,
      fiber:    acc.fiber    + ing.fiber,
      nutrients: {
        aminoAcids: merge(acc.nutrients.aminoAcids, ing.nutrients.aminoAcids),
        fattyAcids: merge(acc.nutrients.fattyAcids, ing.nutrients.fattyAcids),
        vitamins:   merge(acc.nutrients.vitamins,   ing.nutrients.vitamins),
        minerals:   merge(acc.nutrients.minerals,   ing.nutrients.minerals),
      },
    }),
    {
      calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
      nutrients: { aminoAcids: {}, fattyAcids: {}, vitamins: {}, minerals: {} },
    }
  );
}

// ── Micro section (collapsible) ───────────────────────────────────────────────

function MicroSection({ title, emoji, keys, values, divisor }) {
  const [open, setOpen] = useState(false);
  const available = keys.filter((k) => (values[k] || 0) > 0);
  if (!available.length) return null;

  const avg =
    available.reduce((s, k) => {
      const drv = DRV[k] || 1;
      return s + Math.min(((values[k] || 0) / divisor / drv) * 100, 100);
    }, 0) / available.length;

  const badgeColor =
    avg >= 90 ? 'bg-primary-light text-primary' :
    avg >= 50 ? 'bg-amber-50 text-amber-700' :
                'bg-red-50 text-red-600';

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{emoji}</span>
          <span className="font-semibold text-sm">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
            {Math.round(avg)}% DRV
          </span>
        </div>
        {open
          ? <ChevronUp size={16} className="text-gray-400" />
          : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-3 bg-gray-50/50 divide-y divide-gray-50">
          {available.map((k) => {
            const val = (values[k] || 0) / divisor;
            const drv = DRV[k] || 1;
            const pct = Math.min((val / drv) * 100, 150);
            const pctD = Math.round((val / drv) * 100);
            const barColor =
              pctD >= 90 ? 'bg-primary' : pctD >= 50 ? 'bg-amber-400' : 'bg-red-400';
            const textColor =
              pctD >= 90 ? 'text-primary' : pctD >= 50 ? 'text-amber-600' : 'text-red-500';
            return (
              <div key={k} className="flex items-center gap-3 py-2">
                <span className="text-xs text-gray-600 w-28 flex-shrink-0">{LABELS_MAP[k]}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full progress-bar ${barColor}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-10 text-right flex-shrink-0 ${textColor}`}>
                  {pctD}%
                </span>
                <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">
                  {val > 1 ? val.toFixed(1) : val.toFixed(2)}{UNITS_MAP[k]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Ingredient row ────────────────────────────────────────────────────────────

function IngredientRow({ ing, onGramsChange, onRemove }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-1.5">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-7 h-7 flex items-center justify-center text-base flex-shrink-0">
          {CATEGORY_EMOJI[ing.category] || '🍽️'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{ing.foodName}</p>
          <p className="text-xs text-gray-400">
            {Math.round(ing.calories)} kcal · P{ing.protein}g C{ing.carbs}g F{ing.fat}g
          </p>
        </div>
        <button
          onClick={onRemove}
          className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>
      <ServingSizeSelector
        food={{ id: ing.foodId, name: ing.foodName, category: ing.category, servingSize: ing.servingSize }}
        grams={ing.grams}
        onChange={onGramsChange}
        compact
      />
    </div>
  );
}

// ── Community tags ────────────────────────────────────────────────────────────

const COMMUNITY_TAGS = [
  'High Protein', 'Low Calorie', 'Low Carb', 'Keto', 'Vegan', 'Vegetarian',
  'Gluten Free', 'High Fiber', 'Quick', 'Meal Prep', 'Budget Friendly', 'Dairy Free',
];

// ── Builder view (create / edit) ──────────────────────────────────────────────

function BuilderView({ mode, initialData, onBack, onSave, saving }) {
  const toast = useToast();

  const [name,        setName]        = useState(initialData?.name     || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [servings,    setServings]    = useState(initialData?.servings || 1);
  const [ingredients, setIngredients] = useState(initialData?.ingredients || []);
  const [perServing,  setPerServing]  = useState(false);
  const [isPublic,    setIsPublic]    = useState(initialData?.isPublic || false);
  const [selectedTags, setSelectedTags] = useState(
    Array.isArray(initialData?.tags) ? initialData.tags : []
  );

  const toggleTag = (tag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const [searchQ,       setSearchQ]       = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const timerRef = useRef(null);

  // Debounced local food search
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); setSearching(false); return; }
    clearTimeout(timerRef.current);
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`/api/foods?q=${encodeURIComponent(searchQ)}`);
        setSearchResults(data.slice(0, 8));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [searchQ]);

  const addFood = (food) => {
    const grams = food.servingSize || 100;
    setIngredients((prev) => [...prev, buildIngredientFromFood(food, grams)]);
    setSearchQ('');
    setSearchResults([]);
  };

  const updateGrams = (idx, newGrams) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? recalcIngredient(ing, newGrams) : ing))
    );
  };

  const removeIngredient = (idx) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const totals = useMemo(() => sumTotals(ingredients), [ingredients]);

  const div = perServing ? Math.max(1, Number(servings)) : 1;
  const r   = (v) => Math.round((v / div) * 10) / 10;

  const handleSave = () => {
    if (!name.trim())        { toast.error('Enter a recipe name');          return; }
    if (!ingredients.length) { toast.error('Add at least one ingredient'); return; }
    onSave({
      name:          name.trim(),
      description:   description.trim() || null,
      servings:      Math.max(1, parseInt(servings) || 1),
      ingredients,
      totalCalories: totals.calories,
      totalProtein:  totals.protein,
      totalCarbs:    totals.carbs,
      totalFat:      totals.fat,
      totalFiber:    totals.fiber,
      nutrientData:  totals.nutrients,
      isPublic,
      tags:          selectedTags,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-700 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <p className="font-syne font-semibold text-base">
          {mode === 'edit' ? 'Edit Recipe' : 'New Recipe'}
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Name + Servings */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Recipe Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High Protein Bowl"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="w-24 flex-shrink-0">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Servings
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={servings}
              onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Description <span className="font-normal normal-case text-gray-400">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe this recipe…"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Share with community */}
        <div className="border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe size={15} className={isPublic ? 'text-primary' : 'text-gray-400'} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Share with community</p>
                <p className="text-xs text-gray-400">Visible to all NutriAI users</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic((p) => !p)}
              className={`relative inline-flex w-10 h-5.5 items-center rounded-full transition-colors flex-shrink-0 ${
                isPublic ? 'bg-primary' : 'bg-gray-200'
              }`}
              style={{ height: '22px', width: '40px' }}
            >
              <span
                className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  isPublic ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {isPublic && (
            <div className="mt-3">
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-3">
                Your recipe will be visible to all NutriAI users. Your name will be shown as the creator.
              </p>
              <p className="text-xs font-semibold text-gray-500 mb-2">Add tags to help others find it</p>
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

        {/* Ingredient list */}
        {ingredients.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ingredients ({ingredients.length})
              </label>
              <span className="text-xs text-primary font-semibold">
                {Math.round(totals.calories)} kcal total
              </span>
            </div>
            {ingredients.map((ing, i) => (
              <IngredientRow
                key={`${ing.foodId}-${i}`}
                ing={ing}
                onGramsChange={(g) => updateGrams(i, g)}
                onRemove={() => removeIngredient(i)}
              />
            ))}
          </div>
        )}

        {/* Food search */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
            Add Ingredient
          </label>
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search food library…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searching
              ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
              : searchQ && (
                  <button
                    onClick={() => setSearchQ('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <X size={13} />
                  </button>
                )
            }
          </div>

          {searchResults.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {searchResults.map((food) => (
                <button
                  key={food.id}
                  onClick={() => addFood(food)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-primary-light text-left transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base flex-shrink-0">
                      {CATEGORY_EMOJI[food.category] || '🍽️'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{food.name}</p>
                      <p className="text-xs text-gray-400">
                        {food.servingSize}{food.servingUnit} · {Math.round(food.calories)} kcal
                      </p>
                    </div>
                  </div>
                  <Plus size={16} className="text-primary flex-shrink-0 ml-2" />
                </button>
              ))}
            </div>
          )}

          {searchQ.trim() && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              No foods found for &ldquo;{searchQ}&rdquo;
            </p>
          )}
        </div>

        {/* Nutrition panel */}
        {ingredients.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Nutrition
              </label>
              {Number(servings) > 1 && (
                <button
                  onClick={() => setPerServing((p) => !p)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border-2 transition-all ${
                    perServing
                      ? 'border-primary bg-primary-light text-primary'
                      : 'border-gray-200 text-gray-400'
                  }`}
                >
                  Per serving
                </button>
              )}
            </div>

            {/* Macro card */}
            <div className="bg-primary rounded-2xl p-4 grid grid-cols-5 gap-1 text-white text-center mb-3">
              {[
                { l: 'Cal',    v: Math.round(totals.calories / div), u: 'kcal' },
                { l: 'Protein', v: r(totals.protein), u: 'g' },
                { l: 'Carbs',   v: r(totals.carbs),   u: 'g' },
                { l: 'Fat',     v: r(totals.fat),      u: 'g' },
                { l: 'Fiber',   v: r(totals.fiber),    u: 'g' },
              ].map((m) => (
                <div key={m.l}>
                  <p className="font-bold text-base leading-tight">{m.v}</p>
                  <p className="text-[10px] opacity-70">{m.u}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{m.l}</p>
                </div>
              ))}
            </div>

            {/* Micro accordion */}
            <div className="space-y-2">
              <MicroSection
                title="Vitamins" emoji="💊"
                keys={VITAMIN_KEYS}
                values={totals.nutrients.vitamins}
                divisor={div}
              />
              <MicroSection
                title="Minerals" emoji="⚗️"
                keys={MINERAL_KEYS}
                values={totals.nutrients.minerals}
                divisor={div}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sticky save footer */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3.5 rounded-2xl hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {saving
            ? <><Loader2 size={18} className="animate-spin" />Saving…</>
            : <><BookmarkPlus size={18} />{mode === 'edit' ? 'Update Recipe' : 'Save Recipe'}</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Recipe card ───────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onEdit, onDelete, onAddToLog, deleting }) {
  const toast  = useToast();
  const [mealOpen, setMealOpen] = useState(false);
  const [adding,   setAdding]   = useState(false);

  const servings  = Math.max(1, recipe.servings);
  const perSvg    = (v) => Math.round((v / servings) * 10) / 10;

  const handleAdd = async (meal) => {
    setAdding(true);
    let added = 0;
    for (const ing of recipe.ingredients) {
      try {
        await axios.post('/api/log', {
          foodId:     ing.foodId,
          meal,
          multiplier: ing.grams / (ing.servingSize || 100),
        });
        added++;
      } catch { /* skip any missing foods */ }
    }
    setAdding(false);
    setMealOpen(false);
    if (added > 0) {
      onAddToLog();
      toast.success(
        `${recipe.name} added to ${meal} — ${added} ingredient${added !== 1 ? 's' : ''}`
      );
    } else {
      toast.error('Could not log recipe — ingredients may no longer exist in library');
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{recipe.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''} ·{' '}
            {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
          </p>

          {/* Calories per serving */}
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-lg font-bold text-primary">
              {Math.round(perSvg(recipe.totalCalories))}
            </span>
            <span className="text-xs text-gray-400">kcal / serving</span>
          </div>

          {/* Macro chips */}
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {[
              { l: 'P', v: perSvg(recipe.totalProtein) },
              { l: 'C', v: perSvg(recipe.totalCarbs)   },
              { l: 'F', v: perSvg(recipe.totalFat)      },
              { l: 'Fiber', v: perSvg(recipe.totalFiber) },
            ].map((m) => (
              <span
                key={m.l}
                className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium"
              >
                {m.l} {m.v}g
              </span>
            ))}
          </div>
        </div>

        {/* Edit / Delete */}
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-primary transition-colors rounded-lg hover:bg-gray-50"
            title="Edit recipe"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-50"
            title="Delete recipe"
          >
            {deleting
              ? <Loader2 size={14} className="animate-spin" />
              : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {/* Add to log / meal selector */}
      {!mealOpen ? (
        <button
          onClick={() => setMealOpen(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors text-sm"
        >
          Add to Log
        </button>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-gray-500 font-medium mb-2">Add to which meal?</p>
          <div className="flex gap-1.5">
            {MEALS.map((m) => (
              <button
                key={m}
                onClick={() => handleAdd(m)}
                disabled={adding}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border-2 border-primary bg-primary-light text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-60"
              >
                {adding
                  ? <Loader2 size={12} className="animate-spin mx-auto" />
                  : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setMealOpen(false)}
              className="px-3 py-2 rounded-xl text-xs font-semibold border-2 border-gray-200 text-gray-400 hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RecipeBuilder({ onLogAdded }) {
  const toast = useToast();

  const [recipes,    setRecipes]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [builderOpen,setBuilderOpen]= useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { loadRecipes(); }, []);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/recipes');
      setRecipes(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditTarget(null); setBuilderOpen(true); };
  const openEdit   = (r)  => { setEditTarget(r);    setBuilderOpen(true); };
  const closeBuilder = () => { setBuilderOpen(false); setEditTarget(null); };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editTarget) {
        const { data } = await axios.put(`/api/recipes/${editTarget.id}`, payload);
        setRecipes((prev) => prev.map((r) => r.id === data.id ? data : r));
        toast.success('Recipe updated!');
      } else {
        const { data } = await axios.post('/api/recipes', payload);
        setRecipes((prev) => [data, ...prev]);
        toast.success('Recipe saved!');
      }
      closeBuilder();
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Unknown error';
      console.error('[RecipeBuilder] save failed — status:', e.response?.status, '| error:', msg);
      toast.error(`Failed to save recipe: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await axios.delete(`/api/recipes/${id}`);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error('Failed to delete recipe');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="px-5 pt-4 pb-24">
        {/* Create button */}
        <button
          onClick={openCreate}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-3.5 text-sm text-gray-400 hover:border-primary hover:text-primary transition-all font-medium mb-5"
        >
          <Plus size={16} />New Recipe
        </button>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && recipes.length === 0 && (
          <div className="text-center py-16">
            <UtensilsCrossed size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No recipes yet</p>
            <p className="text-xs text-gray-300 mt-1">
              Tap &ldquo;New Recipe&rdquo; to build your first one
            </p>
          </div>
        )}

        {/* Recipe cards */}
        {!loading && recipes.length > 0 && (
          <div className="flex flex-col gap-3">
            {recipes.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onEdit={() => openEdit(r)}
                onDelete={() => handleDelete(r.id)}
                onAddToLog={onLogAdded || (() => {})}
                deleting={deletingId === r.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Builder modal */}
      <Modal isOpen={builderOpen} onClose={closeBuilder} fullHeight>
        <BuilderView
          mode={editTarget ? 'edit' : 'create'}
          initialData={editTarget}
          onBack={closeBuilder}
          onSave={handleSave}
          saving={saving}
        />
      </Modal>
    </>
  );
}
