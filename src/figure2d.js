const BASELINE_BMI = 22;

const LAYOUT = {
  cx: 100,
  headCy: 42,
  headRx: 21,
  headRy: 25,
  neckTop: 64,
  shoulderY: 86,
  chestY: 120,
  waistY: 170,
  hipY: 204,
  crotchY: 220,
  kneeY: 308,
  ankleY: 390,
  footY: 404,
};

const HAIR_YOUNG = '#3f2d20';
const HAIR_GREY = '#b8b4ae';

const PALETTE = {
  skin: '#e8b88f',
  skinShade: '#cf9a6c',
  skinLine: '#b9835a',
  hair: '#3f2d20',
  ink: '#33241a',
};

const OUTFITS = {
  current: { main: '#64748b', trim: '#475569' },
  goal: { main: '#10b981', trim: '#059669' },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mixHex(from, to, t) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const channel = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

// Visible ageing cues, each phased in over its own range so a 25-year-old and a
// 60-year-old at the same BMI are clearly different people.
function ageTraits(age, sex) {
  const a = clamp(age, 15, 100);
  const ramp = (start, span) => clamp((a - start) / span, 0, 1);

  const grey = ramp(35, 40);
  const recede = sex === 'male' ? ramp(30, 35) : 0;

  return {
    age: a,
    hair: mixHex(HAIR_YOUNG, HAIR_GREY, grey),
    recede: round(recede),
    lines: round(ramp(38, 30)),
    slump: round(ramp(45, 45)),
    youthful: a < 25,
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

// Same idea as the 3D model it replaces: girths scale as different powers of
// BMI so the waist responds most and the frame barely at all.
function bodyWidths(bmi, sex, age = 30) {
  const k = clamp(bmi, 13, 45) / BASELINE_BMI;
  const s = (base, exponent) => base * Math.pow(k, exponent);
  const female = sex === 'female';

  // Muscle mass falls and fat redistributes centrally with age, so at identical
  // BMI an older frame reads narrower up top and thicker through the middle.
  const aged = clamp((clamp(age, 15, 100) - 30) / 45, 0, 1);
  const frame = 1 - 0.07 * aged;
  const middle = 1 + 0.09 * aged;

  return {
    neck: round(s(9, 0.4)),
    shoulder: round(s(38, 0.35) * (female ? 0.88 : 1) * frame),
    chest: round(s(35, 0.42) * (female ? 0.97 : 1) * frame),
    waist: round(s(28, 1.12) * (female ? 0.94 : 1) * middle),
    hip: round(s(32, 0.75) * (female ? 1.14 : 1)),
    thigh: round(s(17.5, 0.62) * (female ? 1.06 : 1) * frame),
    calf: round(s(12.5, 0.58)),
    upperArm: round(s(10.5, 0.55) * frame),
    forearm: round(s(9, 0.55)),
  };
}

function torsoPath(w) {
  const { cx, shoulderY, chestY, waistY, hipY, crotchY } = LAYOUT;

  return [
    `M ${round(cx - w.shoulder)} ${shoulderY}`,
    `C ${round(cx - w.shoulder - 1)} ${chestY - 18} ${round(cx - w.chest - 1)} ${chestY - 8} ${round(cx - w.chest)} ${chestY}`,
    `C ${round(cx - w.chest)} ${waistY - 30} ${round(cx - w.waist - 1)} ${waistY - 14} ${round(cx - w.waist)} ${waistY}`,
    `C ${round(cx - w.waist - 1)} ${hipY - 24} ${round(cx - w.hip)} ${hipY - 12} ${round(cx - w.hip)} ${hipY}`,
    `L ${round(cx - w.hip * 0.95)} ${crotchY}`,
    `L ${round(cx + w.hip * 0.95)} ${crotchY}`,
    `L ${round(cx + w.hip)} ${hipY}`,
    `C ${round(cx + w.hip)} ${hipY - 12} ${round(cx + w.waist + 1)} ${hipY - 24} ${round(cx + w.waist)} ${waistY}`,
    `C ${round(cx + w.waist + 1)} ${waistY - 14} ${round(cx + w.chest)} ${waistY - 30} ${round(cx + w.chest)} ${chestY}`,
    `C ${round(cx + w.chest + 1)} ${chestY - 8} ${round(cx + w.shoulder + 1)} ${chestY - 18} ${round(cx + w.shoulder)} ${shoulderY}`,
    `Q ${cx} ${shoulderY - 11} ${round(cx - w.shoulder)} ${shoulderY}`,
    'Z',
  ].join(' ');
}

// Limbs are stroked polylines with round caps rather than closed outlines —
// far less geometry to keep symmetric, and it matches the flat illustrated look.
function limbs(w) {
  const { cx, shoulderY, chestY, waistY, hipY, crotchY, kneeY, ankleY } = LAYOUT;
  const clearance = Math.max(w.shoulder, w.waist, w.hip) + w.upperArm * 0.55;

  const arm = (side) => {
    const elbowX = round(cx + side * (clearance + 2));
    const elbowY = chestY + 48;
    const wristX = round(cx + side * (clearance + 5));
    const wristY = waistY + 44;
    return {
      upper: `M ${round(cx + side * w.shoulder * 0.88)} ${shoulderY + 6} L ${elbowX} ${elbowY}`,
      fore: `M ${elbowX} ${elbowY} L ${wristX} ${wristY}`,
      wrist: { x: wristX, y: wristY },
    };
  };

  const leg = (side) => ({
    thigh: `M ${round(cx + side * w.hip * 0.46)} ${crotchY - 6} L ${round(cx + side * w.hip * 0.42)} ${kneeY}`,
    calf: `M ${round(cx + side * w.hip * 0.42)} ${kneeY} L ${round(cx + side * w.hip * 0.38)} ${ankleY}`,
    footX: round(cx + side * w.hip * 0.38),
  });

  return {
    leftArm: arm(-1),
    rightArm: arm(1),
    leftLeg: leg(-1),
    rightLeg: leg(1),
    neck: `M ${cx} ${LAYOUT.neckTop - 2} L ${cx} ${shoulderY - 2}`,
    hipY,
  };
}

function shortsPath(w) {
  const { cx, waistY } = LAYOUT;
  const top = waistY + 16;
  const hem = 268;
  const notch = 244;

  return [
    `M ${round(cx - w.hip - 1)} ${top}`,
    `L ${round(cx + w.hip + 1)} ${top}`,
    `L ${round(cx + w.hip * 0.99)} ${hem}`,
    `L ${round(cx + w.hip * 0.28)} ${hem}`,
    `L ${cx} ${notch}`,
    `L ${round(cx - w.hip * 0.28)} ${hem}`,
    `L ${round(cx - w.hip * 0.99)} ${hem}`,
    'Z',
  ].join(' ');
}

function braPath(w) {
  const { cx, chestY } = LAYOUT;
  const top = chestY - 14;
  const bottom = chestY + 22;

  return [
    `M ${round(cx - w.chest - 1)} ${top}`,
    `C ${round(cx - w.chest * 0.4)} ${top + 12} ${round(cx + w.chest * 0.4)} ${top + 12} ${round(cx + w.chest + 1)} ${top}`,
    `L ${round(cx + w.chest * 0.99)} ${bottom}`,
    `L ${round(cx - w.chest * 0.99)} ${bottom}`,
    'Z',
  ].join(' ');
}

// Definition lines for lean bodies, a belly fold for heavy ones — this is what
// makes two figures of different BMI read as different builds, not just sizes.
function detailPaths(bmi, w) {
  const { cx, chestY, waistY } = LAYOUT;
  const details = [];

  if (bmi < 25) {
    const abWidth = w.waist * 0.34;
    details.push(`M ${cx} ${chestY + 16} L ${cx} ${waistY - 2}`);
    [0, 1, 2].forEach((row) => {
      const y = chestY + 26 + row * 14;
      details.push(`M ${round(cx - abWidth)} ${y} L ${round(cx + abWidth)} ${y}`);
    });
    details.push(
      `M ${round(cx - w.chest * 0.72)} ${chestY + 6} Q ${cx} ${chestY + 18} ${round(cx + w.chest * 0.72)} ${chestY + 6}`
    );
  } else {
    details.push(
      `M ${round(cx - w.waist * 0.68)} ${waistY - 26} Q ${cx} ${waistY - 6} ${round(cx + w.waist * 0.68)} ${waistY - 26}`
    );
    if (bmi >= 30) {
      details.push(
        `M ${round(cx - w.waist * 0.5)} ${waistY + 6} Q ${cx} ${waistY + 22} ${round(cx + w.waist * 0.5)} ${waistY + 6}`
      );
    }
  }

  return details;
}

function buildFigure(bmi, sex, variant, age = 30) {
  const w = bodyWidths(bmi, sex, age);
  const traits = ageTraits(age, sex);

  return {
    variant,
    traits,
    // An older figure carries its head slightly lower and further forward.
    head: {
      cx: LAYOUT.cx,
      cy: round(LAYOUT.headCy + traits.slump * 6),
      rx: LAYOUT.headRx,
      ry: LAYOUT.headRy,
    },
    widths: w,
    layout: LAYOUT,
    palette: PALETTE,
    outfit: OUTFITS[variant],
    female: sex === 'female',
    torso: torsoPath(w),
    limbs: limbs(w),
    shorts: shortsPath(w),
    bra: sex === 'female' ? braPath(w) : null,
    details: detailPaths(bmi, w),
    lean: bmi < 25,
  };
}

module.exports = { buildFigure, bodyWidths, ageTraits, LAYOUT, PALETTE, OUTFITS };
