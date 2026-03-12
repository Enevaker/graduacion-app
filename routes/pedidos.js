// routes/pedidos.js — CRUD de pedidos + export Excel + WhatsApp link

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/database');
const XLSX    = require('xlsx');
const { authMiddleware, adminOnly, adminOrColabOnly } = require('../middleware/auth');
const { notificarAdmin, confirmarCliente } = require('../middleware/mailer');

// ── Generar código único ──────────────────────────────────────
function generarCodigo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PED-${yy}${mm}${dd}-${rand}`;
}

// ── POST /api/pedidos — Crear pedido ─────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { alumnos = [], ...datos } = req.body;

    if (!alumnos.length)
      return res.status(400).json({ ok: false, msg: 'Agrega al menos un alumno' });
    if (alumnos.length > 30)
      return res.status(400).json({ ok: false, msg: 'Máximo 30 alumnos' });

    const ninas = alumnos.filter(a => a.tipo === 'niña').length;
    const ninos = alumnos.filter(a => a.tipo === 'niño').length;
    const codigo = generarCodigo();

    const insertPedido = db.prepare(`
      INSERT INTO pedidos (
        codigo, usuario_id, grupo_id, ciudad, fecha_pedido, grado,
        contacto, colegio, telefono, email,
        calceta, zapato_nina, monos, zapato_nino, pantalon, escudos,
        fecha_entrega, tipo_entrega,
        destinatario, tel_envio, cp, colonia, direccion, email_envio,
        total_alumnos, total_ninas, total_ninos, notas
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
    `);

    const insertAlumno = db.prepare(`
      INSERT INTO alumnos (pedido_id, nombre, tipo, pelo, orden)
      VALUES (?,?,?,?,?)
    `);

    // Transacción atómica
    const transaction = db.transaction(() => {
      const r = insertPedido.run(
        codigo, req.user.id, datos.grupo_id || null,
        datos.ciudad||'', datos.fecha_pedido||'', datos.grado||'',
        datos.contacto||'', datos.colegio||'', datos.telefono||'', datos.email||'',
        datos.calceta||'', datos.zapato_nina||'', datos.monos||'',
        datos.zapato_nino||'', datos.pantalon||'', parseInt(datos.escudos)||0,
        datos.fecha_entrega||'', datos.tipo_entrega||'',
        datos.destinatario||'', datos.tel_envio||'', datos.cp||'',
        datos.colonia||'', datos.direccion||'', datos.email_envio||'',
        alumnos.length, ninas, ninos, datos.notas||''
      );
      const pedidoId = r.lastInsertRowid;
      alumnos.forEach((a, i) => insertAlumno.run(pedidoId, a.nombre, a.tipo, a.pelo||'', i));
      return pedidoId;
    });

    const pedidoId = transaction();
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const alumnosBD = db.prepare('SELECT * FROM alumnos WHERE pedido_id = ? ORDER BY orden').all(pedidoId);

    // Notificaciones (no bloquean la respuesta)
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
    notificarAdmin(pedido, alumnosBD).catch(e => console.error('Mail admin error:', e));
    confirmarCliente(usuario, pedido).catch(e => console.error('Mail cliente error:', e));

    // Link de WhatsApp para el admin
    const waMsg = encodeURIComponent(
      `🎓 *Nuevo pedido ${codigo}*\n` +
      `📋 *Colegio:* ${pedido.colegio}\n` +
      `👤 *Contacto:* ${pedido.contacto}\n` +
      `📱 *Tel:* ${pedido.telefono}\n` +
      `👶 *Alumnos:* ${alumnos.length} (${ninas} niñas, ${ninos} niños)\n` +
      `📅 *Entrega:* ${pedido.fecha_entrega}\n` +
      `🏫 *Grado:* ${pedido.grado}`
    );
    const adminWa = process.env.ADMIN_WHATSAPP || '';
    const waLink = adminWa ? `https://wa.me/${adminWa}?text=${waMsg}` : null;

    res.json({ ok: true, msg: 'Pedido creado', pedido, codigo, waLink });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al guardar pedido' });
  }
});

// ── GET /api/pedidos — Listar (cliente: los suyos; admin: todos) ──
router.get('/', authMiddleware, (req, res) => {
  try {
    const peloSub = `(SELECT GROUP_CONCAT(DISTINCT a.pelo) FROM alumnos a WHERE a.pedido_id = p.id AND a.tipo = 'niño' AND a.pelo != '') as pelos_ninos`;
    let pedidos;
    if (['admin', 'colaborador'].includes(req.user.rol)) {
      pedidos = db.prepare(`
        SELECT p.*, u.nombre as usuario_nombre, u.email as usuario_email, ${peloSub}
        FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.creado_en DESC
      `).all();
    } else {
      pedidos = db.prepare(`
        SELECT p.*, ${peloSub}
        FROM pedidos p WHERE p.usuario_id = ?
        ORDER BY p.creado_en DESC
      `).all(req.user.id);
    }
    res.json({ ok: true, pedidos });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error al obtener pedidos' });
  }
});

// ── GET /api/pedidos/stats — Conteos de alumnos propios ──────
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const isAdmin = ['admin', 'colaborador'].includes(req.user.rol);
    const rows = isAdmin
      ? db.prepare(`
          SELECT a.pelo, a.tipo, COUNT(*) as total
          FROM alumnos a JOIN pedidos p ON p.id = a.pedido_id
          GROUP BY a.pelo, a.tipo
        `).all()
      : db.prepare(`
          SELECT a.pelo, a.tipo, COUNT(*) as total
          FROM alumnos a JOIN pedidos p ON p.id = a.pedido_id
          WHERE p.usuario_id = ?
          GROUP BY a.pelo, a.tipo
        `).all(req.user.id);

    const por_pelo = {};
    const por_tipo = { niña: 0, niño: 0 };
    for (const r of rows) {
      if (r.pelo) por_pelo[r.pelo] = (por_pelo[r.pelo] || 0) + r.total;
      if (r.tipo === 'niña' || r.tipo === 'niño') por_tipo[r.tipo] += r.total;
    }
    res.json({ ok: true, por_pelo, por_tipo });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error al obtener estadísticas' });
  }
});

// ── GET /api/pedidos/dashboard-stats — Conteos completos para admin ──
router.get('/dashboard-stats', authMiddleware, (req, res) => {
  if (!['admin', 'colaborador'].includes(req.user.rol))
    return res.status(403).json({ ok: false, msg: 'Acceso denegado' });
  try {
    const pelo_ninas = db.prepare(`
      SELECT a.pelo as color, COUNT(*) as total
      FROM alumnos a JOIN pedidos p ON p.id = a.pedido_id
      WHERE a.tipo = 'niña' AND a.pelo != '' AND a.pelo IS NOT NULL
      GROUP BY a.pelo ORDER BY total DESC
    `).all();
    const pelo_ninos = db.prepare(`
      SELECT a.pelo as color, COUNT(*) as total
      FROM alumnos a JOIN pedidos p ON p.id = a.pedido_id
      WHERE a.tipo = 'niño' AND a.pelo != '' AND a.pelo IS NOT NULL
      GROUP BY a.pelo ORDER BY total DESC
    `).all();
    const zapato_nina = db.prepare(`
      SELECT zapato_nina as color, SUM(total_ninas) as total
      FROM pedidos WHERE zapato_nina IS NOT NULL AND zapato_nina != ''
      GROUP BY zapato_nina ORDER BY total DESC
    `).all();
    const zapato_nino = db.prepare(`
      SELECT zapato_nino as color, SUM(total_ninos) as total
      FROM pedidos WHERE zapato_nino IS NOT NULL AND zapato_nino != ''
      GROUP BY zapato_nino ORDER BY total DESC
    `).all();
    const calceta = db.prepare(`
      SELECT calceta as color, SUM(total_alumnos) as total
      FROM pedidos WHERE calceta IS NOT NULL AND calceta != ''
      GROUP BY calceta ORDER BY total DESC
    `).all();
    const monos = db.prepare(`
      SELECT monos as color, SUM(total_ninas) as total
      FROM pedidos WHERE monos IS NOT NULL AND monos != ''
      GROUP BY monos ORDER BY total DESC
    `).all();
    const pantalon = db.prepare(`
      SELECT pantalon as color, SUM(total_ninos) as total
      FROM pedidos WHERE pantalon IS NOT NULL AND pantalon != ''
      GROUP BY pantalon ORDER BY total DESC
    `).all();
    const totals = db.prepare(`
      SELECT COUNT(*) as pedidos,
             SUM(total_alumnos) as alumnos,
             SUM(total_ninas)   as ninas,
             SUM(total_ninos)   as ninos
      FROM pedidos WHERE estado != 'cancelado'
    `).get();
    res.json({ ok: true, pelo_ninas, pelo_ninos, zapato_nina, zapato_nino, calceta, monos, pantalon, totals });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /api/pedidos/caracteristicas — Para filtro de muñecos ─
router.get('/caracteristicas', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const pedidos = db.prepare(`
      SELECT p.id, p.codigo, p.colegio, p.contacto,
             p.total_alumnos, p.total_ninas, p.total_ninos,
             p.calceta, p.zapato_nina, p.monos, p.zapato_nino, p.pantalon,
             p.estado, p.fecha_entrega,
             (SELECT GROUP_CONCAT(DISTINCT a.pelo)
              FROM alumnos a WHERE a.pedido_id = p.id AND a.tipo = 'niña' AND a.pelo != ''
             ) as pelos_ninas,
             (SELECT GROUP_CONCAT(DISTINCT a.pelo)
              FROM alumnos a WHERE a.pedido_id = p.id AND a.tipo = 'niño' AND a.pelo != ''
             ) as pelos_ninos
      FROM pedidos p ORDER BY p.colegio ASC
    `).all();
    res.json({ ok: true, pedidos });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /api/pedidos/finanzas/resumen — Resumen financiero ───
router.get('/finanzas/resumen', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const pedidos = db.prepare(`
      SELECT p.id, p.codigo, p.colegio, p.contacto, p.ciudad,
             p.total_alumnos, p.descuento, p.estado, p.fecha_entrega, p.creado_en
      FROM pedidos p
      ORDER BY p.creado_en DESC
    `).all();
    const getPagos = db.prepare(
      'SELECT * FROM pagos WHERE pedido_id = ? ORDER BY fecha DESC, creado_en DESC'
    );
    const result = pedidos.map(p => ({ ...p, pagos: getPagos.all(p.id) }));
    res.json({ ok: true, pedidos: result });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── DELETE /api/pedidos/pagos/:id — Eliminar pago ────────────
router.delete('/pagos/:id', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM pagos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /api/pedidos/:id — Detalle ───────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, msg: 'Pedido no encontrado' });
    if (!['admin', 'colaborador'].includes(req.user.rol) && pedido.usuario_id !== req.user.id)
      return res.status(403).json({ ok: false, msg: 'Acceso denegado' });

    const alumnos = db.prepare(
      'SELECT * FROM alumnos WHERE pedido_id = ? ORDER BY tipo, orden'
    ).all(pedido.id);
    res.json({ ok: true, pedido, alumnos });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error al obtener pedido' });
  }
});

// ── PUT /api/pedidos/:id/estado — Solo admin cambia estado ───
router.put('/:id/estado', authMiddleware, adminOrColabOnly, (req, res) => {
  const { estado } = req.body;
  const estados = [
    // Estados nuevos
    'iniciando','consiguiendo_tela','tela_conseguida','cortando_tela',
    'bordando','cosiendo','rellenando','vistiendo',
    'sesion_fotos','empacando','terminado','enviado',
    // Compatibilidad con estados anteriores
    'recibido','buscando_tela','haciendo_uniformes','empaquetando',
    'listos','en_paqueteria','entregado',
    'pendiente','en_proceso','listo','cancelado',
  ];
  if (!estados.includes(estado))
    return res.status(400).json({ ok: false, msg: 'Estado no válido' });
  db.prepare("UPDATE pedidos SET estado=?, actualizado_en=datetime('now') WHERE id=?")
    .run(estado, req.params.id);
  res.json({ ok: true, msg: 'Estado actualizado' });
});

// ── GET /api/pedidos/:id/excel — Exportar Excel ───────────────
router.get('/:id/excel', authMiddleware, (req, res) => {
  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, msg: 'No encontrado' });
    if (!['admin', 'colaborador'].includes(req.user.rol) && pedido.usuario_id !== req.user.id)
      return res.status(403).json({ ok: false, msg: 'Acceso denegado' });

    const alumnos = db.prepare('SELECT * FROM alumnos WHERE pedido_id = ? ORDER BY tipo, orden').all(pedido.id);
    const wb = XLSX.utils.book_new();

    const info = [
      ['MUÑECOS DE GRADUACIÓN — PEDIDO', pedido.codigo],
      ['Estado', pedido.estado.toUpperCase()],
      ['Fecha creación', pedido.creado_en],
      [],
      ['DATOS GENERALES'],
      ['Ciudad', pedido.ciudad], ['Fecha pedido', pedido.fecha_pedido], ['Grado', pedido.grado],
      [],
      ['CLIENTE / ESCUELA'],
      ['Contacto', pedido.contacto], ['Colegio', pedido.colegio],
      ['Teléfono', pedido.telefono], ['Email', pedido.email],
      [],
      ['UNIFORME'],
      ['Calceta niñas', pedido.calceta], ['Zapato niñas', pedido.zapato_nina],
      ['Moños', pedido.monos], ['Zapato niño', pedido.zapato_nino],
      ['Pantalón', pedido.pantalon], ['Escudos bordado', pedido.escudos],
      [],
      ['ENTREGA'],
      ['Fecha entrega', pedido.fecha_entrega],
      ['Tipo', pedido.tipo_entrega === 'domicilio' ? 'Envío a domicilio' : 'Ocurre (paquetería)'],
    ];
    if (pedido.tipo_entrega === 'domicilio') {
      info.push([], ['DATOS DE ENVÍO'],
        ['Destinatario', pedido.destinatario], ['Teléfono', pedido.tel_envio],
        ['C.P.', pedido.cp], ['Colonia', pedido.colonia],
        ['Dirección', pedido.direccion], ['Email envío', pedido.email_envio]);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(info);
    ws1['!cols'] = [{ wch: 22 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Información');

    const ninas = alumnos.filter(a => a.tipo === 'niña');
    const ninos = alumnos.filter(a => a.tipo === 'niño');
    const maxRows = Math.max(ninas.length, ninos.length);
    const alumData = [['#','NOMBRE NIÑA','PELO NIÑA','','#','NOMBRE NIÑO','PELO NIÑO']];
    for (let i = 0; i < maxRows; i++) {
      const n = ninas[i]; const m = ninos[i];
      alumData.push([
        n ? i+1 : '', n ? n.nombre : '', n ? n.pelo : '', '',
        m ? i+1 : '', m ? m.nombre : '', m ? m.pelo : '',
      ]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(alumData);
    ws2['!cols'] = [{wch:4},{wch:18},{wch:12},{wch:2},{wch:4},{wch:18},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Alumnos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=pedido-${pedido.codigo}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al exportar' });
  }
});

// ── GET /api/pedidos/admin/excel-todos — Todos los pedidos ───
router.get('/admin/excel-todos', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const pedidos = db.prepare(`
      SELECT p.*, u.nombre as u_nombre FROM pedidos p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      ORDER BY p.creado_en DESC
    `).all();

    const rows = [['Código','Estado','Colegio','Contacto','Tel','Ciudad','Grado',
                   'Alumnos','Niñas','Niños','Escudos','Entrega','Tipo','Creado']];
    pedidos.forEach(p => rows.push([
      p.codigo, p.estado, p.colegio, p.contacto, p.telefono,
      p.ciudad, p.grado, p.total_alumnos, p.total_ninas, p.total_ninos,
      p.escudos, p.fecha_entrega, p.tipo_entrega, p.creado_en
    ]));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Todos los pedidos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=todos-pedidos.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error al exportar' });
  }
});

// ── POST /api/pedidos/:id/pagos — Agregar pago ───────────────
router.post('/:id/pagos', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const { monto, tipo = 'anticipo', fecha, notas = '' } = req.body;
    if (!monto || isNaN(monto) || parseFloat(monto) <= 0)
      return res.status(400).json({ ok: false, msg: 'Monto inválido' });
    const ins = db.prepare(`
      INSERT INTO pagos (pedido_id, monto, tipo, fecha, notas)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, parseFloat(monto), tipo,
           fecha || new Date().toISOString().slice(0, 10), notas);
    const pago = db.prepare('SELECT * FROM pagos WHERE id = ?').get(ins.lastInsertRowid);
    res.json({ ok: true, pago });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /api/pedidos/:id — Editar pedido completo ────────────
router.put('/:id', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, msg: 'Pedido no encontrado' });

    const {
      colegio, contacto, telefono, email, ciudad, grado,
      fecha_entrega, notas,
      calceta, zapato_nina, monos, zapato_nino, pantalon, escudos,
      tipo_entrega, destinatario, tel_envio, cp, colonia, direccion, email_envio,
    } = req.body;

    db.prepare(`
      UPDATE pedidos SET
        colegio=?, contacto=?, telefono=?, email=?, ciudad=?, grado=?,
        fecha_entrega=?, notas=?,
        calceta=?, zapato_nina=?, monos=?, zapato_nino=?, pantalon=?, escudos=?,
        tipo_entrega=?, destinatario=?, tel_envio=?, cp=?, colonia=?, direccion=?, email_envio=?,
        actualizado_en=datetime('now')
      WHERE id=?
    `).run(
      colegio    ?? pedido.colegio,
      contacto   ?? pedido.contacto,
      telefono   ?? pedido.telefono,
      email      ?? pedido.email,
      ciudad     ?? pedido.ciudad,
      grado      ?? pedido.grado,
      fecha_entrega ?? pedido.fecha_entrega,
      notas      ?? pedido.notas,
      calceta    ?? pedido.calceta,
      zapato_nina ?? pedido.zapato_nina,
      monos      ?? pedido.monos,
      zapato_nino ?? pedido.zapato_nino,
      pantalon   ?? pedido.pantalon,
      escudos    ?? pedido.escudos,
      tipo_entrega ?? pedido.tipo_entrega,
      destinatario ?? pedido.destinatario,
      tel_envio  ?? pedido.tel_envio,
      cp         ?? pedido.cp,
      colonia    ?? pedido.colonia,
      direccion  ?? pedido.direccion,
      email_envio ?? pedido.email_envio,
      req.params.id,
    );

    const updated = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    res.json({ ok: true, msg: 'Pedido actualizado', pedido: updated });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── DELETE /api/pedidos/:id — Eliminar pedido ─────────────────
function tryUnlinkPedido(filepath) {
  try { fs.unlinkSync(filepath); } catch {}
}

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, msg: 'Pedido no encontrado' });

    // Limpiar archivos de avances
    const avances = db.prepare('SELECT filename FROM pedido_avances WHERE pedido_id = ?').all(req.params.id);
    avances.forEach(a => {
      if (a.filename) tryUnlinkPedido(path.join(__dirname, '..', 'public', 'uploads', 'avances', a.filename));
    });

    // Cascade delete
    db.prepare('DELETE FROM alumnos       WHERE pedido_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pagos         WHERE pedido_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pedido_avances WHERE pedido_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pedidos        WHERE id = ?').run(req.params.id);

    res.json({ ok: true, msg: 'Pedido eliminado' });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /api/pedidos/:id/descuento — Actualizar descuento ────
router.put('/:id/descuento', authMiddleware, adminOrColabOnly, (req, res) => {
  try {
    const pct = Math.max(0, Math.min(100, parseInt(req.body.descuento) || 0));
    db.prepare("UPDATE pedidos SET descuento=?, actualizado_en=datetime('now') WHERE id=?")
      .run(pct, req.params.id);
    res.json({ ok: true, descuento: pct });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
