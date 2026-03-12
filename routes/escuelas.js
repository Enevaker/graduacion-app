// routes/escuelas.js — Imágenes de escuela y avances de pedido

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const path    = require('path');
const fs      = require('fs');
const { authMiddleware, adminOnly, adminOrColabOnly } = require('../middleware/auth');
const { uploadEscuela, uploadAvance, uploadMedia, handleUpload } = require('../middleware/upload');

function tryUnlink(filepath) {
  try { fs.unlinkSync(filepath); } catch {}
}

// ── BULK FETCH ────────────────────────────────────────────────

// GET /api/escuelas/data  →  admin: todas las imágenes + todos los avances
router.get('/data', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const imagenes = db.prepare('SELECT * FROM escuela_imagenes ORDER BY creado_en DESC').all();
    const avances  = db.prepare('SELECT * FROM pedido_avances  ORDER BY creado_en ASC').all();
    res.json({ ok: true, imagenes, avances });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/escuelas/mis-avances  →  avances de los pedidos del usuario
router.get('/mis-avances', authMiddleware, (req, res) => {
  try {
    if (['admin', 'colaborador'].includes(req.user.rol)) {
      const avances = db.prepare('SELECT * FROM pedido_avances ORDER BY creado_en ASC').all();
      return res.json({ ok: true, avances });
    }
    const avances = db.prepare(`
      SELECT pa.* FROM pedido_avances pa
      JOIN pedidos p ON pa.pedido_id = p.id
      WHERE p.usuario_id = ?
      ORDER BY pa.creado_en ASC
    `).all(req.user.id);
    res.json({ ok: true, avances });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── IMÁGENES DE ESCUELA (admin only) ─────────────────────────

// POST /api/escuelas/:colegio/imagenes
router.post('/:colegio/imagenes',
  authMiddleware,
  adminOrColabOnly,
  handleUpload(uploadEscuela.single('imagen')),
  (req, res) => {
    try {
      const colegio    = decodeURIComponent(req.params.colegio);
      const { tipo, descripcion } = req.body;

      if (!['uniforme', 'tela', 'muneco'].includes(tipo))
        return res.status(400).json({ ok: false, msg: 'Tipo inválido' });
      if (!req.file)
        return res.status(400).json({ ok: false, msg: 'Se requiere una imagen' });

      const r = db.prepare(
        'INSERT INTO escuela_imagenes (colegio, tipo, filename, descripcion) VALUES (?, ?, ?, ?)'
      ).run(colegio, tipo, req.file.filename, descripcion?.trim() || null);

      res.json({ ok: true, imagen: {
        id: r.lastInsertRowid, colegio, tipo,
        filename: req.file.filename,
        descripcion: descripcion?.trim() || null,
        creado_en: new Date().toISOString(),
      }});
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// DELETE /api/escuelas/imagenes/:id
router.delete('/imagenes/:id', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const row = db.prepare('SELECT filename FROM escuela_imagenes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ ok: false, msg: 'Imagen no encontrada' });
    db.prepare('DELETE FROM escuela_imagenes WHERE id = ?').run(req.params.id);
    tryUnlink(path.join(__dirname, '..', 'public', 'uploads', 'escuelas', row.filename));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── AVANCES DE PEDIDO ─────────────────────────────────────────

// POST /api/escuelas/pedidos/:pedidoId/avances  (acepta múltiples archivos)
router.post('/pedidos/:pedidoId/avances',
  authMiddleware,
  adminOrColabOnly,
  handleUpload(uploadMedia.array('archivos', 10)),
  (req, res) => {
    try {
      const pedido = db.prepare('SELECT id FROM pedidos WHERE id = ?').get(req.params.pedidoId);
      if (!pedido) return res.status(404).json({ ok: false, msg: 'Pedido no encontrado' });

      const mensaje = req.body.mensaje?.trim() || null;
      const files   = req.files || [];
      const avances = [];

      if (!files.length && !mensaje) {
        return res.status(400).json({ ok: false, msg: 'Escribe un mensaje o adjunta al menos un archivo' });
      }

      const insertStmt = db.prepare('INSERT INTO pedido_avances (pedido_id, mensaje, filename) VALUES (?, ?, ?)');

      if (!files.length) {
        // Solo mensaje, sin archivo
        const r = insertStmt.run(pedido.id, mensaje, null);
        avances.push({ id: r.lastInsertRowid, pedido_id: pedido.id, mensaje, filename: null, creado_en: new Date().toISOString() });
      } else {
        // Un registro por archivo; solo el primero lleva el mensaje
        for (let i = 0; i < files.length; i++) {
          const r = insertStmt.run(pedido.id, i === 0 ? mensaje : null, files[i].filename);
          avances.push({ id: r.lastInsertRowid, pedido_id: pedido.id, mensaje: i === 0 ? mensaje : null, filename: files[i].filename, creado_en: new Date().toISOString() });
        }
      }

      res.json({ ok: true, avances });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// DELETE /api/escuelas/avances/:id
router.delete('/avances/:id', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const row = db.prepare('SELECT filename FROM pedido_avances WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ ok: false, msg: 'Avance no encontrado' });
    db.prepare('DELETE FROM pedido_avances WHERE id = ?').run(req.params.id);
    if (row.filename) tryUnlink(path.join(__dirname, '..', 'public', 'uploads', 'avances', row.filename));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Captura de errores no manejados en este router ────────────
router.use((err, req, res, next) => {
  console.error('[escuelas]', err.message);
  res.status(500).json({ ok: false, msg: err.message || 'Error interno' });
});

module.exports = router;
