const express = require('express');
const { findByEmail, createUser, verifyPassword, normalizeEmail, updatePassword } = require('../auth');
const resets = require('../passwordReset');
const { sendPasswordReset } = require('../mailer');
const { buildFigure } = require('../figure2d');

const router = express.Router();

// Decorative pair for the marketing panel: a heavier build beside a leaner one.
const heroFigures = {
  current: buildFigure(31, 'male', 'current', 34),
  goal: buildFigure(23, 'male', 'goal', 34),
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('signup', { errors: {}, values: {}, heroFigures });
});

router.post('/signup', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const errors = {};

  if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!errors.email && findByEmail(email)) {
    errors.email = 'That email is already registered.';
  }

  if (Object.keys(errors).length) {
    return res.status(400).render('signup', { errors, values: { email }, heroFigures });
  }

  const user = createUser(email, password);
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('login', { errors: {}, values: {}, heroFigures });
});

router.post('/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const user = findByEmail(email);

  // One generic message so the form cannot be used to discover registered emails.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res
      .status(401)
      .render('login', { errors: { form: 'Email or password is incorrect.' }, values: { email }, heroFigures });
  }

  req.session.userId = user.id;
  res.redirect('/dashboard');
});

router.get('/forgot', (req, res) => {
  res.render('forgot', { sent: false, errors: {}, values: {}, previewUrl: null, fallbackUrl: null });
});

router.post('/forgot', async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!EMAIL_PATTERN.test(email)) {
    return res
      .status(400)
      .render('forgot', { sent: false, errors: { email: 'Enter a valid email address.' }, values: { email }, previewUrl: null, fallbackUrl: null });
  }

  const user = findByEmail(email);
  let previewUrl = null;
  let fallbackUrl = null;

  // The rendered response is identical whether or not the address is
  // registered, so the form cannot be used to discover who has an account.
  // That includes mail failures: they are logged, never surfaced.
  if (user && !resets.recentlyRequested(user.id)) {
    try {
      const token = resets.createToken(user.id);
      const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const result = await sendPasswordReset(user.email, `${base}/reset/${token}`);
      previewUrl = result.previewUrl;
      fallbackUrl = result.resetUrl;
    } catch (err) {
      console.error('[mail] Failed to send password reset:', err.message);
    }
  }

  res.render('forgot', { sent: true, errors: {}, values: { email }, previewUrl, fallbackUrl });
});

router.get('/reset/:token', (req, res) => {
  const record = resets.findValidToken(req.params.token);
  if (!record) return res.status(400).render('reset', { valid: false, token: null, errors: {} });

  res.render('reset', { valid: true, token: req.params.token, errors: {} });
});

router.post('/reset/:token', (req, res) => {
  const record = resets.findValidToken(req.params.token);
  if (!record) return res.status(400).render('reset', { valid: false, token: null, errors: {} });

  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm || '');

  const errors = {};
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password !== confirm) {
    errors.confirm = 'Both passwords must match.';
  }

  if (Object.keys(errors).length) {
    return res.status(400).render('reset', { valid: true, token: req.params.token, errors });
  }

  updatePassword(record.user_id, password);
  resets.consumeToken(record.id);
  resets.invalidateForUser(record.user_id);

  req.session.userId = record.user_id;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

module.exports = router;
