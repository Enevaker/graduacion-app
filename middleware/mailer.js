// middleware/mailer.js — Envío de correos con Nodemailer

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ── Correo al ADMIN cuando llega un pedido nuevo ─────────────
async function notificarAdmin(pedido, alumnos) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !process.env.MAIL_USER) return;

  const ninas = alumnos.filter(a => a.tipo === 'niña');
  const ninos = alumnos.filter(a => a.tipo === 'niño');

  const listaHTML = (lista) => lista.map((a, i) =>
    `<tr><td style="padding:4px 10px;border-bottom:1px solid #eee">${i+1}</td>
     <td style="padding:4px 10px;border-bottom:1px solid #eee">${a.nombre}</td>
     <td style="padding:4px 10px;border-bottom:1px solid #eee">${a.pelo||'—'}</td></tr>`
  ).join('');

  const html = `
  <div style="font-family:sans-serif;max-width:620px;margin:0 auto">
    <div style="background:#1a2744;padding:24px;border-radius:12px 12px 0 0">
      <h1 style="color:white;margin:0;font-size:20px">🎓 Nuevo Pedido Recibido</h1>
      <p style="color:#aab;margin:4px 0 0">Código: <strong style="color:#e8607a">${pedido.codigo}</strong></p>
    </div>
    <div style="background:#f9f9f9;padding:24px;border:1px solid #eee">
      <h3 style="color:#1a2744;margin-top:0">📋 Datos del pedido</h3>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#888;padding:4px 0;width:140px">Cliente</td><td><strong>${pedido.contacto}</strong></td></tr>
        <tr><td style="color:#888;padding:4px 0">Colegio</td><td>${pedido.colegio}</td></tr>
        <tr><td style="color:#888;padding:4px 0">Ciudad</td><td>${pedido.ciudad}</td></tr>
        <tr><td style="color:#888;padding:4px 0">Grado</td><td>${pedido.grado}</td></tr>
        <tr><td style="color:#888;padding:4px 0">Teléfono</td><td>${pedido.telefono}</td></tr>
        <tr><td style="color:#888;padding:4px 0">Entrega</td><td>${pedido.fecha_entrega} — ${pedido.tipo_entrega}</td></tr>
        <tr><td style="color:#888;padding:4px 0">Escudos bordado</td><td>${pedido.escudos}</td></tr>
      </table>

      <div style="display:flex;gap:16px;margin-top:20px">
        <div style="flex:1;background:#fce8ec;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:28px;font-weight:bold;color:#e8607a">${ninas.length}</div>
          <div style="color:#c94e68;font-size:12px">👧 Niñas</div>
        </div>
        <div style="flex:1;background:#e8edf8;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:28px;font-weight:bold;color:#1a2744">${ninos.length}</div>
          <div style="color:#1a2744;font-size:12px">👦 Niños</div>
        </div>
        <div style="flex:1;background:#f5e9c8;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:28px;font-weight:bold;color:#c9a84c">${alumnos.length}</div>
          <div style="color:#b8923c;font-size:12px">Total</div>
        </div>
      </div>

      ${ninas.length > 0 ? `
      <h3 style="color:#e8607a;margin-top:20px">👧 Niñas</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#1a2744;color:white">
          <th style="padding:6px 10px">#</th><th style="padding:6px 10px">Nombre</th><th style="padding:6px 10px">Pelo</th>
        </tr></thead><tbody>${listaHTML(ninas)}</tbody>
      </table>` : ''}

      ${ninos.length > 0 ? `
      <h3 style="color:#1a2744;margin-top:20px">👦 Niños</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#1a2744;color:white">
          <th style="padding:6px 10px">#</th><th style="padding:6px 10px">Nombre</th><th style="padding:6px 10px">Pelo</th>
        </tr></thead><tbody>${listaHTML(ninos)}</tbody>
      </table>` : ''}

      ${pedido.tipo_entrega === 'domicilio' ? `
      <h3 style="color:#1a2744;margin-top:20px">🚚 Datos de envío</h3>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#888;padding:4px 0;width:140px">Destinatario</td><td>${pedido.destinatario}</td></tr>
        <tr><td style="color:#888;padding:4px 0">Teléfono</td><td>${pedido.tel_envio}</td></tr>
        <tr><td style="color:#888;padding:4px 0">Dirección</td><td>${pedido.direccion}, Col. ${pedido.colonia}, C.P. ${pedido.cp}</td></tr>
      </table>` : ''}
    </div>
    <div style="background:#1a2744;padding:12px 24px;border-radius:0 0 12px 12px;text-align:center">
      <p style="color:#aab;margin:0;font-size:12px">Sistema de Pedidos — Muñecos de Graduación 2026</p>
    </div>
  </div>`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: adminEmail,
    subject: `🎓 Nuevo pedido ${pedido.codigo} — ${pedido.colegio} (${alumnos.length} alumnos)`,
    html,
  });
}

// ── Correo de confirmación al CLIENTE ────────────────────────
async function confirmarCliente(usuario, pedido) {
  if (!usuario.email || !process.env.MAIL_USER) return;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: usuario.email,
    subject: `✅ Tu pedido ${pedido.codigo} fue recibido`,
    html: `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#1a2744;padding:24px;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">✅ Pedido confirmado</h1>
      </div>
      <div style="padding:24px;border:1px solid #eee;background:#fafafa">
        <p>Hola <strong>${usuario.nombre}</strong>,</p>
        <p>Tu pedido ha sido recibido exitosamente. En breve nos pondremos en contacto contigo.</p>
        <div style="background:#e8edf8;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#888;font-size:12px">CÓDIGO DE PEDIDO</p>
          <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#1a2744">${pedido.codigo}</p>
        </div>
        <table style="width:100%;font-size:14px">
          <tr><td style="color:#888;padding:3px 0;width:130px">Colegio</td><td>${pedido.colegio}</td></tr>
          <tr><td style="color:#888;padding:3px 0">Alumnos</td><td>${pedido.total_alumnos} (${pedido.total_ninas} niñas, ${pedido.total_ninos} niños)</td></tr>
          <tr><td style="color:#888;padding:3px 0">Fecha entrega</td><td>${pedido.fecha_entrega}</td></tr>
        </table>
        <p style="margin-top:20px;color:#888;font-size:13px">Guarda este código para dar seguimiento a tu pedido.</p>
      </div>
      <div style="background:#1a2744;padding:12px 24px;border-radius:0 0 12px 12px;text-align:center">
        <p style="color:#aab;margin:0;font-size:12px">Muñecos de Graduación 2026</p>
      </div>
    </div>`,
  });
}

module.exports = { notificarAdmin, confirmarCliente };
