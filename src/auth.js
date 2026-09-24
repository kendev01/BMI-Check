const crypto = require('crypto');
const db = require('./db');

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, expected] = String(stored).split(':');
  if (scheme !== 'scrypt' || !salt || !expected) return false;

  const expectedBuffer = Buffer.from(expected, 'hex');
  const candidate = crypto.scryptSync(password, salt, expectedBuffer.length);
  return crypto.timingSafeEqual(candidate, expectedBuffer);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createUser(email, password) {
  const result = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(normalizeEmail(email), hashPassword(password));
  return findById(result.lastInsertRowid);
}

function updatePassword(userId, password) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId);
}

function saveGoalDates(userId, startDate, targetDate) {
  db.prepare('UPDATE users SET goal_start_date = ?, goal_target_date = ? WHERE id = ?')
    .run(startDate, targetDate, userId);
}

function saveProfile(userId, values) {
  db.prepare(
    `UPDATE users SET
       height_cm = ?, actual_weight_kg = ?, desired_weight_kg = ?,
       age = ?, sex = ?, activity_level = ?
     WHERE id = ?`
  ).run(
    values.heightCm,
    values.actualWeightKg,
    values.desiredWeightKg,
    values.age,
    values.sex,
    values.activityLevel,
    userId
  );
}

// Users carry their last calculator inputs so the tracker can recompute a live
// target instead of storing a number that goes stale when they recalculate.
function profileFromUser(user) {
  if (!user || user.height_cm == null || user.sex == null || user.activity_level == null) {
    return null;
  }
  return {
    heightCm: user.height_cm,
    actualWeightKg: user.actual_weight_kg,
    desiredWeightKg: user.desired_weight_kg,
    age: user.age,
    sex: user.sex,
    activityLevel: user.activity_level,
  };
}

function attachUser(req, res, next) {
  const userId = req.session && req.session.userId;
  req.user = userId ? findById(userId) : null;
  res.locals.currentUser = req.user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  normalizeEmail,
  findByEmail,
  findById,
  createUser,
  updatePassword,
  saveGoalDates,
  saveProfile,
  profileFromUser,
  attachUser,
  requireAuth,
};
