import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';

// The 6 items shown — matched by exact name from the local DB after seeding
const POPULAR_NAMES = [
  'Big Mac',
  'Large Fries',
  'Chicken Burrito Bowl',
  'Original Chicken Sandwich',
  'Crunchy Taco',
  'Grande Caffe Latte',
];

const BRAND_EMOJI = {
  "McDonald's":   '🍔',
  "Chipotle":     '🌯',
  "Subway":       '🥖',
  "Starbucks":    '☕',
  "Chick-fil-A":  '🐔',
  "Panera Bread": '🥣',
  "Taco Bell":    '🌮',
  "Pizza Hut":    '🍕',
};

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function RestaurantQuickAdd({ onAdd }) {
  const toast = useToast();
  const [items,    setItems]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [meal,     setMeal]     = useState('Lunch');
  const [adding,   setAdding]   = useState(false);

  useEffect(() => {
    axios.get('/api/foods?category=Restaurants').then(({ data }) => {
      const popular = POPULAR_NAMES
        .map((name) => data.find((f) => f.name === name))
        .filter(Boolean);
      setItems(popular);
    }).catch(() => {/* silent — section simply won't render */});
  }, []);

  if (!items.length) return null;

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    try {
      await axios.post('/api/log', {
        foodId:     selected.id,
        meal:       meal.toLowerCase(),
        multiplier: 1,
      });
      toast.success(`${selected.name} added to ${meal}`);
      onAdd();
      setSelected(null);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mb-4">
      <h2 className="font-syne font-bold text-base mb-3">Popular at restaurants</h2>

      {/* Horizontal scroll row */}
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="flex-shrink-0 flex flex-col items-center bg-white border border-gray-100 rounded-2xl px-3 py-3 w-24 hover:border-primary hover:bg-primary-light transition-all shadow-sm"
          >
            <span className="text-2xl mb-1.5">
              {BRAND_EMOJI[item.brand] || '🍽️'}
            </span>
            <p className="text-[11px] font-semibold text-gray-800 text-center leading-tight line-clamp-2 w-full">
              {item.name}
            </p>
            <p className="text-[11px] text-primary font-bold mt-1">
              {Math.round(item.calories)} kcal
            </p>
          </button>
        ))}
      </div>

      {/* Quick-add modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Quick Add">
        {selected && (
          <div className="p-5 flex flex-col gap-4">
            {/* Item summary */}
            <div className="bg-primary-light rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{BRAND_EMOJI[selected.brand] || '🍽️'}</span>
                <div>
                  <p className="font-semibold text-gray-900 leading-tight">{selected.name}</p>
                  <p className="text-xs text-gray-500">{selected.brand}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { l: 'Kcal',    v: Math.round(selected.calories) },
                  { l: 'Protein', v: `${Math.round(selected.protein)}g`  },
                  { l: 'Carbs',   v: `${Math.round(selected.carbs)}g`    },
                  { l: 'Fat',     v: `${Math.round(selected.fat)}g`      },
                ].map((m) => (
                  <div key={m.l}>
                    <p className="font-bold text-primary text-lg leading-tight">{m.v}</p>
                    <p className="text-xs text-gray-400">{m.l}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-2">
                1 serving · {selected.servingSize}{selected.servingUnit}
                {selected.fiber > 0 && ` · ${Math.round(selected.fiber)}g fiber`}
                {selected.sodium > 0 && ` · ${Math.round(selected.sodium)}mg sodium`}
              </p>
            </div>

            {/* Meal picker */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Add to meal</p>
              <div className="grid grid-cols-2 gap-2">
                {MEALS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMeal(m)}
                    className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      meal === m
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-gray-100 text-gray-500'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={adding}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3.5 rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors"
            >
              {adding
                ? <><Loader2 size={16} className="animate-spin" />Adding…</>
                : `Add to ${meal}`}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
