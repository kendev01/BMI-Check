const CATEGORY_LABELS = {
  underweight: 'Underweight',
  normal: 'Normal weight',
  overweight: 'Overweight',
  obese: 'Obese',
};

const CATEGORY_BADGE_CLASSES = {
  underweight: 'bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30',
  normal: 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30',
  overweight: 'bg-orange-400/10 text-orange-300 ring-1 ring-orange-400/30',
  obese: 'bg-red-400/10 text-red-300 ring-1 ring-red-400/30',
};

const CATEGORY_BAR_CLASSES = {
  underweight: 'bg-amber-400',
  normal: 'bg-emerald-400',
  overweight: 'bg-orange-400',
  obese: 'bg-red-400',
};

const BMI_SCALE = { min: 15, max: 40 };

const BMI_SCALE_SEGMENTS = [
  { category: 'underweight', from: 15, to: 18.5 },
  { category: 'normal', from: 18.5, to: 25 },
  { category: 'overweight', from: 25, to: 30 },
  { category: 'obese', from: 30, to: 40 },
];

function bmiScalePercent(bmi) {
  const span = BMI_SCALE.max - BMI_SCALE.min;
  return Math.min(Math.max(((bmi - BMI_SCALE.min) / span) * 100, 0), 100);
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: { value: 1.2, label: 'Sedentary (little/no exercise)' },
  light: { value: 1.375, label: 'Lightly active (1-3 days/week)' },
  moderate: { value: 1.55, label: 'Moderately active (3-5 days/week)' },
  active: { value: 1.725, label: 'Very active (6-7 days/week)' },
  very_active: { value: 1.9, label: 'Extra active (hard daily exercise / physical job)' },
};

const DISCLAIMER =
  'This is a general estimate based on standard formulas (Mifflin-St Jeor) and is not medical advice. ' +
  'Consult a healthcare professional before starting any diet or exercise program.';

function calculateBMI(weightKg, heightCm) {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function classifyBMI(bmi) {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

function calculateBMR({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel].value;
  return bmr * multiplier;
}

function recommendCalories({ tdee, actualWeightKg, desiredWeightKg, sex }) {
  const diff = desiredWeightKg - actualWeightKg;
  let goalType;
  let target;

  if (diff < -0.5) {
    goalType = 'loss';
    target = tdee - 500;
  } else if (diff > 0.5) {
    goalType = 'gain';
    target = tdee + 400;
  } else {
    goalType = 'maintain';
    target = tdee;
  }

  const minKcal = sex === 'male' ? 1500 : 1200;
  const minApplied = target < minKcal;
  const recommendedCalories = Math.round(Math.max(target, minKcal) / 10) * 10;
  const weightDeltaKg = Math.abs(diff);

  return { goalType, recommendedCalories, minApplied, minKcal, weightDeltaKg };
}

function getFullResults(values) {
  const { heightCm, actualWeightKg, desiredWeightKg, age, sex, activityLevel } = values;

  const bmiActual = calculateBMI(actualWeightKg, heightCm);
  const bmiActualCategory = classifyBMI(bmiActual);
  const bmiDesired = calculateBMI(desiredWeightKg, heightCm);
  const bmiDesiredCategory = classifyBMI(bmiDesired);

  const bmr = calculateBMR({ sex, weightKg: actualWeightKg, heightCm, age });
  const tdee = calculateTDEE(bmr, activityLevel);

  const calorieRec = recommendCalories({ tdee, actualWeightKg, desiredWeightKg, sex });

  return {
    bmiActual,
    bmiActualCategory,
    bmiDesired,
    bmiDesiredCategory,
    bmr,
    tdee,
    activityMultiplier: ACTIVITY_MULTIPLIERS[activityLevel].value,
    ...calorieRec,
  };
}

module.exports = {
  CATEGORY_LABELS,
  CATEGORY_BADGE_CLASSES,
  CATEGORY_BAR_CLASSES,
  BMI_SCALE_SEGMENTS,
  bmiScalePercent,
  ACTIVITY_MULTIPLIERS,
  DISCLAIMER,
  calculateBMI,
  classifyBMI,
  calculateBMR,
  calculateTDEE,
  recommendCalories,
  getFullResults,
};
