function calculateTargets(user) {
  const { age, sex, height, weight, activityLevel, goal } = user;
  if (!age || !sex || !height || !weight) return null;

  // Mifflin-St Jeor BMR
  const bmr =
    sex === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  const activityMultipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  };

  const tdee = bmr * (activityMultipliers[activityLevel] ?? 1.2);

  const goalCalories = { lose: -500, maintain: 0, gain: 500 };
  const calorieTarget = Math.round(tdee + (goalCalories[goal] ?? 0));

  // Protein: ~1g per lb body weight, Fat: 25% of calories, Carbs: remainder
  const proteinTarget = Math.round(weight * 2.2);
  const fatTarget = Math.round((calorieTarget * 0.25) / 9);
  const carbTarget = Math.round((calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4);

  return { calorieTarget, proteinTarget, carbTarget, fatTarget };
}

function scaleNutrients(food, multiplier) {
  const scale = (v) => Math.round(v * multiplier * 100) / 100;
  const scaleObj = (obj) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, scale(v)]));

  return {
    calories: scale(food.calories),
    protein: scale(food.protein),
    carbs: scale(food.carbs),
    fat: scale(food.fat),
    fiber: scale(food.fiber),
    sugar: scale(food.sugar),
    sodium: scale(food.sodium),
    nutrients: {
      aminoAcids: scaleObj(JSON.parse(food.aminoAcids || '{}')),
      fattyAcids: scaleObj(JSON.parse(food.fattyAcids || '{}')),
      vitamins: scaleObj(JSON.parse(food.vitamins || '{}')),
      minerals: scaleObj(JSON.parse(food.minerals || '{}')),
    },
  };
}
module.exports = { calculateTargets, scaleNutrients };
