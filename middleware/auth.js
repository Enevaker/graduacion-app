// middleware/auth.js — Verifica JWT en cookies o header Authorization

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.cookies?.token ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ ok: false, msg: 'No autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, msg: 'Sesión expirada, inicia sesión nuevamente' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ ok: false, msg: 'Acceso solo para administradores' });
  }
  next();
}

function adminOrColabOnly(req, res, next) {
  if (!['admin', 'colaborador'].includes(req.user?.rol)) {
    return res.status(403).json({ ok: false, msg: 'Acceso restringido' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, adminOrColabOnly };
