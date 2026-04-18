import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X, Copy, Share2, Trash2, Plus, Check, Loader2,
  ShoppingCart, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

// ── Section definitions ───────────────────────────────────────────────────────

export const SECTIONS = [
  { name: 'Produce',             emoji: '🥦' },
  { name: 'Proteins',            emoji: '🥩' },
  { name: 'Dairy & Eggs',        emoji: '🥛' },
  { name: 'Grains & Bread',      emoji: '🌾' },
  { name: 'Canned & Packaged',   emoji: '🥫' },
  { name: 'Nuts, Seeds & Oils',  emoji: '🥜' },
  { name: 'Beverages',           emoji: '🥤' },
  { name: 'Frozen',              emoji: '❄️' },
  { name: 'Other',               emoji: '🛒' },
];

// ── Categorisation ────────────────────────────────────────────────────────────

function categoriseFood(name) {
  const t = name.toLowerCase();
  if (/\b(frozen|freeze)\b/.test(t)) return 'Frozen';
  if (/\b(coffee|tea\b|juice|soda|sparkling water|coconut water|almond milk|oat milk|soy milk|plant.based milk|kombucha|lemonade|smoothie)\b/.test(t)) return 'Beverages';
  if (/\b(chicken|beef|pork|turkey|lamb|salmon|tuna|tilapia|cod|halibut|bass|shrimp|crab|lobster|prawn|scallop|fish\b|steak|ground\s+\w+|sausage|bacon|ham|deli\s+meat|tofu|tempeh|seitan|edamame|protein\s+powder|whey|casein)\b/.test(t)) return 'Proteins';
  if (/\b(egg\b|eggs\b)/.test(t) && !/eggplant/.test(t)) return 'Dairy & Eggs';
  if (/\b(milk\b|yogurt|cheese|butter\b|cream\b|sour\s+cream|cottage|mozzarella|cheddar|parmesan|feta|ricotta|kefir|dairy|cream\s+cheese|half[\s-]and[\s-]half|heavy\s+cream)\b/.test(t)) return 'Dairy & Eggs';
  if (/\b(apple|banana|orange|strawberr|blueberr|raspberr|blackberr|grape|mango|peach|pear|melon|watermelon|pineapple|cherry|plum|kiwi|papaya|fig|date\b|lemon|lime|grapefruit|avocado|tomato|pepper|bell\s+pepper|onion|garlic|shallot|spinach|kale|lettuce|arugula|broccoli|cauliflower|carrot|cucumber|zucchini|sweet\s+potato|potato|celery|asparagus|mushroom|corn\b|green\s+bean|snap\s+pea|cabbage|beet|radish|bok\s+choy|leek|fennel|artichoke|eggplant|squash|herb\b|basil|cilantro|parsley|mint|dill|thyme|rosemary|vegetable|fruit\b|salad\b|greens|sprout)\b/.test(t)) return 'Produce';
  if (/\b(rice|quinoa|oat\b|oatmeal|bread|pasta|noodle|spaghetti|penne|fettuccine|tortilla|wrap\b|pita|bagel|roll\b|bun\b|flour|wheat|barley|farro|millet|couscous|cracker|granola|cereal|bulgur|polenta|cornmeal|rye|sourdough)\b/.test(t)) return 'Grains & Bread';
  if (/\b(almond\b|walnut|cashew|peanut|pistachio|pecan|macadamia|hazelnut|nut\b|nuts\b|seed\b|seeds\b|sunflower\s+seed|pumpkin\s+seed|chia|flax|hemp|sesame|olive\s+oil|coconut\s+oil|avocado\s+oil|\boil\b|peanut\s+butter|almond\s+butter|nut\s+butter|tahini)\b/.test(t)) return 'Nuts, Seeds & Oils';
  if (/\b(bean\b|beans\b|lentil|chickpea|black\s+bean|kidney|navy\s+bean|cannellini|sauce\b|tomato\s+sauce|pasta\s+sauce|tomato\s+paste|salsa|soup\b|broth|stock\b|dressing|marinade|soy\s+sauce|hot\s+sauce|vinegar|hummus|coconut\s+milk|canned|tuna\s+can)\b/.test(t)) return 'Canned & Packaged';
  return 'Other';
}

// ── Quantity parsing & aggregation ────────────────────────────────────────────

const UNIT_ALIASES = { tablespoon: 'tbsp', tablespoons: 'tbsp', teaspoon: 'tsp', teaspoons: 'tsp', cup: 'cup', cups: 'cup', ounce: 'oz', ounces: 'oz', pound: 'lb', pounds: 'lb', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', milliliter: 'ml', milliliters: 'ml', liter: 'l', liters: 'l' };

function parseQty(amountStr) {
  if (!amountStr) return { qty: 1, unit: '' };
  const s = amountStr.trim();
  // fractions e.g. "1/2 cup"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)\s*([a-zA-Z]*)/);
  if (frac) return { qty: parseFloat(frac[1]) / parseFloat(frac[2]), unit: (UNIT_ALIASES[frac[3].toLowerCase()] || frac[3].toLowerCase()) };
  // normal e.g. "200g", "1 cup", "3.5 oz"
  const norm = s.match(/^([\d.]+)\s*([a-zA-Z]*)/);
  if (norm) return { qty: parseFloat(norm[1]), unit: (UNIT_ALIASES[norm[2].toLowerCase()] || norm[2].toLowerCase()) };
  return { qty: 1, unit: s };
}

const TO_GRAMS = { g: 1, kg: 1000, oz: 28.35, lb: 453.6, ml: 1, l: 1000, cup: 240, tbsp: 15, tsp: 5, slice: 30, fillet: 150, piece: 100, medium: 120, large: 150, small: 80, handful: 30, serving: 100, egg: 55, scoop: 35 };

const COST_PER_100 = { 'Produce': 0.40, 'Proteins': 1.50, 'Dairy & Eggs': 0.55, 'Grains & Bread': 0.25, 'Canned & Packaged': 0.40, 'Nuts, Seeds & Oils': 1.50, 'Beverages': 0.15, 'Frozen': 0.55, 'Other': 0.50 };

function estimateCost(amounts, section) {
  let totalG = 0;
  for (const a of amounts) {
    const { qty, unit } = parseQty(a);
    totalG += qty * (TO_GRAMS[unit] ?? 100);
  }
  return Math.max(0.25, Math.round((totalG / 100) * (COST_PER_100[section] ?? 0.50) * 100) / 100);
}

function formatQty(amounts) {
  const parsed = amounts.map(parseQty);
  const units  = [...new Set(parsed.map(p => p.unit))];
  if (units.length === 1) {
    const total = parsed.reduce((s, p) => s + p.qty, 0);
    const rounded = Math.round(total * 100) / 100;
    return { quantity: String(rounded), unit: units[0] };
  }
  // mixed units — join the original strings
  return { quantity: amounts.join(' + '), unit: '' };
}

// ── Plan → grocery items ──────────────────────────────────────────────────────

function generateFromPlan(plan) {
  const raw = [];
  for (const day of plan?.days ?? []) {
    for (const meal of day?.meals ?? []) {
      for (const item of meal?.items ?? []) {
        if (item.food) raw.push({ food: item.food.trim(), amount: item.amount || '' });
      }
    }
  }

  // Group by normalised name
  const map = {};
  for (const { food, amount } of raw) {
    const key = food.toLowerCase().replace(/\(.*?\)/g, '').replace(/\b(cooked|raw|fresh|grilled|baked|steamed|fried|roasted|dried)\b/g, '').trim();
    if (!map[key]) map[key] = { name: food, amounts: [] };
    map[key].amounts.push(amount);
  }

  const items = Object.entries(map).map(([, { name, amounts }]) => {
    const section = categoriseFood(name);
    const { quantity, unit } = formatQty(amounts);
    const estimatedCost = estimateCost(amounts, section);
    return {
      id:            Math.random().toString(36).slice(2, 9),
      name:          name.charAt(0).toUpperCase() + name.slice(1),
      quantity,
      unit,
      section,
      checked:       false,
      estimatedCost,
      custom:        false,
    };
  });

  // Sort within sections alphabetically
  return items.sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
}

function autoListName(plan) {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const days = plan?.days?.length ?? 1;
  return `${days === 1 ? '1-Day' : `${days}-Day`} Plan — ${date}`;
}

// ── Plain-text formatter ──────────────────────────────────────────────────────

function formatAsText(items, listName) {
  const sectionMap = {};
  for (const item of items) {
    if (!sectionMap[item.section]) sectionMap[item.section] = [];
    sectionMap[item.section].push(item);
  }
  const lines = [`🛒 ${listName}`, ''];
  for (const { name: sName, emoji } of SECTIONS) {
    const sItems = sectionMap[sName];
    if (!sItems?.length) continue;
    lines.push(`${emoji} ${sName.toUpperCase()}`);
    for (const i of sItems) {
      const qty = i.unit ? `${i.quantity} ${i.unit}` : i.quantity;
      lines.push(`${i.checked ? '✓' : '□'} ${i.name} — ${qty} (~$${i.estimatedCost.toFixed(2)})`);
    }
    lines.push('');
  }
  const total = items.reduce((s, i) => s + (i.estimatedCost || 0), 0);
  lines.push(`Total estimated: ~$${total.toFixed(2)}`);
  return lines.join('\n');
}

// ── Grocery item row ──────────────────────────────────────────────────────────

function GroceryRow({ item, onToggle, onRemove }) {
  const qtyLabel = item.unit ? `${item.quantity} ${item.unit}` : item.quantity;
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 transition-opacity ${item.checked ? 'opacity-50' : ''}`}>
      <button
        onClick={onToggle}
        className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          item.checked ? 'bg-primary border-primary' : 'border-gray-300'
        }`}
      >
        {item.checked && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {item.name}
        </p>
        <p className="text-xs text-gray-400">{qtyLabel}</p>
      </div>
      <p className="text-xs text-gray-400 flex-shrink-0">${item.estimatedCost.toFixed(2)}</p>
      {item.custom && (
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ── Section block ─────────────────────────────────────────────────────────────

function SectionBlock({ section, emoji, items, onToggle, onRemove }) {
  const [open, setOpen] = useState(true);
  const unchecked = items.filter(i => !i.checked);
  const checked   = items.filter(i =>  i.checked);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2 mb-1"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="font-syne font-bold text-sm text-gray-800">{section}</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
            {unchecked.length}/{items.length}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4">
          {unchecked.map(item => (
            <GroceryRow key={item.id} item={item} onToggle={() => onToggle(item.id)} onRemove={() => onRemove(item.id)} />
          ))}
          {checked.map(item => (
            <GroceryRow key={item.id} item={item} onToggle={() => onToggle(item.id)} onRemove={() => onRemove(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main GroceryList component ────────────────────────────────────────────────

export default function GroceryList({ isOpen, onClose, plan, savedList, onListSaved }) {
  const toast = useToast();

  const [items,           setItems]           = useState([]);
  const [listName,        setListName]        = useState('');
  const [listId,          setListId]          = useState(null);
  const [initialSaving,   setInitialSaving]   = useState(false);
  const [customText,      setCustomText]      = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const customRef = useRef(null);
  const saveTimer = useRef(null);

  // ── Initialise on open ──
  useEffect(() => {
    if (!isOpen) return;
    if (savedList) {
      setItems(savedList.items);
      setListName(savedList.name);
      setListId(savedList.id);
    } else if (plan) {
      const generated = generateFromPlan(plan);
      const name      = autoListName(plan);
      setItems(generated);
      setListName(name);
      setListId(null);
      // Auto-save immediately
      (async () => {
        setInitialSaving(true);
        try {
          const total = generated.reduce((s, i) => s + (i.estimatedCost || 0), 0);
          const { data } = await axios.post('/api/grocery', {
            name,
            items:              generated,
            totalEstimatedCost: Math.round(total * 100) / 100,
          });
          setListId(data.id);
          onListSaved?.(data);
          toast.success('Grocery list saved!');
        } catch (e) {
          console.error('[GroceryList] auto-save failed:', e.response?.data?.error || e.message);
        } finally {
          setInitialSaving(false);
        }
      })();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced PUT on item changes ──
  const persistItems = (updatedItems) => {
    if (!listId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const total = updatedItems.reduce((s, i) => s + (i.estimatedCost || 0), 0);
        await axios.put(`/api/grocery/${listId}`, {
          items:              updatedItems,
          totalEstimatedCost: Math.round(total * 100) / 100,
        });
      } catch (e) {
        console.error('[GroceryList] persist failed:', e.message);
      }
    }, 800);
  };

  const updateItems = (updatedItems) => {
    setItems(updatedItems);
    persistItems(updatedItems);
  };

  // ── Toggle checked ──
  const toggleItem = (id) => updateItems(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));

  // ── Remove (custom items only) ──
  const removeItem = (id) => updateItems(items.filter(i => i.id !== id));

  // ── Add custom item ──
  const addCustom = () => {
    const name = customText.trim();
    if (!name) return;
    const section = categoriseFood(name);
    const newItem = {
      id:            Math.random().toString(36).slice(2, 9),
      name:          name.charAt(0).toUpperCase() + name.slice(1),
      quantity:      '1',
      unit:          '',
      section,
      checked:       false,
      estimatedCost: COST_PER_100[section] ?? 0.50,
      custom:        true,
    };
    updateItems([...items, newItem]);
    setCustomText('');
    setShowCustomInput(false);
  };

  // ── Clear all checked ──
  const clearChecked = () => updateItems(items.filter(i => !i.checked));

  // ── Copy to clipboard ──
  const copyList = async () => {
    const text = formatAsText(items, listName);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('List copied to clipboard');
    } catch {
      toast.error('Copy not supported in this browser');
    }
  };

  // ── Share ──
  const shareList = async () => {
    const text = formatAsText(items, listName);
    if (navigator.share) {
      try {
        await navigator.share({ title: listName, text });
      } catch { /* user cancelled */ }
    } else {
      // Fallback to clipboard
      await copyList();
    }
  };

  const checkedCount   = items.filter(i => i.checked).length;
  const totalCost      = items.reduce((s, i) => s + (i.estimatedCost || 0), 0);
  const activeSections = SECTIONS.filter(s => items.some(i => i.section === s.name));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 max-w-app mx-auto">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-5 pt-12 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ShoppingCart size={20} className="text-primary flex-shrink-0" />
            <p className="font-syne font-bold text-lg text-gray-900 truncate">{listName}</p>
            {initialSaving && <Loader2 size={14} className="animate-spin text-gray-400 flex-shrink-0" />}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Cost badge */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">
            {items.length - checkedCount} items remaining
            {checkedCount > 0 && ` · ${checkedCount} checked`}
          </p>
          <span className="text-sm font-bold text-primary">~${totalCost.toFixed(2)} total</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => { setShowCustomInput(v => !v); setTimeout(() => customRef.current?.focus(), 50); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-light text-primary rounded-xl text-xs font-semibold hover:bg-primary hover:text-white transition-all"
          >
            <Plus size={13} />Add item
          </button>
          <button onClick={copyList} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-all">
            <Copy size={13} />Copy
          </button>
          <button onClick={shareList} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-all">
            <Share2 size={13} />Share
          </button>
          {checkedCount > 0 && (
            <button onClick={clearChecked} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-semibold hover:bg-red-100 transition-all">
              <Trash2 size={13} />Clear checked
            </button>
          )}
        </div>

        {/* Custom item input */}
        {showCustomInput && (
          <div className="flex gap-2 mt-3">
            <input
              ref={customRef}
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="e.g. Coconut aminos"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button onClick={addCustom} className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors">
              Add
            </button>
          </div>
        )}
      </div>

      {/* ── List body ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {items.length === 0 && (
          <div className="text-center py-16">
            <ShoppingCart size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No items yet</p>
          </div>
        )}

        {activeSections.map(({ name, emoji }) => (
          <SectionBlock
            key={name}
            section={name}
            emoji={emoji}
            items={items.filter(i => i.section === name)}
            onToggle={toggleItem}
            onRemove={removeItem}
          />
        ))}
      </div>
    </div>
  );
}
