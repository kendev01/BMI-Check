const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateBMI,
  classifyBMI,
  calculateBMR,
  calculateTDEE,
  recommendCalories,
} = require('../src/calculations');

test('calculateBMI computes weight / height(m)^2', () => {
  const bmi = calculateBMI(90, 170);
  assert.ok(Math.abs(bmi - 31.14) < 0.01);
});

test('classifyBMI returns correct category per WHO thresholds', () => {
  assert.equal(classifyBMI(17), 'underweight');
  assert.equal(classifyBMI(18.5), 'normal');
  assert.equal(classifyBMI(24.9), 'normal');
  assert.equal(classifyBMI(25), 'overweight');
  assert.equal(classifyBMI(29.9), 'overweight');
  assert.equal(classifyBMI(30), 'obese');
});

test('calculateBMR uses Mifflin-St Jeor formula for male', () => {
  const bmr = calculateBMR({ sex: 'male', weightKg: 90, heightCm: 170, age: 30 });
  assert.ok(Math.abs(bmr - 1817.5) < 0.01);
});

test('calculateBMR uses Mifflin-St Jeor formula for female', () => {
  const bmr = calculateBMR({ sex: 'female', weightKg: 50, heightCm: 160, age: 25 });
  assert.ok(Math.abs(bmr - 1214) < 0.01);
});

test('calculateTDEE applies the activity multiplier', () => {
  const tdee = calculateTDEE(1817.5, 'moderate');
  assert.ok(Math.abs(tdee - 2817.125) < 0.01);
});

test('recommendCalories applies a deficit for weight loss', () => {
  const result = recommendCalories({
    tdee: 2817.125,
    actualWeightKg: 90,
    desiredWeightKg: 70,
    sex: 'male',
  });
  assert.equal(result.goalType, 'loss');
  assert.equal(result.recommendedCalories, 2320);
  assert.equal(result.minApplied, false);
});

test('recommendCalories applies a surplus for weight gain', () => {
  const result = recommendCalories({
    tdee: 1669.25,
    actualWeightKg: 50,
    desiredWeightKg: 60,
    sex: 'female',
  });
  assert.equal(result.goalType, 'gain');
  assert.equal(result.recommendedCalories, 2070);
});

test('recommendCalories maintains when desired equals actual weight', () => {
  const result = recommendCalories({
    tdee: 1978.5,
    actualWeightKg: 75,
    desiredWeightKg: 75,
    sex: 'male',
  });
  assert.equal(result.goalType, 'maintain');
  assert.equal(result.recommendedCalories, 1980);
});

test('recommendCalories clamps to the safe minimum for extreme deficits', () => {
  const result = recommendCalories({
    tdee: 1243.8,
    actualWeightKg: 35,
    desiredWeightKg: 32,
    sex: 'female',
  });
  assert.equal(result.goalType, 'loss');
  assert.equal(result.minApplied, true);
  assert.equal(result.recommendedCalories, 1200);
});
