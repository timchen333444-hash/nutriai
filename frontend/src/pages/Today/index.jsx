import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAlerts } from '../../context/AlertsContext';
import CalorieRing from './CalorieRing';
import MacroBars from './MacroBars';
import WaterTracker from './WaterTracker';
import FoodSearch from './FoodSearch';
import FoodLog from './FoodLog';
import NutritionAccordion from './NutritionAccordion';
import TemplatesModal from './TemplatesModal';
import RestaurantQuickAdd from './RestaurantQuickAdd';
import SupplementTracker from './SupplementTracker';
import ActivityTracker from './ActivityTracker';
import HelpModal from '../../components/ui/HelpModal';
import { ChevronDown, ChevronUp, Leaf, Star, Loader2, AlertTriangle } from 'lucide-react';

const TODAY_HELP = `This is your daily food diary. Use the search bar to log meals throughout the day — breakfast, lunch, dinner, and snacks. NutriAI tracks your calories, protein, carbs, fat, and dozens of vitamins and minerals. Log your water glasses and supplements too. The coloured ring at the top shows how close you are to your daily calorie goal.`;

export default function Today() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { unreadCount, triggerAnalysis } = useAlerts();
  const [logs,            setLogs]            = useState([]);
  const [supplements,     setSupplements]     = useState([]);
  const [water,           setWater]           = useState(0);
  const [caloriesBurned,  setCaloriesBurned]  = useState(0);
  const [dataLoading,     setDataLoading]     = useState(true);
  const [showAccordion,   setShowAccordion]   = useState(false);
  const [showTemplates,   setShowTemplates]   = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const fetchData = useCallback(async (triggerAlerts = false) => {
    try {
      const [logRes, waterRes, suppRes] = await Promise.all([
        axios.get(`/api/log?date=${today}`),
        axios.get(`/api/water?date=${today}`),
        axios.get(`/api/supplements/log?date=${today}`),
      ]);
      setLogs(logRes.data);
      setWater(waterRes.data.glasses);
      setSupplements(suppRes.data);
      // Re-analyze deficiencies after a meal is logged
      if (triggerAlerts) triggerAnalysis();
    } catch (e) {
      toast.error('Could not load today\'s data. Please check your connection and try again.');
    } finally {
      setDataLoading(false);
    }
  }, [today, triggerAnalysis]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateWater = async (glasses) => {
    setWater(glasses);
    try {
      await axios.put('/api/water', { glasses, date: today });
    } catch {
      toast.error('Failed to update water');
    }
  };

  const totals = logs.reduce(
    (s, l) => ({
      calories: s.calories + l.calories,
      protein: s.protein + l.protein,
      carbs: s.carbs + l.carbs,
      fat: s.fat + l.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="pb-24 min-h-screen">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Leaf size={18} className="text-white/70" />
            <span className="font-syne font-bold text-white text-xl">NutriAI</span>
          </div>
          <div className="opacity-80">
            <HelpModal title="Today" description={TODAY_HELP} />
          </div>
        </div>
        <p className="text-white/60 text-sm mb-5">{dateLabel}</p>
        <p className="text-white/80 text-base font-medium mb-2">Hello, {user?.name?.split(' ')[0]} 👋</p>

        {/* Calorie ring */}
        <div className="flex justify-center">
          <CalorieRing consumed={totals.calories} target={user?.calorieTarget || 2000} burned={caloriesBurned} />
        </div>
      </div>

      <div className="px-5 -mt-4">
        {/* Macro card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <MacroBars
            protein={totals.protein}
            carbs={totals.carbs}
            fat={totals.fat}
            targets={user}
          />
        </div>

        {/* Water */}
        <div className="mb-4">
          <WaterTracker glasses={water} onUpdate={updateWater} />
        </div>

        {/* Activity tracker */}
        <ActivityTracker onCaloriesBurnedChange={setCaloriesBurned} />

        {/* Supplement tracker */}
        <SupplementTracker
          supplements={supplements}
          onAdd={fetchData}
          onRemove={(id) => setSupplements((prev) => prev.filter((s) => s.id !== id))}
        />

        {/* Food search + Templates button */}
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <FoodSearch onAdd={() => fetchData(true)} />
            </div>
            <button
              onClick={() => setShowTemplates(true)}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-1 w-14 h-[50px] bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-primary-light hover:text-primary hover:border-primary transition-all mt-0"
              title="Meal Templates"
            >
              <Star size={18} />
              <span className="text-[9px] font-medium leading-none">Templates</span>
            </button>
          </div>
        </div>

        {/* Food log */}
        <div className="mb-4">
          <h2 className="font-syne font-bold text-lg mb-3">Today's meals</h2>
          {dataLoading ? (
            <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-base">Loading your food log…</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50 rounded-2xl">
              <span className="text-5xl mb-3">🍽️</span>
              <p className="text-base font-semibold text-gray-700 mb-1">No meals logged yet today</p>
              <p className="text-sm text-gray-400 max-w-[240px] leading-snug">
                Tap the search bar above to add your first meal!
              </p>
            </div>
          ) : (
            <FoodLog logs={logs} onDelete={fetchData} />
          )}
        </div>

        {/* Restaurant quick-add */}
        <RestaurantQuickAdd onAdd={fetchData} />

        {/* Alert strip — shown when deficiency alerts are enabled and there are active gaps */}
        {user?.alertSettings?.deficiencyAlerts && unreadCount > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-700 font-medium">
                {unreadCount} nutrient gap{unreadCount !== 1 ? 's' : ''} detected today
              </span>
            </div>
            <button
              onClick={() => navigate('/insights')}
              className="text-xs font-bold text-amber-700 bg-white border border-amber-200 px-3 py-1.5 rounded-xl hover:bg-amber-50 transition-colors flex-shrink-0"
            >
              View details
            </button>
          </div>
        )}

        {/* Nutrition detail accordion */}
        <div className="mb-4">
          <button
            onClick={() => setShowAccordion((s) => !s)}
            className="w-full flex items-center justify-between bg-primary-light rounded-2xl px-4 py-3.5"
          >
            <span className="font-semibold text-primary-dark text-sm">Full nutrition detail</span>
            {showAccordion ? <ChevronUp size={18} className="text-primary" /> : <ChevronDown size={18} className="text-primary" />}
          </button>
          {showAccordion && (
            <div className="mt-2">
              <NutritionAccordion logs={logs} supplementLogs={supplements} />
            </div>
          )}
        </div>
      </div>

      {/* Templates modal */}
      <TemplatesModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onAdd={fetchData}
      />
    </div>
  );
}
