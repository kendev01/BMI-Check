const db = require('./db');

// Local calendar date, not UTC — an entry logged at 9pm should belong to that day.
function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function addEntry(userId, { entryDate, description, calories }) {
  db.prepare(
    'INSERT INTO entries (user_id, entry_date, description, calories) VALUES (?, ?, ?, ?)'
  ).run(userId, entryDate, description, calories);
}

function listForDate(userId, entryDate) {
  return db
    .prepare(
      'SELECT * FROM entries WHERE user_id = ? AND entry_date = ? ORDER BY id DESC'
    )
    .all(userId, entryDate);
}

function totalForDate(userId, entryDate) {
  const row = db
    .prepare(
      'SELECT COALESCE(SUM(calories), 0) AS total FROM entries WHERE user_id = ? AND entry_date = ?'
    )
    .get(userId, entryDate);
  return row.total;
}

function recentDays(userId, limit = 7) {
  return db
    .prepare(
      `SELECT entry_date, SUM(calories) AS total, COUNT(*) AS items
       FROM entries WHERE user_id = ?
       GROUP BY entry_date ORDER BY entry_date DESC LIMIT ?`
    )
    .all(userId, limit);
}

// Totals for one calendar month, keyed by date for direct grid lookup.
function monthTotals(userId, monthISO) {
  const rows = db
    .prepare(
      `SELECT entry_date, SUM(calories) AS total, COUNT(*) AS items
       FROM entries WHERE user_id = ? AND entry_date LIKE ?
       GROUP BY entry_date`
    )
    .all(userId, `${monthISO}-%`);

  return Object.fromEntries(rows.map((r) => [r.entry_date, r]));
}

function findEntry(userId, entryId) {
  return db.prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?').get(entryId, userId);
}

// Scoped by user_id, like deleteEntry, so a guessed id cannot reach another account.
function updateEntry(userId, entryId, { description, calories }) {
  return db
    .prepare('UPDATE entries SET description = ?, calories = ? WHERE id = ? AND user_id = ?')
    .run(description, calories, entryId, userId).changes;
}

// Scoped by user_id so one account cannot delete another's row by guessing ids.
function deleteEntry(userId, entryId) {
  return db
    .prepare('DELETE FROM entries WHERE id = ? AND user_id = ?')
    .run(entryId, userId).changes;
}

function validateEntry(body) {
  const errors = {};

  const entryDate = isValidDate(body.entryDate) ? body.entryDate : null;
  if (!entryDate) errors.entryDate = 'Pick a valid date.';

  const description = String(body.description || '').trim();
  if (!description) errors.description = 'Describe what you ate.';
  else if (description.length > 120) errors.description = 'Keep it under 120 characters.';

  const calories = Number(body.calories);
  if (String(body.calories || '').trim() === '' || Number.isNaN(calories)) {
    errors.calories = 'Calories is required.';
  } else if (calories < 0 || calories > 10000) {
    errors.calories = 'Calories must be between 0 and 10000.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: { entryDate, description, calories: Math.round(calories) },
  };
}

module.exports = {
  todayISO,
  findEntry,
  updateEntry,
  monthTotals,
  isValidDate,
  addEntry,
  listForDate,
  totalForDate,
  recentDays,
  deleteEntry,
  validateEntry,
};
