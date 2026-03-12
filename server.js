// server.js — Servidor principal Express

require('dotenv').config();
const express     = require('express');
const path        = require('path');
const cookieParser = require('cookie-parser');
const rateLimit   = require('express-rate-limit');

// Inicializar BD al arrancar
require('./db/database');

const app = express();

// ── Middlewares globales ──────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting en rutas de auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, msg: 'Demasiados intentos. Espera 15 minutos.' }
});

// ── Archivos estáticos ────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, require('./routes/auth'));
app.use('/api/pedidos',  require('./routes/pedidos'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/escuelas', require('./routes/escuelas'));
app.use('/api/grupos',  require('./routes/grupos'));

// ── SPA fallback — /app sirve app.html ───────────────────────
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// ── Arrancar servidor ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎓 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Base de datos: ${process.env.DB_PATH || './db/pedidos.db'}\n`);
});
