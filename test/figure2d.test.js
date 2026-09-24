const test = require('node:test');
const assert = require('node:assert/strict');

const { bodyWidths, buildFigure, ageTraits } = require('../src/figure2d');

test('every girth grows with BMI', () => {
  const slim = bodyWidths(18, 'male');
  const heavy = bodyWidths(35, 'male');

  Object.keys(slim).forEach((part) => {
    assert.ok(heavy[part] > slim[part], `${part} should grow with BMI`);
  });
});

// The whole point of the illustration: a heavy build must read as belly-shaped,
// not merely as a uniformly scaled-up version of a lean one.
test('the waist overtakes the chest around the obesity threshold', () => {
  const lean = bodyWidths(21, 'male');
  assert.ok(lean.waist < lean.chest, 'a lean build should taper at the waist');

  const obese = bodyWidths(33, 'male');
  assert.ok(obese.waist > obese.chest, 'an obese build should be widest at the waist');
});

test('waist responds to BMI more strongly than the frame does', () => {
  const a = bodyWidths(20, 'male');
  const b = bodyWidths(34, 'male');

  const waistGrowth = b.waist / a.waist;
  const shoulderGrowth = b.shoulder / a.shoulder;
  assert.ok(waistGrowth > shoulderGrowth * 1.5);
});

test('female builds get narrower shoulders and wider hips than male at equal BMI', () => {
  const male = bodyWidths(24, 'male');
  const female = bodyWidths(24, 'female');

  assert.ok(female.shoulder < male.shoulder);
  assert.ok(female.hip > male.hip);
});

test('extreme BMI values stay within the drawable viewBox', () => {
  [10, 13, 45, 80].forEach((bmi) => {
    const w = bodyWidths(bmi, 'female');
    Object.entries(w).forEach(([part, value]) => {
      assert.ok(value > 0, `${part} must be positive at BMI ${bmi}`);
      assert.ok(value < 100, `${part} must fit the 200-unit viewBox at BMI ${bmi}`);
    });
  });
});

test('buildFigure emits drawable paths and the right outfit per variant', () => {
  const current = buildFigure(31, 'male', 'current');
  const goal = buildFigure(22, 'female', 'goal');

  assert.ok(current.torso.startsWith('M '));
  assert.ok(current.shorts.startsWith('M '));
  assert.equal(current.bra, null, 'male figures have no bra');
  assert.ok(goal.bra.startsWith('M '), 'female figures do');

  assert.notEqual(current.outfit.main, goal.outfit.main);
  assert.equal(current.lean, false);
  assert.equal(goal.lean, true);

  // No coordinate should come out NaN, which would silently blank the SVG.
  assert.ok(!current.torso.includes('NaN'));
  assert.ok(!goal.limbs.leftArm.upper.includes('NaN'));
  assert.equal(typeof goal.limbs.leftArm.wrist.x, 'number');
});

test('lean figures get definition lines and heavy ones get belly folds', () => {
  assert.ok(buildFigure(21, 'male', 'current').details.length >= 4);
  assert.ok(buildFigure(33, 'male', 'current').details.length >= 2);
});

test('age greys the hair progressively and only recedes hairlines for men', () => {
  const young = ageTraits(22, 'male');
  const mid = ageTraits(50, 'male');
  const old = ageTraits(80, 'male');

  assert.notEqual(mid.hair, young.hair, 'hair should grey by middle age');
  assert.notEqual(old.hair, mid.hair, 'and keep greying after that');

  assert.ok(old.recede > mid.recede && mid.recede > young.recede);
  assert.equal(ageTraits(80, 'female').recede, 0, 'female hairlines do not recede here');
});

test('age cues stay at zero for the young and rise monotonically', () => {
  const ages = [18, 25, 40, 55, 70, 85];
  const lines = ages.map((a) => ageTraits(a, 'male').lines);
  const slump = ages.map((a) => ageTraits(a, 'male').slump);

  assert.equal(lines[0], 0);
  assert.equal(slump[0], 0);
  for (let i = 1; i < ages.length; i += 1) {
    assert.ok(lines[i] >= lines[i - 1]);
    assert.ok(slump[i] >= slump[i - 1]);
  }
  assert.ok(lines.at(-1) > 0.8);
});

// Same BMI, different age, must not produce an identical body.
test('at equal BMI an older frame is narrower up top and thicker in the middle', () => {
  const young = bodyWidths(26, 'male', 25);
  const old = bodyWidths(26, 'male', 75);

  assert.ok(old.shoulder < young.shoulder);
  assert.ok(old.waist > young.waist);
  assert.ok(old.thigh < young.thigh);
});

test('an older figure carries its head lower', () => {
  assert.ok(buildFigure(24, 'male', 'current', 80).head.cy > buildFigure(24, 'male', 'current', 20).head.cy);
});
