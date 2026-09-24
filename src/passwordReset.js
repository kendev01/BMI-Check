const crypto = require('crypto');
const db = require('./db');

const TOKEN_TTL_MINUTES = 60;

// Only the hash is stored: a leaked database still cannot be used to reset
// anyone's password, because the raw token exists solely in the emailed link.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');

  db.prepare(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES (?, ?, datetime('now', ?))`
  ).run(userId, hashToken(token), `+${TOKEN_TTL_MINUTES} minutes`);

  return token;
}

function findValidToken(token) {
  if (!token || typeof token !== 'string') return null;

  return (
    db
      .prepare(
        `SELECT * FROM password_resets
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`
      )
      .get(hashToken(token)) || null
  );
}

function consumeToken(id) {
  db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").run(id);
}

// After a successful reset, kill every other outstanding link for that user so
// an older email cannot be replayed.
function invalidateForUser(userId) {
  db.prepare(
    "UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"
  ).run(userId);
}

// Crude throttle: one email per address per minute, enough to stop the form
// being used to spam someone's inbox.
function recentlyRequested(userId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS recent FROM password_resets
       WHERE user_id = ? AND created_at > datetime('now', '-1 minutes')`
    )
    .get(userId);
  return row.recent > 0;
}

module.exports = {
  TOKEN_TTL_MINUTES,
  createToken,
  findValidToken,
  consumeToken,
  invalidateForUser,
  recentlyRequested,
};
