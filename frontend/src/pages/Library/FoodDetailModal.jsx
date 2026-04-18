import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';
import ServingSizeSelector, { getServingPref, saveServingPref } from '../../components/ui/ServingSizeSelector';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function FoodDetailModal({ food, onClose, onAdd }) {
  const [grams, setGrams] = useState(food?.servingSize || 100);
  const [meal, setMeal] = useState('Lunch');
  const toast = useToast();

  // Reset to saved preference (or food default) when food changes
  useEffect(() => {
    if (!food) return;
    const saved = getServingPref(food.id);
    setGrams(saved || food.servingSize || 100);
  }, [food?.id]);

  if (!food) return null;

  const mult = grams / (food.servingSize || 100);
  const scaled = (v) => Math.round(v * mult * 10) / 10;

  const handleAdd = async () => {
    const multiplier = grams / (food.servingSize || 100);
    try {
      await axios.post('/api/log', { foodId: food.id, meal: meal.toLowerCase(), multiplier: parseFloat(multiplier.toFixed(4)) });
      saveServingPref(food.id, grams);
      toast.success(`${food.name} added to ${meal}`);
      onAdd?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add');
    }
  };

  const nutrients = [
    { label: 'Calories', value: scaled(food.calories), unit: 'kcal', highlight: true },
    { label: 'Protein', value: scaled(food.protein), unit: 'g' },
    { label: 'Carbohydrates', value: scaled(food.carbs), unit: 'g' },
    { label: 'Fat', value: scaled(food.fat), unit: 'g' },
    { label: 'Fiber', value: scaled(food.fiber || 0), unit: 'g' },
    { label: 'Sugar', value: scaled(food.sugar || 0), unit: 'g' },
    { label: 'Sodium', value: scaled(food.sodium || 0), unit: 'mg' },
  ];

  return (
    <Modal isOpen={!!food} onClose={onClose} title={food.name} fullHeight>
      <div className="p-5 flex flex-col gap-5">
        {/* Category & serving */}
        <div className="flex items-center gap-2">
          <span className="text-xs bg-primary-light text-primary-dark px-3 py-1 rounded-full font-medium">
            {food.category}
          </span>
          <span className="text-xs text-gray-400">
            per {food.servingSize}{food.servingUnit}
          </span>
        </div>

        {/* Serving adjuster */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Serving size</p>
          <ServingSizeSelector
            food={food}
            grams={grams}
            onChange={setGrams}
          />
        </div>

        {/* Macros */}
        <div className="bg-primary rounded-2xl p-4 grid grid-cols-4 gap-2 text-white text-center">
          {[
            { l: 'Calories', v: scaled(food.calories), u: 'kcal' },
            { l: 'Protein', v: scaled(food.protein), u: 'g' },
            { l: 'Carbs', v: scaled(food.carbs), u: 'g' },
            { l: 'Fat', v: scaled(food.fat), u: 'g' },
          ].map((m) => (
            <div key={m.l}>
              <p className="font-bold text-lg">{m.v}</p>
              <p className="text-xs opacity-70">{m.u}</p>
              <p className="text-[10px] opacity-60 mt-0.5">{m.l}</p>
            </div>
          ))}
        </div>

        {/* Detailed nutrients */}
        <div>
          <p className="font-semibold text-sm mb-2">All nutrients</p>
          <div className="divide-y divide-gray-50">
            {nutrients.slice(2).map((n) => (
              <div key={n.label} className="flex justify-between py-2 text-sm">
                <span className="text-gray-600">{n.label}</span>
                <span className="font-medium">{n.value} {n.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Amino acids preview */}
        {food.aminoAcids && Object.keys(food.aminoAcids).length > 0 && (
          <div>
            <p className="font-semibold text-sm mb-2">Key amino acids</p>
            <div className="flex flex-wrap gap-1.5">
              {['leucine', 'lysine', 'isoleucine', 'valine', 'tryptophan'].map((aa) => (
                food.aminoAcids[aa] != null && (
                  <span key={aa} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                    {aa}: {(food.aminoAcids[aa] * mult).toFixed(2)}g
                  </span>
                )
              ))}
            </div>
          </div>
        )}

        {/* Meal select */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Add to meal</p>
          <div className="grid grid-cols-2 gap-2">
            {MEALS.map((m) => (
              <button
                key={m}
                onClick={() => setMeal(m)}
                className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  meal === m ? 'border-primary bg-primary-light text-primary' : 'border-gray-100 text-gray-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAdd}
          className="w-full bg-primary text-white font-semibold py-4 rounded-2xl hover:bg-primary-dark transition-colors text-base"
        >
          Add to Today → {meal}
        </button>
      </div>
    </Modal>
  );
}
