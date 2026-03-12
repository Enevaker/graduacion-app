// routes/auth.js — Registro, login, perfil, logout, Google OAuth

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function cookieOpts() {
  return { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000,
           secure: process.env.NODE_ENV === 'production' };
}

// ── POST /api/auth/registro ───────────────────────────────────
router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, telefono, colegio, ciudad } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ ok: false, msg: 'Nombre, email y contraseña son requeridos' });

    const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existe) return res.status(409).json({ ok: false, msg: 'Este correo ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare(`
      INSERT INTO usuarios (nombre, email, password, telefono, colegio, ciudad)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(nombre, email.toLowerCase(), hash, telefono||'', colegio||'', ciudad||'');
    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(info.lastInsertRowid);

    const token = signToken(user);
    res.cookie('token', token, cookieOpts());
    res.json({ ok: true, msg: 'Cuenta creada', user: safeUser(user), token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al crear cuenta' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { nombre, password } = req.body;
    if (!nombre || !password)
      return res.status(400).json({ ok: false, msg: 'Nombre y contraseña requeridos' });

    const user = db.prepare('SELECT * FROM usuarios WHERE LOWER(nombre) = LOWER(?)').get(nombre.trim());
    if (!user) return res.status(401).json({ ok: false, msg: 'Nombre o contraseña incorrectos' });
    if (!user.activo) return res.status(403).json({ ok: false, msg: 'Cuenta desactivada' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ ok: false, msg: 'Nombre o contraseña incorrectos' });

    const token = signToken(user);
    res.cookie('token', token, cookieOpts());
    res.json({ ok: true, user: safeUser(user), token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al iniciar sesión' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
  res.json({ ok: true, user: safeUser(user) });
});

// ── PUT /api/auth/perfil ──────────────────────────────────────
router.put('/perfil', authMiddleware, async (req, res) => {
  try {
    const { nombre, email, telefono, colegio, ciudad,
            estado, colonia, cp, direccion, referencias,
            passwordActual, passwordNuevo } = req.body;
    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);

    // Validar email único si se cambia
    if (email && email !== user.email) {
      const existe = db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND id != ?').get(email, req.user.id);
      if (existe) return res.status(409).json({ ok: false, msg: 'Ese correo ya está en uso' });
    }

    // Cambio de contraseña opcional
    let hash = user.password;
    if (passwordNuevo) {
      if (!passwordActual) return res.status(400).json({ ok: false, msg: 'Ingresa tu contraseña actual' });
      const ok = await bcrypt.compare(passwordActual, user.password);
      if (!ok) return res.status(400).json({ ok: false, msg: 'Contraseña actual incorrecta' });
      hash = await bcrypt.hash(passwordNuevo, 10);
    }

    db.prepare(`
      UPDATE usuarios
      SET nombre=?, email=?, telefono=?, colegio=?, ciudad=?,
          estado=?, colonia=?, cp=?, direccion=?, referencias=?, password=?
      WHERE id=?
    `).run(
      nombre    || user.nombre,
      email     || user.email || null,
      telefono  !== undefined ? telefono  : user.telefono,
      colegio   !== undefined ? colegio   : user.colegio,
      ciudad    !== undefined ? ciudad    : user.ciudad,
      estado    !== undefined ? estado    : user.estado,
      colonia   !== undefined ? colonia   : user.colonia,
      cp        !== undefined ? cp        : user.cp,
      direccion !== undefined ? direccion : user.direccion,
      referencias !== undefined ? referencias : user.referencias,
      hash, req.user.id
    );

    const updated = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
    const token = signToken(updated);
    res.cookie('token', token, cookieOpts());
    res.json({ ok: true, msg: 'Perfil actualizado', user: safeUser(updated), token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al actualizar perfil' });
  }
});

function safeUser(u) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol,
           telefono: u.telefono, colegio: u.colegio, ciudad: u.ciudad,
           estado: u.estado, colonia: u.colonia, cp: u.cp,
           direccion: u.direccion, referencias: u.referencias,
           creado_en: u.creado_en };
}

module.exports = router;
