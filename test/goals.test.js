const test = require('node:test');
const assert = require('node:assert/strict');

const goals = require('../src/goals');
const { buildMonth, shiftMonth, isValidMonth } = require('../src/calendarGrid');

test('projection never exceeds the safe weekly rate, however large the deficit', () => {
  const aggressive = goals.projectGoal({
    actualWeightKg: 110,
    desiredWeightKg: 80,
    tdee: 3000,
    recommendedCalories: 1200, // a 1800 kcal/day deficit
    startDate: '2026-01-01',
  });

  assert.equal(aggressive.goalType, 'loss');
  assert.ok(aggressive.rateKgPerWeek <= goals.SAFE_RATES_KG_PER_WEEK.loss.max);
  assert.equal(aggressive.clamped, true, 'an unsafe implied rate should be flagged as clamped');
});

test('projection honours a moderate deficit without clamping', () => {
  const steady = goals.projectGoal({
    actualWeightKg: 90,
    desiredWeightKg: 80,
    tdee: 2600,
    recommendedCalories: 2100, // 500 kcal/day -> ~0.45 kg/week
    startDate: '2026-01-01',
  });

  assert.equal(steady.clamped, false);
  assert.ok(steady.rateKgPerWeek >= goals.SAFE_RATES_KG_PER_WEEK.loss.min);
  assert.ok(steady.projectedDate > steady.startDate);
});

test('gain goals use the slower lean-gain range', () => {
  const gain = goals.projectGoal({
    actualWeightKg: 60,
    desiredWeightKg: 68,
    tdee: 2200,
    recommendedCalories: 2600,
    startDate: '2026-01-01',
  });

  assert.equal(gain.goalType, 'gain');
  assert.ok(gain.rateKgPerWeek <= goals.SAFE_RATES_KG_PER_WEEK.gain.max);
});

test('a goal within half a kilo is treated as maintenance, not a timeline', () => {
  const same = goals.projectGoal({
    actualWeightKg: 75,
    desiredWeightKg: 75,
    tdee: 2400,
    recommendedCalories: 2400,
  });

  assert.equal(same.goalType, 'maintain');
  assert.equal(same.projectedDate, null);
});

test('a maintenance-level plan still yields a finite date rather than dividing by zero', () => {
  const noDeficit = goals.projectGoal({
    actualWeightKg: 90,
    desiredWeightKg: 80,
    tdee: 2500,
    recommendedCalories: 2500,
    startDate: '2026-01-01',
  });

  assert.ok(Number.isFinite(noDeficit.days));
  assert.ok(noDeficit.projectedDate);
});

test('assessTargetDate flags crash timelines and over-long ones', () => {
  const base = { actualWeightKg: 95, desiredWeightKg: 75, startDate: '2026-01-01' };

  assert.equal(goals.assessTargetDate({ ...base, targetDate: '2026-02-15' }).verdict, 'too-fast');
  assert.equal(goals.assessTargetDate({ ...base, targetDate: '2026-09-01' }).verdict, 'safe');
  assert.equal(goals.assessTargetDate({ ...base, targetDate: '2029-01-01' }).verdict, 'relaxed');
  assert.equal(goals.assessTargetDate({ ...base, targetDate: '2025-06-01' }).valid, false);
});

test('goalProgress reports elapsed, remaining and overdue windows', () => {
  const mid = goals.goalProgress({ startDate: '2026-01-01', targetDate: '2026-01-11', today: '2026-01-06' });
  assert.equal(mid.totalDays, 10);
  assert.equal(mid.elapsedDays, 5);
  assert.equal(mid.remainingDays, 5);
  assert.equal(mid.percent, 50);
  assert.equal(mid.overdue, false);

  const late = goals.goalProgress({ startDate: '2026-01-01', targetDate: '2026-01-11', today: '2026-01-20' });
  assert.equal(late.overdue, true);
  assert.equal(late.percent, 100);
});

test('addDays and daysBetween survive month and year boundaries', () => {
  assert.equal(goals.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(goals.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(goals.addDays('2028-02-28', 1), '2028-02-29', 'leap year');
  assert.equal(goals.daysBetween('2026-01-01', '2026-03-01'), 59);
});

test('calendar grid pads to whole weeks and starts on Monday', () => {
  // 1 Feb 2026 is a Sunday, so the first week needs six leading blanks.
  const month = buildMonth('2026-02', {}, { today: '2026-02-10' });

  assert.equal(month.weeks[0].slice(0, 6).every((c) => c === null), true);
  assert.equal(month.weeks[0][6].day, 1);
  month.weeks.forEach((week) => assert.equal(week.length, 7));
  assert.equal(month.weeks.flat().filter(Boolean).length, 28);
});

test('calendar cells classify days against the target', () => {
  const totals = {
    '2026-03-02': { total: 1800, items: 3 },
    '2026-03-03': { total: 2600, items: 4 },
  };
  const month = buildMonth('2026-03', totals, { target: 2000, today: '2026-03-05' });
  const byDate = Object.fromEntries(month.weeks.flat().filter(Boolean).map((c) => [c.date, c]));

  assert.equal(byDate['2026-03-02'].status, 'under');
  assert.equal(byDate['2026-03-03'].status, 'over');
  assert.equal(byDate['2026-03-04'].status, 'empty');
  assert.equal(byDate['2026-03-05'].isToday, true);
  assert.equal(byDate['2026-03-06'].isFuture, true);

  assert.equal(month.loggedDays, 2);
  assert.equal(month.daysOnTarget, 1);
  assert.equal(month.averagePerLoggedDay, 2200);
});

test('month navigation wraps across years', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(isValidMonth('2026-13'), false);
  assert.equal(isValidMonth('2026-07'), true);
});
