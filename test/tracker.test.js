const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Point the database at a throwaway file before anything imports src/db.
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bmi-test-')), 'test.db');

const { hashPassword, verifyPassword, createUser, findByEmail, updatePassword } = require('../src/auth');
const resets = require('../src/passwordReset');
const db = require('../src/db');
const entries = require('../src/entries');

test('password hashes are salted, not reversible, and verify correctly', () => {
  const hash = hashPassword('correct horse battery');

  assert.ok(!hash.includes('correct horse battery'));
  assert.ok(hash.startsWith('scrypt:'));
  assert.equal(verifyPassword('correct horse battery', hash), true);
  assert.equal(verifyPassword('wrong password', hash), false);

  // Same password twice must not produce the same stored value.
  assert.notEqual(hash, hashPassword('correct horse battery'));
});

test('verifyPassword rejects malformed stored values instead of throwing', () => {
  assert.equal(verifyPassword('anything', ''), false);
  assert.equal(verifyPassword('anything', 'bcrypt:abc:def'), false);
  assert.equal(verifyPassword('anything', 'scrypt:onlysalt'), false);
});

test('emails are stored and looked up case-insensitively', () => {
  createUser('Mixed.Case@Example.com', 'password1234');

  assert.ok(findByEmail('mixed.case@example.com'));
  assert.ok(findByEmail('MIXED.CASE@EXAMPLE.COM'));
  assert.equal(findByEmail('mixed.case@example.com').email, 'mixed.case@example.com');
});

test('validateEntry accepts a well-formed entry', () => {
  const result = entries.validateEntry({
    entryDate: '2026-09-23',
    description: '  Chicken rice bowl  ',
    calories: '680',
  });

  assert.equal(result.isValid, true);
  assert.equal(result.values.description, 'Chicken rice bowl');
  assert.equal(result.values.calories, 680);
});

test('validateEntry rejects bad dates, empty text, and out-of-range calories', () => {
  assert.equal(entries.validateEntry({ entryDate: '23-09-2026', description: 'x', calories: 1 }).errors.entryDate,
    'Pick a valid date.');
  assert.equal(entries.validateEntry({ entryDate: '2026-09-23', description: '   ', calories: 1 }).errors.description,
    'Describe what you ate.');
  assert.ok(entries.validateEntry({ entryDate: '2026-09-23', description: 'x', calories: 99999 }).errors.calories);
  assert.ok(entries.validateEntry({ entryDate: '2026-09-23', description: 'x', calories: '' }).errors.calories);
});

test('daily totals sum only the requested user and date', () => {
  const alice = createUser('alice@example.com', 'password1234');
  const bob = createUser('bob@example.com', 'password1234');

  entries.addEntry(alice.id, { entryDate: '2026-09-23', description: 'Breakfast', calories: 400 });
  entries.addEntry(alice.id, { entryDate: '2026-09-23', description: 'Lunch', calories: 600 });
  entries.addEntry(alice.id, { entryDate: '2026-09-24', description: 'Next day', calories: 999 });
  entries.addEntry(bob.id, { entryDate: '2026-09-23', description: 'Bob lunch', calories: 500 });

  assert.equal(entries.totalForDate(alice.id, '2026-09-23'), 1000);
  assert.equal(entries.totalForDate(bob.id, '2026-09-23'), 500);
  assert.equal(entries.totalForDate(alice.id, '2026-09-25'), 0);
  assert.equal(entries.listForDate(alice.id, '2026-09-23').length, 2);
});

test('deleting an entry is scoped to its owner', () => {
  const owner = createUser('owner@example.com', 'password1234');
  const attacker = createUser('attacker@example.com', 'password1234');

  entries.addEntry(owner.id, { entryDate: '2026-09-23', description: 'Private', calories: 300 });
  const target = entries.listForDate(owner.id, '2026-09-23')[0];

  assert.equal(entries.deleteEntry(attacker.id, target.id), 0);
  assert.equal(entries.listForDate(owner.id, '2026-09-23').length, 1);

  assert.equal(entries.deleteEntry(owner.id, target.id), 1);
  assert.equal(entries.listForDate(owner.id, '2026-09-23').length, 0);
});

test('updating an entry is scoped to its owner', () => {
  const owner = createUser('editor@example.com', 'password1234');
  const attacker = createUser('intruder@example.com', 'password1234');

  entries.addEntry(owner.id, { entryDate: '2026-10-01', description: 'Toast', calories: 200 });
  const target = entries.listForDate(owner.id, '2026-10-01')[0];

  assert.equal(
    entries.updateEntry(attacker.id, target.id, { description: 'HACKED', calories: 1 }),
    0,
    'a non-owner must change nothing'
  );
  assert.equal(entries.listForDate(owner.id, '2026-10-01')[0].description, 'Toast');

  assert.equal(
    entries.updateEntry(owner.id, target.id, { description: 'Toast and jam', calories: 320 }),
    1
  );
  const updated = entries.listForDate(owner.id, '2026-10-01')[0];
  assert.equal(updated.description, 'Toast and jam');
  assert.equal(updated.calories, 320);
});

test('editing an entry changes that day total', () => {
  const user = createUser('totals@example.com', 'password1234');
  entries.addEntry(user.id, { entryDate: '2026-10-02', description: 'Lunch', calories: 500 });
  const row = entries.listForDate(user.id, '2026-10-02')[0];

  assert.equal(entries.totalForDate(user.id, '2026-10-02'), 500);
  entries.updateEntry(user.id, row.id, { description: 'Lunch', calories: 800 });
  assert.equal(entries.totalForDate(user.id, '2026-10-02'), 800);
});

test('findEntry only returns rows belonging to the caller', () => {
  const owner = createUser('finder@example.com', 'password1234');
  const other = createUser('nosy@example.com', 'password1234');
  entries.addEntry(owner.id, { entryDate: '2026-10-03', description: 'Snack', calories: 150 });
  const row = entries.listForDate(owner.id, '2026-10-03')[0];

  assert.ok(entries.findEntry(owner.id, row.id));
  assert.equal(entries.findEntry(other.id, row.id), undefined);
});

test('reset tokens are stored hashed, never in the clear', () => {
  const user = createUser('reset@example.com', 'password1234');
  const token = resets.createToken(user.id);

  const row = db.prepare('SELECT token_hash FROM password_resets WHERE user_id = ?').get(user.id);
  assert.notEqual(row.token_hash, token, 'the raw token must not be stored');
  assert.equal(row.token_hash.length, 64, 'sha256 hex');
  assert.ok(resets.findValidToken(token), 'the raw token still validates');
});

test('reset tokens are single use', () => {
  const user = createUser('single@example.com', 'password1234');
  const token = resets.createToken(user.id);

  const record = resets.findValidToken(token);
  resets.consumeToken(record.id);
  assert.equal(resets.findValidToken(token), null);
});

test('a successful reset invalidates every other outstanding token', () => {
  const user = createUser('multi@example.com', 'password1234');
  const first = resets.createToken(user.id);
  const second = resets.createToken(user.id);

  resets.invalidateForUser(user.id);
  assert.equal(resets.findValidToken(first), null);
  assert.equal(resets.findValidToken(second), null);
});

test('expired tokens do not validate', () => {
  const user = createUser('expired@example.com', 'password1234');
  const token = resets.createToken(user.id);

  db.prepare("UPDATE password_resets SET expires_at = datetime('now', '-1 minutes') WHERE user_id = ?")
    .run(user.id);
  assert.equal(resets.findValidToken(token), null);
});

test('garbage tokens are rejected without throwing', () => {
  assert.equal(resets.findValidToken(''), null);
  assert.equal(resets.findValidToken(null), null);
  assert.equal(resets.findValidToken('not-a-real-token'), null);
});

test('resetting the password lets the new one in and locks the old one out', () => {
  const user = createUser('rotate@example.com', 'originalpass1');
  updatePassword(user.id, 'replacementpass2');

  const reloaded = findByEmail('rotate@example.com');
  assert.equal(verifyPassword('replacementpass2', reloaded.password_hash), true);
  assert.equal(verifyPassword('originalpass1', reloaded.password_hash), false);
});

test('monthTotals only covers the requested month and user', () => {
  const user = createUser('month@example.com', 'password1234');
  const other = createUser('othermonth@example.com', 'password1234');

  entries.addEntry(user.id, { entryDate: '2026-04-10', description: 'A', calories: 300 });
  entries.addEntry(user.id, { entryDate: '2026-04-10', description: 'B', calories: 200 });
  entries.addEntry(user.id, { entryDate: '2026-05-01', description: 'Next month', calories: 900 });
  entries.addEntry(other.id, { entryDate: '2026-04-10', description: 'Theirs', calories: 700 });

  const april = entries.monthTotals(user.id, '2026-04');
  assert.deepEqual(Object.keys(april), ['2026-04-10']);
  assert.equal(april['2026-04-10'].total, 500);
  assert.equal(april['2026-04-10'].items, 2);
});
