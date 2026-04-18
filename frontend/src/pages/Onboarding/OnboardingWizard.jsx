import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ChevronRight, ChevronLeft, Check, Target, Activity, Utensils, User, BarChart2, Settings2 } from 'lucide-react';

const GOALS = [
  { value: 'lose', label: 'Lose Weight', emoji: '📉', desc: 'Caloric deficit for fat loss' },
  { value: 'maintain', label: 'Maintain', emoji: '⚖️', desc: 'Stay at current weight' },
  { value: 'gain', label: 'Gain Muscle', emoji: '💪', desc: 'Caloric surplus for muscle growth' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
  { value: 'lightly_active', label: 'Lightly Active', desc: '1-3 days/week' },
  { value: 'moderately_active', label: 'Moderately Active', desc: '3-5 days/week' },
  { value: 'very_active', label: 'Very Active', desc: '6-7 days/week' },
  { value: 'extra_active', label: 'Extra Active', desc: 'Physical job or 2x training' },
];

const RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free',
  'Soy-Free', 'Halal', 'Kosher', 'Low-Sodium', 'Low-Carb', 'Keto', 'Paleo',
];

function calculateTargets(data) {
  const { age, sex, height, weight, activityLevel, goal } = data;
  if (!age || !height || !weight) return null;
  const bmr =
    sex === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  const mult = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725, extra_active: 1.9 };
  const tdee = bmr * (mult[activityLevel] || 1.2);
  const adj = { lose: -500, maintain: 0, gain: 500 };
  const cal = Math.round(tdee + (adj[goal] || 0));
  const prot = Math.round(weight * 2.2);
  const fat = Math.round((cal * 0.25) / 9);
  const carb = Math.round((cal - prot * 4 - fat * 9) / 4);
  return { calories: cal, protein: prot, carbs: carb, fat };
}

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    goal: 'maintain',
    // unit preferences (set in step 2)
    weightUnit: 'lbs',
    heightUnit: 'ft',
    waterUnit: 'floz',
    energyUnit: 'kcal',
    units: 'imperial',  // legacy sync: 'imperial' when weightUnit=lbs
    age: '',
    sex: 'male',
    height: '',
    weight: '',
    activityLevel: 'moderately_active',
    dietaryRestrictions: [],
  });
  const [loading, setLoading] = useState(false);
  const { updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const set = (key, val) => setData((d) => ({ ...d, [key]: val }));

  const toggleRestriction = (r) =>
    set('dietaryRestrictions', data.dietaryRestrictions.includes(r)
      ? data.dietaryRestrictions.filter((x) => x !== r)
      : [...data.dietaryRestrictions, r]);

  const getHeightCm = () => {
    if (data.units === 'imperial') {
      // Accept "5'10", "5'10\"", or plain string like "5 10"
      const s = String(data.height).trim();
      const match = s.match(/^(\d+)['\s](\d*)"?$/);
      if (match) {
        const ft   = parseInt(match[1], 10);
        const inch = parseInt(match[2] || '0', 10);
        return Math.round((ft * 12 + inch) * 2.54 * 10) / 10;
      }
      // fallback: treat as total inches
      return Math.round(parseFloat(s) * 2.54 * 10) / 10;
    }
    return parseFloat(data.height);
  };

  const getWeightKg = () => {
    const v = parseFloat(data.weight);
    if (!v) return 0;
    // Round to 1 dp to avoid 65.7708399999999 style artifacts
    if (data.units === 'imperial') return Math.round((v / 2.20462) * 10) / 10;
    return v;
  };

  const targets = calculateTargets({
    ...data,
    height: getHeightCm(),
    weight: getWeightKg(),
  });

  const finish = async () => {
    setLoading(true);
    try {
      const payload = {
        goal: data.goal,
        age: parseInt(data.age),
        sex: data.sex,
        height: getHeightCm(),
        weight: getWeightKg(),
        activityLevel: data.activityLevel,
        dietaryRestrictions: data.dietaryRestrictions,
        weightUnit: data.weightUnit,
        heightUnit: data.heightUnit,
        waterUnit: data.waterUnit,
        energyUnit: data.energyUnit,
      };
      const { data: user } = await axios.put('/api/auth/onboarding', payload);
      updateUser(user);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      icon: Target,
      title: 'What\'s your goal?',
      content: (
        <div className="flex flex-col gap-3">
          {GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => set('goal', g.value)}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                data.goal === g.value ? 'border-primary bg-primary-light' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <span className="text-3xl">{g.emoji}</span>
              <div>
                <p className="font-semibold">{g.label}</p>
                <p className="text-sm text-gray-500">{g.desc}</p>
              </div>
              {data.goal === g.value && <Check size={20} className="ml-auto text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      ),
    },
    {
      icon: Settings2,
      title: 'Choose your preferred units',
      subtitle: 'You can change this anytime in Settings',
      content: (() => {
        const UnitCard = ({ selected, onClick, label, desc }) => (
          <button
            onClick={onClick}
            className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${
              selected ? 'border-primary bg-primary-light' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-bold text-base">{label}</p>
              {selected && <Check size={16} className="text-primary flex-shrink-0" />}
            </div>
            <p className="text-sm text-gray-500">{desc}</p>
          </button>
        );

        const Section = ({ emoji, label, children }) => (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2.5">{emoji} {label}</p>
            <div className="grid grid-cols-2 gap-2.5">{children}</div>
          </div>
        );

        return (
          <div className="flex flex-col gap-5">
            <Section emoji="⚖️" label="Weight">
              <UnitCard selected={data.weightUnit === 'lbs'} label="lbs / oz" desc="🇺🇸 US & UK"
                onClick={() => { set('weightUnit', 'lbs'); set('units', 'imperial'); }} />
              <UnitCard selected={data.weightUnit === 'kg'} label="kg / g" desc="🌍 Metric"
                onClick={() => { set('weightUnit', 'kg'); set('units', 'metric'); }} />
            </Section>

            <Section emoji="📏" label="Height">
              <UnitCard selected={data.heightUnit === 'ft'} label="ft & in" desc="5 ft 9 in"
                onClick={() => set('heightUnit', 'ft')} />
              <UnitCard selected={data.heightUnit === 'cm'} label="cm" desc="175 cm"
                onClick={() => set('heightUnit', 'cm')} />
            </Section>

            <Section emoji="💧" label="Water">
              <UnitCard selected={data.waterUnit === 'floz'} label="fl oz" desc="8 fl oz / glass"
                onClick={() => set('waterUnit', 'floz')} />
              <UnitCard selected={data.waterUnit === 'ml'} label="ml" desc="240 ml / glass"
                onClick={() => set('waterUnit', 'ml')} />
            </Section>

            <Section emoji="🔥" label="Energy">
              <UnitCard selected={data.energyUnit === 'kcal'} label="kcal" desc="Calories"
                onClick={() => set('energyUnit', 'kcal')} />
              <UnitCard selected={data.energyUnit === 'kJ'} label="kJ" desc="Kilojoules"
                onClick={() => set('energyUnit', 'kJ')} />
            </Section>
          </div>
        );
      })(),
    },
    {
      icon: User,
      title: 'Tell us about yourself',
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            {['metric', 'imperial'].map((u) => (
              <button
                key={u}
                onClick={() => set('units', u)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  data.units === u ? 'bg-white shadow text-primary' : 'text-gray-500'
                }`}
              >
                {u === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lb/ft)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Age</label>
              <input
                type="number" min="10" max="100" required
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="25"
                value={data.age}
                onChange={(e) => set('age', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Sex</label>
              <div className="flex gap-2">
                {['male', 'female'].map((s) => (
                  <button
                    key={s}
                    onClick={() => set('sex', s)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                      data.sex === s ? 'border-primary bg-primary-light text-primary' : 'border-gray-200'
                    }`}
                  >
                    {s === 'male' ? '♂ Male' : '♀ Female'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Height {data.units === 'metric' ? '(cm)' : "(ft'in)"}
              </label>
              <input
                type={data.units === 'metric' ? 'number' : 'text'}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder={data.units === 'metric' ? '175' : "5'10"}
                value={data.height}
                onChange={(e) => set('height', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Weight {data.units === 'metric' ? '(kg)' : '(lbs)'}
              </label>
              <input
                type="number" min="30" max="500" required
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder={data.units === 'metric' ? '70' : '154'}
                value={data.weight}
                onChange={(e) => set('weight', e.target.value)}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Activity,
      title: 'Activity level',
      content: (
        <div className="flex flex-col gap-2.5">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a.value}
              onClick={() => set('activityLevel', a.value)}
              className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                data.activityLevel === a.value ? 'border-primary bg-primary-light' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="text-left">
                <p className="font-semibold text-sm">{a.label}</p>
                <p className="text-xs text-gray-500">{a.desc}</p>
              </div>
              {data.activityLevel === a.value && <Check size={18} className="text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      ),
    },
    {
      icon: Utensils,
      title: 'Dietary restrictions',
      content: (
        <div>
          <p className="text-sm text-gray-500 mb-4">Select all that apply (optional)</p>
          <div className="flex flex-wrap gap-2">
            {RESTRICTIONS.map((r) => (
              <button
                key={r}
                onClick={() => toggleRestriction(r)}
                className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                  data.dietaryRestrictions.includes(r)
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 text-gray-600 bg-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: BarChart2,
      title: 'Your daily targets',
      content: targets ? (
        <div className="flex flex-col gap-4">
          <div className="bg-primary rounded-2xl p-5 text-white text-center">
            <p className="text-sm opacity-80 mb-1">Daily Calories</p>
            <p className="font-syne font-bold text-4xl">{targets.calories}</p>
            <p className="text-sm opacity-80 mt-1">kcal / day</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Protein', value: targets.protein, unit: 'g', color: 'bg-blue-50 text-blue-700' },
              { label: 'Carbs', value: targets.carbs, unit: 'g', color: 'bg-amber-50 text-amber-700' },
              { label: 'Fat', value: targets.fat, unit: 'g', color: 'bg-rose-50 text-rose-700' },
            ].map((m) => (
              <div key={m.label} className={`${m.color} rounded-2xl p-4 text-center`}>
                <p className="font-syne font-bold text-2xl">{m.value}</p>
                <p className="text-xs opacity-70">{m.unit}</p>
                <p className="text-xs font-medium mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-primary-light rounded-2xl p-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Based on your profile, we've calculated a personalised nutrition plan to help you{' '}
              <strong className="text-primary">{data.goal === 'lose' ? 'lose weight safely' : data.goal === 'gain' ? 'build muscle effectively' : 'maintain your weight'}</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          Please complete the previous steps to see your targets.
        </div>
      ),
    },
  ];

  const StepIcon = steps[step].icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-white flex flex-col px-5 py-8">
      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-primary' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step icon */}
      <div className="w-12 h-12 bg-primary-light rounded-2xl flex items-center justify-center mb-4">
        <StepIcon size={24} className="text-primary" />
      </div>

      <h1 className="font-syne font-bold text-2xl mb-6">{steps[step].title}</h1>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {steps[step].content}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6 pt-4">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 px-5 py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 font-medium"
          >
            <ChevronLeft size={18} />
            Back
          </button>
        )}
        <button
          onClick={isLast ? finish : () => setStep((s) => s + 1)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3.5 rounded-xl hover:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {loading ? 'Saving...' : isLast ? 'Start tracking!' : (
            <>Next <ChevronRight size={18} /></>
          )}
        </button>
      </div>
    </div>
  );
}
