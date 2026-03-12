// routes/grupos.js — CRUD de grupos / salones

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const NIVELES = ['preescolar','primaria','secundaria','preparatoria','maestro','coordinador'];

// ── GET /api/grupos ───────────────────────────────────────────
router.get('/', (req, res) => {
  const uid     = req.user.id;
  const isAdmin = ['admin', 'colaborador'].includes(req.user.rol);

  const grupos = isAdmin
    ? db.prepare('SELECT * FROM grupos ORDER BY creado_en DESC').all()
    : db.prepare('SELECT * FROM grupos WHERE usuario_id = ? ORDER BY creado_en DESC').all(uid);

  const result = grupos.map(g => {
    const pedidos = db.prepare(`
      SELECT p.id, p.codigo, p.estado, p.total_alumnos, p.total_ninas, p.total_ninos, p.creado_en,
             COALESCE(
               (SELECT porcentaje FROM pedido_avances WHERE pedido_id = p.id ORDER BY creado_en DESC LIMIT 1),
               0
             ) AS porcentaje
      FROM pedidos p
      WHERE p.grupo_id = ?
      ORDER BY p.creado_en DESC
    `).all(g.id);
    return { ...g, pedidos };
  });

  res.json({ ok: true, grupos: result });
});

// ── POST /api/grupos ──────────────────────────────────────────
router.post('/', (req, res) => {
  const { nivel, nombre, colegio } = req.body;

  if (!nivel || !NIVELES.includes(nivel))
    return res.json({ ok: false, msg: 'Nivel no válido' });
  if (!nombre?.trim())
    return res.json({ ok: false, msg: 'El nombre del grupo es requerido' });
  if (!colegio?.trim())
    return res.json({ ok: false, msg: 'El nombre del colegio es requerido' });

  const info = db.prepare(
    'INSERT INTO grupos (usuario_id, nivel, nombre, colegio) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, nivel, nombre.trim(), colegio.trim());

  const grupo = db.prepare('SELECT * FROM grupos WHERE id = ?').get(info.lastInsertRowid);
  res.json({ ok: true, grupo });
});

module.exports = router;
