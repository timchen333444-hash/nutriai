import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Search, Scan, Camera, Loader2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';
import BarcodeScanner from './BarcodeScanner';
import ServingSizeSelector, { getServingPref, saveServingPref } from '../../components/ui/ServingSizeSelector';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function FoodSearch({ onAdd }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [meal, setMeal] = useState('Breakfast');
  const [grams, setGrams] = useState(100);
  const [showBarcode, setShowBarcode] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoResult, setPhotoResult] = useState(null);
  const [showPhotoResult, setShowPhotoResult] = useState(false);
  // fdcId of the USDA food currently being imported (shows spinner on that row)
  const [importingFdcId, setImportingFdcId] = useState(null);
  const [photoUsage,     setPhotoUsage]     = useState(null);
  const fileRef = useRef(null);
  const toast = useToast();
  const timer = useRef(null);

  // Fetch photo usage on mount
  useEffect(() => {
    axios.get('/api/usage').then(r => setPhotoUsage(r.data?.aiPhotos)).catch(() => {});
  }, []);

  // Reset grams to last-used preference (or food's default serving size) when a food is selected
  useEffect(() => {
    if (!selectedFood) return;
    const saved = getServingPref(selectedFood.id);
    setGrams(saved || selectedFood.servingSize || 100);
  }, [selectedFood?.id]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Search local DB and USDA in parallel
        const [localRes, usdaRes] = await Promise.allSettled([
          axios.get(`/api/foods?q=${encodeURIComponent(query)}`),
          axios.get(`/api/usda/search?q=${encodeURIComponent(query)}`),
        ]);

        const localFoods = localRes.status === 'fulfilled'
          ? localRes.value.data.slice(0, 5)
          : [];
        const usdaFoods = usdaRes.status === 'fulfilled'
          ? usdaRes.value.data.slice(0, 5).map((f) => ({ ...f, _usda: true }))
          : [];

        setResults([...localFoods, ...usdaFoods]);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  // For USDA foods: import (cache) first, then open the log modal.
  // For local foods: open modal directly.
  const handleFoodSelect = async (food) => {
    setQuery('');
    setResults([]);

    if (food._usda) {
      setImportingFdcId(food.fdcId);
      try {
        const { data } = await axios.post('/api/usda/import', { fdcId: food.fdcId });
        setSelectedFood(data);
      } catch {
        toast.error('Failed to load food details from USDA');
      } finally {
        setImportingFdcId(null);
      }
    } else {
      setSelectedFood(food);
    }
  };

  const addFood = async (food, m = meal, g = grams) => {
    const mult = g / (food.servingSize || 100);
    try {
      await axios.post('/api/log', {
        foodId: food.id,
        meal: m.toLowerCase(),
        multiplier: parseFloat(mult.toFixed(4)),
      });
      saveServingPref(food.id, g);
      onAdd();
      setSelectedFood(null);
      setQuery('');
      setResults([]);
      toast.success(`${food.name} added to ${m}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add food');
    }
  };

  // Barcode scanning is now handled entirely by <BarcodeScanner>.
  // When it resolves a food record, open the "Add to log" modal directly.
  const handleBarcodeFood = (food) => {
    setSelectedFood(food);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        const { data } = await axios.post('/api/ai/photo-estimate', {
          imageBase64: base64,
          mimeType: file.type,
        });
        setPhotoResult(data);
        setShowPhotoResult(true);
        setPhotoLoading(false);
        setPhotoUsage(prev => prev ? { ...prev, used: prev.used + 1 } : prev);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Photo analysis failed');
      setPhotoLoading(false);
    }
  };

  return (
    <div>
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowBarcode(true)}
          className="w-11 h-11 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:bg-primary-light hover:text-primary hover:border-primary transition-all"
        >
          <Scan size={18} />
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={photoLoading}
          className="w-11 h-11 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:bg-primary-light hover:text-primary hover:border-primary transition-all disabled:opacity-60"
        >
          {photoLoading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
      </div>

      {/* Dropdown results */}
      {(results.length > 0 || loading) && (
        <div className="mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Searching...
            </div>
          )}
          {results.map((food, i) => (
            <button
              key={food.id ?? food.fdcId ?? i}
              onClick={() => handleFoodSelect(food)}
              disabled={importingFdcId != null}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary-light border-b border-gray-50 last:border-0 transition-colors disabled:opacity-60"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">{food.name}</p>
                  {food._usda && (
                    <span className="shrink-0 text-[10px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md leading-none">
                      USDA
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{food.category} · {food.servingSize}{food.servingUnit}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                {importingFdcId === food.fdcId ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <>
                    <p className="text-sm font-semibold text-primary">{Math.round(food.calories)} kcal</p>
                    <p className="text-xs text-gray-400">
                      P{Math.round(food.protein)}g C{Math.round(food.carbs)}g F{Math.round(food.fat)}g
                    </p>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add to log modal */}
      <Modal isOpen={!!selectedFood} onClose={() => setSelectedFood(null)} title="Add to log">
        {selectedFood && (() => {
          const mult = grams / (selectedFood.servingSize || 100);
          return (
          <div className="p-5 flex flex-col gap-4">
            <div className="bg-primary-light rounded-2xl p-4">
              <p className="font-semibold text-gray-900">{selectedFood.name}</p>
              <p className="text-sm text-gray-500">{selectedFood.category}</p>
              <div className="flex gap-4 mt-2">
                {[
                  { l: 'Kcal', v: Math.round(selectedFood.calories * mult) },
                  { l: 'Protein', v: `${Math.round(selectedFood.protein * mult)}g` },
                  { l: 'Carbs', v: `${Math.round(selectedFood.carbs * mult)}g` },
                  { l: 'Fat', v: `${Math.round(selectedFood.fat * mult)}g` },
                ].map((m) => (
                  <div key={m.l}>
                    <p className="font-bold text-primary">{m.v}</p>
                    <p className="text-xs text-gray-400">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Serving size</label>
              <ServingSizeSelector
                food={selectedFood}
                grams={grams}
                onChange={setGrams}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Meal</label>
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
              onClick={() => addFood(selectedFood, meal, grams)}
              className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl hover:bg-primary-dark transition-colors"
            >
              Add to {meal}
            </button>
          </div>
          );
        })()}
      </Modal>

      {/* Barcode scanner — camera + photo + manual + recent history */}
      <BarcodeScanner
        isOpen={showBarcode}
        onClose={() => setShowBarcode(false)}
        onFoodFound={handleBarcodeFood}
      />

      {/* Photo result modal */}
      <Modal isOpen={showPhotoResult} onClose={() => setShowPhotoResult(false)} title="AI Photo Estimate">
        {photoResult && (
          <div className="p-5 flex flex-col gap-4">
            <div className="bg-primary-light rounded-2xl p-4">
              <p className="font-semibold text-gray-900 mb-1">{photoResult.description}</p>
              <p className="text-xs text-gray-500">
                Confidence: <span className={`font-medium ${photoResult.confidence === 'high' ? 'text-primary' : photoResult.confidence === 'medium' ? 'text-amber-500' : 'text-red-400'}`}>{photoResult.confidence}</span>
              </p>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { l: 'Kcal', v: photoResult.calories },
                  { l: 'Protein', v: `${photoResult.protein}g` },
                  { l: 'Carbs', v: `${photoResult.carbs}g` },
                  { l: 'Fat', v: `${photoResult.fat}g` },
                ].map((m) => (
                  <div key={m.l} className="text-center">
                    <p className="font-bold text-primary text-lg">{m.v}</p>
                    <p className="text-xs text-gray-400">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>
            {photoResult.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-2 border-b border-gray-50">
                <span>{item.name} <span className="text-gray-400">({item.estimatedPortion})</span></span>
                <span className="font-medium">{item.calories} kcal</span>
              </div>
            ))}
            {photoResult.notes && (
              <p className="text-xs text-gray-400 italic">{photoResult.notes}</p>
            )}
            {photoUsage && (
              <p className="text-xs text-gray-400 text-center pt-1">
                {photoUsage.used} of {photoUsage.limit} free photo scans used this month
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
