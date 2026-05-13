const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

function sessionMiddleware() {
  return session({
    store: new pgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'changeme-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'grantcrm.sid',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    }
  });
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  res.redirect('/login');
}

async function loginHandler(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const r = await pool.query('SELECT * FROM users WHERE username = $1 AND active = true', [username]);
    if (!r.rowCount) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    req.session.username = user.username;
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    res.json({ ok: true, username: user.username });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
}

function logoutHandler(req, res) {
  req.session.destroy(() => res.clearCookie('grantcrm.sid').json({ ok: true }));
}

function meHandler(req, res) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ userId: req.session.userId, username: req.session.username });
}

module.exports = { sessionMiddleware, requireAuth, loginHandler, logoutHandler, meHandler };
