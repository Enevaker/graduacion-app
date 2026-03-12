// routes/usuarios.js — CRUD de usuarios (solo admin)

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ── GET /api/usuarios — listar todos ─────────────────────────
router.get('/', authMiddleware, adminOnly, (req, res) => {
  const usuarios = db.prepare(`
    SELECT id, nombre, email, telefono, ciudad, colegio, rol, activo, creado_en,
           estado, colonia, cp, direccion, referencias
    FROM usuarios ORDER BY creado_en DESC
  `).all();
  res.json({ ok: true, usuarios });
});

// ── POST /api/usuarios — crear ────────────────────────────────
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nombre, email, password, telefono, ciudad, colegio, rol } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ ok: false, msg: 'Nombre, correo y contraseña son requeridos' });
    if (password.length < 6)
      return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres' });

    const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase());
    if (existe) return res.status(409).json({ ok: false, msg: 'Este correo ya está registrado' });

    const rolesValidos = ['cliente', 'admin', 'colaborador'];
    if (rol && !rolesValidos.includes(rol))
      return res.status(400).json({ ok: false, msg: 'Rol no válido' });

    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(`
      INSERT INTO usuarios (nombre, email, password, telefono, ciudad, colegio, rol)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nombre, email.toLowerCase(), hash, telefono||'', ciudad||'', colegio||'', rol||'cliente');

    const usuario = db.prepare(`
      SELECT id, nombre, email, telefono, ciudad, colegio, rol, activo, creado_en
      FROM usuarios WHERE id = ?
    `).get(info.lastInsertRowid);

    res.json({ ok: true, msg: 'Usuario creado', usuario });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al crear usuario' });
  }
});

// ── PUT /api/usuarios/:id — actualizar ────────────────────────
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    const { nombre, email, password, telefono, ciudad, colegio, rol, activo,
            estado, colonia, cp, direccion, referencias } = req.body;

    // Verificar correo único
    if (email && email.toLowerCase() !== user.email) {
      const existe = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email.toLowerCase(), id);
      if (existe) return res.status(409).json({ ok: false, msg: 'Este correo ya está en uso' });
    }

    let hash = user.password;
    if (password) {
      if (password.length < 6)
        return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres' });
      hash = await bcrypt.hash(password, 10);
    }

    db.prepare(`
      UPDATE usuarios
      SET nombre=?, email=?, telefono=?, ciudad=?, colegio=?, rol=?, password=?, activo=?,
          estado=?, colonia=?, cp=?, direccion=?, referencias=?
      WHERE id=?
    `).run(
      nombre   ?? user.nombre,
      (email   ?? user.email).toLowerCase(),
      telefono ?? user.telefono,
      ciudad   ?? user.ciudad,
      colegio  ?? user.colegio,
      rol      ?? user.rol,
      hash,
      activo !== undefined ? (activo ? 1 : 0) : user.activo,
      estado     !== undefined ? estado     : user.estado,
      colonia    !== undefined ? colonia    : user.colonia,
      cp         !== undefined ? cp         : user.cp,
      direccion  !== undefined ? direccion  : user.direccion,
      referencias !== undefined ? referencias : user.referencias,
      id
    );

    const updated = db.prepare(`
      SELECT id, nombre, email, telefono, ciudad, colegio, rol, activo, creado_en,
             estado, colonia, cp, direccion, referencias
      FROM usuarios WHERE id = ?
    `).get(id);
    res.json({ ok: true, msg: 'Usuario actualizado', usuario: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al actualizar usuario' });
  }
});

// ── DELETE /api/usuarios/:id — eliminar ───────────────────────
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const id = Number(req.params.id);

  // No puede eliminarse a sí mismo
  if (id === req.user.id)
    return res.status(400).json({ ok: false, msg: 'No puedes eliminarte a ti mismo' });

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

  // No eliminar el último admin
  if (user.rol === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) as c FROM usuarios WHERE rol = 'admin'").get();
    if (admins.c <= 1)
      return res.status(400).json({ ok: false, msg: 'No puedes eliminar el único administrador' });
  }

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  res.json({ ok: true, msg: 'Usuario eliminado' });
});

module.exports = router;
