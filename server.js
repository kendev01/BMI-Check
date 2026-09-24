const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const { attachUser } = require('./src/auth');
const bmiRoutes = require('./src/routes/bmiRoutes');
const authRoutes = require('./src/routes/authRoutes');
const trackerRoutes = require('./src/routes/trackerRoutes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

app.use(
  cookieSession({
    name: 'bmicheck.sid',
    keys: [process.env.SESSION_SECRET || 'dev-only-change-me'],
    httpOnly: true,
    // sameSite 'lax' blocks cross-site form POSTs, which is what stands in for
    // CSRF tokens here; revisit if any state-changing request becomes a GET.
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
);

app.use(attachUser);

app.use('/', authRoutes);
app.use('/', trackerRoutes);
app.use('/', bmiRoutes);

app.use((req, res) => {
  res.redirect('/');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again.');
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`BMI Check running at http://localhost:${PORT}`);
});
