const express = require('express');
const { validateBmiInput } = require('../validation');
const {
  getFullResults,
  CATEGORY_LABELS,
  CATEGORY_BADGE_CLASSES,
  CATEGORY_BAR_CLASSES,
  BMI_SCALE_SEGMENTS,
  bmiScalePercent,
  ACTIVITY_MULTIPLIERS,
  DISCLAIMER,
} = require('../calculations');
const { buildFigure } = require('../figure2d');
const { saveProfile } = require('../auth');
const goals = require('../goals');

const router = express.Router();

function buildBmiScale(results) {
  const boundaries = [
    BMI_SCALE_SEGMENTS[0].from,
    ...BMI_SCALE_SEGMENTS.map((segment) => segment.to),
  ];

  return {
    currentPct: bmiScalePercent(results.bmiActual),
    goalPct: bmiScalePercent(results.bmiDesired),
    segments: BMI_SCALE_SEGMENTS.map((segment) => ({
      category: segment.category,
      widthPct: bmiScalePercent(segment.to) - bmiScalePercent(segment.from),
    })),
    ticks: boundaries.map((value) => ({ value, pct: bmiScalePercent(value) })),
  };
}

router.get('/', (req, res) => {
  res.render('index', {
    errors: {},
    values: {},
    activityOptions: ACTIVITY_MULTIPLIERS,
  });
});

router.post('/calculate', (req, res) => {
  const { isValid, errors, values } = validateBmiInput(req.body);

  if (!isValid) {
    return res.status(400).render('index', {
      errors,
      values: req.body,
      activityOptions: ACTIVITY_MULTIPLIERS,
    });
  }

  const results = getFullResults(values);

  if (req.user) saveProfile(req.user.id, values);

  const figures = {
    current: buildFigure(results.bmiActual, values.sex, 'current', values.age),
    goal: buildFigure(results.bmiDesired, values.sex, 'goal', values.age),
  };

  res.render('results', {
    values,
    results,
    figures,
    bmiScale: buildBmiScale(results),
    projection: goals.projectGoal({
      actualWeightKg: values.actualWeightKg,
      desiredWeightKg: values.desiredWeightKg,
      tdee: results.tdee,
      recommendedCalories: results.recommendedCalories,
    }),
    CATEGORY_LABELS,
    CATEGORY_BADGE_CLASSES,
    CATEGORY_BAR_CLASSES,
    DISCLAIMER,
  });
});

module.exports = router;
