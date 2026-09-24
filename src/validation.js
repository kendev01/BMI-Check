const VALID_SEXES = ['male', 'female'];
const VALID_ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

function validateNumberField(raw, { min, max, label }) {
  const value = Number(raw);
  if (raw === undefined || raw === null || String(raw).trim() === '' || Number.isNaN(value)) {
    return { value: null, error: `${label} is required.` };
  }
  if (value < min || value > max) {
    return { value, error: `${label} must be between ${min} and ${max}.` };
  }
  return { value, error: null };
}

function validateEnumField(raw, allowed, label) {
  const value = typeof raw === 'string' ? raw.trim() : raw;
  if (!allowed.includes(value)) {
    return { value: null, error: `Please select a valid ${label}.` };
  }
  return { value, error: null };
}

function validateBmiInput(body = {}) {
  const errors = {};

  const heightCm = validateNumberField(body.heightCm, { min: 100, max: 250, label: 'Height' });
  if (heightCm.error) errors.heightCm = heightCm.error;

  const actualWeightKg = validateNumberField(body.actualWeightKg, {
    min: 30,
    max: 300,
    label: 'Actual weight',
  });
  if (actualWeightKg.error) errors.actualWeightKg = actualWeightKg.error;

  const desiredWeightKg = validateNumberField(body.desiredWeightKg, {
    min: 30,
    max: 300,
    label: 'Desired weight',
  });
  if (desiredWeightKg.error) errors.desiredWeightKg = desiredWeightKg.error;

  const age = validateNumberField(body.age, { min: 15, max: 100, label: 'Age' });
  if (age.error) errors.age = age.error;

  const sex = validateEnumField(body.sex, VALID_SEXES, 'sex');
  if (sex.error) errors.sex = sex.error;

  const activityLevel = validateEnumField(body.activityLevel, VALID_ACTIVITY_LEVELS, 'activity level');
  if (activityLevel.error) errors.activityLevel = activityLevel.error;

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    values: {
      heightCm: heightCm.value,
      actualWeightKg: actualWeightKg.value,
      desiredWeightKg: desiredWeightKg.value,
      age: age.value !== null ? Math.round(age.value) : null,
      sex: sex.value,
      activityLevel: activityLevel.value,
    },
  };
}

module.exports = {
  validateBmiInput,
  VALID_SEXES,
  VALID_ACTIVITY_LEVELS,
};
