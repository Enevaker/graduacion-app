// public/js/escuelas.js — "Mi Escuela" (cliente) / "Escuelas" (admin)

// ── Progreso según estado ─────────────────────────────────────
const ESTADO_PCT = {
  iniciando:         8,
  consiguiendo_tela: 18,
  tela_conseguida:   27,
  cortando_tela:     36,
  bordando:          45,
  cosiendo:          55,
  rellenando:        64,
  vistiendo:         73,
  sesion_fotos:      82,
  empacando:         90,
  terminado:         97,
  enviado:           100,
  // legacy
  recibido:           5,
  pendiente:          5,
  buscando_tela:     18,
  haciendo_uniformes:55,
  empaquetando:      90,
  listos:            97,
  en_paqueteria:     97,
  entregado:        100,
  en_proceso:        40,
  listo:             97,
  cancelado:          0,
};

function estadoPct(estado) {
  return ESTADO_PCT[estado] ?? 5;
}

// ── Estado local ──────────────────────────────────────────────
let _escImagenes = [];
let _escAvances  = [];

// ── Render principal ──────────────────────────────────────────
async function renderEscuelas(containerId = 'escuelasContenido') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const isAdmin = ['admin', 'colaborador'].includes(window.currentUser?.rol);
  el.innerHTML = '<div class="loading-state">Cargando escuelas…</div>';

  const [rPed, rExtra, rGrupos] = await Promise.all([
    API.get('/api/pedidos'),
    isAdmin ? API.get('/api/escuelas/data') : Promise.resolve({ ok: true, avances: [] }),
    isAdmin ? API.get('/api/grupos') : Promise.resolve({ ok: true, grupos: [] }),
  ]);

  if (!rPed.ok) {
    el.innerHTML = '<div class="empty-state">Error al cargar los datos.</div>';
    return;
  }

  const pedidos  = rPed.pedidos || [];
  _escImagenes   = (isAdmin && rExtra.ok) ? (rExtra.imagenes || []) : [];
  _escAvances    = rExtra.ok ? (rExtra.avances || []) : [];
  const grupos   = (isAdmin && rGrupos.ok) ? (rGrupos.grupos || []) : [];

  if (!pedidos.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:48px">
        <div style="font-size:3rem;margin-bottom:12px">🏫</div>
        <p>${isAdmin ? 'No hay pedidos registrados.' : 'Aún no tienes escuelas registradas.'}</p>
        ${!isAdmin ? '<button class="btn btn-primary btn-sm" style="margin-top:18px" onclick="goTo(\'nuevo\')">➕ Nuevo pedido</button>' : ''}
      </div>`;
    return;
  }

  // Agrupar por colegio
  const map = {};
  for (const p of pedidos) {
    const k = (p.colegio || 'Sin nombre').trim();
    if (!map[k]) map[k] = {
      nombre: k, contacto: p.contacto||'', telefono: p.telefono||'',
      email: p.email||'', ciudad: p.ciudad||'', pedidos: [],
      _envio: extraerEnvio(p),
    };
    else if (!map[k]._envio.direccion && p.direccion) map[k]._envio = extraerEnvio(p);
    map[k].pedidos.push(p);
  }
  const escuelas     = Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const totalAlumnos = pedidos.reduce((s, p) => s + (p.total_alumnos || 0), 0);

  const resHTML = `
    <div class="esc-resumen">
      <div class="esc-resumen-item"><span class="esc-num">${escuelas.length}</span><span class="esc-lbl">Escuela${escuelas.length !== 1 ? 's' : ''}</span></div>
      <div class="esc-resumen-item"><span class="esc-num">${pedidos.length}</span><span class="esc-lbl">Pedido${pedidos.length !== 1 ? 's' : ''}</span></div>
      <div class="esc-resumen-item"><span class="esc-num">${totalAlumnos}</span><span class="esc-lbl">Alumnos totales</span></div>
    </div>`;

  const cards = isAdmin
    ? escuelas.map((e, i) => escuelaCardHTML(e, true, i, grupos)).join('')
    : escuelas.map(e => escuelaClientCardHTML(e)).join('');
  el.innerHTML = resHTML + `<div class="esc-grid">${cards}</div>`;
}

// ── Card de escuela ───────────────────────────────────────────
function escuelaCardHTML(escuela, isAdmin, idx, grupos = []) {
  const totalAlumnos = escuela.pedidos.reduce((s, p) => s + (p.total_alumnos || 0), 0);
  const totalNinas   = escuela.pedidos.reduce((s, p) => s + (p.total_ninas   || 0), 0);
  const totalNinos   = escuela.pedidos.reduce((s, p) => s + (p.total_ninos   || 0), 0);

  const imgSection = isAdmin ? adminImgSectionHTML(escuela.nombre) : '';

  // Agrupar pedidos por grupo_id
  let pedidosSection = '';
  if (isAdmin && grupos.length) {
    // Grupos que pertenecen a esta escuela (por nombre de colegio)
    const gruposEsc = grupos.filter(g => g.colegio?.trim() === escuela.nombre);
    const grupoMap  = Object.fromEntries(gruposEsc.map(g => [g.id, g]));

    const pedConGrupo    = escuela.pedidos.filter(p => p.grupo_id && grupoMap[p.grupo_id]);
    const pedSinGrupo    = escuela.pedidos.filter(p => !p.grupo_id || !grupoMap[p.grupo_id]);

    // Agrupar por grupo_id
    const byGrupo = {};
    for (const p of pedConGrupo) {
      if (!byGrupo[p.grupo_id]) byGrupo[p.grupo_id] = [];
      byGrupo[p.grupo_id].push(p);
    }

    const gruposHTML = Object.entries(byGrupo).map(([gid, peds]) => {
      const g = grupoMap[gid];
      return `
        <div class="esc-grupo-section">
          <div class="esc-grupo-header">📁 ${esc(g.nombre)} <span style="color:var(--g400);font-size:.78rem">(${peds.length} pedido${peds.length !== 1 ? 's' : ''})</span></div>
          ${peds.map(p => pedidoRowHTML(p, false)).join('')}
        </div>`;
    }).join('');

    const sinGrupoHTML = pedSinGrupo.length ? `
      <div class="esc-grupo-section">
        <div class="esc-grupo-header">📋 Sin grupo <span style="color:var(--g400);font-size:.78rem">(${pedSinGrupo.length})</span></div>
        ${pedSinGrupo.map(p => pedidoRowHTML(p, false)).join('')}
      </div>` : '';

    pedidosSection = `<div class="esc-pedidos-section">${gruposHTML}${sinGrupoHTML}</div>`;
  } else {
    pedidosSection = `
      <div class="esc-pedidos-section">
        <div class="esc-section-title">📋 Pedidos</div>
        ${escuela.pedidos.map(p => pedidoRowHTML(p, isAdmin)).join('')}
      </div>`;
  }

  return `
    <div class="esc-card">
      <div class="esc-card-header">
        <div class="esc-icon">🏫</div>
        <div class="esc-card-info">
          <h3 class="esc-nombre">${esc(escuela.nombre)}</h3>
          <p class="esc-ciudad">${esc(escuela.ciudad)}</p>
        </div>
        <div class="esc-badge-count">${escuela.pedidos.length} pedido${escuela.pedidos.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="esc-contact-row">
        ${escuela.contacto ? `<span class="esc-chip">👤 ${esc(escuela.contacto)}</span>` : ''}
        ${escuela.telefono ? `<span class="esc-chip">📱 ${esc(escuela.telefono)}</span>` : ''}
        ${escuela.email    ? `<span class="esc-chip">✉️ ${esc(escuela.email)}</span>`    : ''}
      </div>
      <div class="esc-alumnos-row">
        <span class="esc-stat-chip">👥 ${totalAlumnos} alumnos</span>
        ${totalNinas ? `<span class="esc-stat-chip niña">👧 ${totalNinas} niñas</span>` : ''}
        ${totalNinos ? `<span class="esc-stat-chip niño">👦 ${totalNinos} niños</span>` : ''}
      </div>
      ${imgSection}
      ${pedidosSection}
    </div>`;
}

// ── Sección imágenes de referencia (solo admin) ───────────────
function adminImgSectionHTML(colegio) {
  const tipos = [
    { key: 'uniforme', label: '👔 Uniformes' },
    { key: 'tela',     label: '🧵 Telas'     },
    { key: 'muneco',   label: '🪆 Muñecos'   },
  ];

  const colegioEnc = encodeURIComponent(colegio).replace(/'/g, '%27');

  const tabsHTML = tipos.map((t, i) => `
    <button class="esc-img-tab${i === 0 ? ' active' : ''}" data-tipo="${t.key}"
      onclick="escTabChange(this,'${t.key}')">${t.label}</button>`).join('');

  const panelsHTML = tipos.map((t, i) => {
    const imgs    = _escImagenes.filter(img => img.colegio === colegio && img.tipo === t.key);
    const imgHTML = imgs.map(img => escImgThumbHTML(img)).join('');
    return `
      <div class="esc-img-panel${i !== 0 ? ' esc-hidden' : ''}" data-tipo="${t.key}">
        <div class="esc-img-grid">${imgHTML}</div>
        <label class="esc-upload-btn">
          ➕ Subir ${t.label.split(' ')[1]}
          <input type="file" accept="image/*" style="display:none"
            onchange="escSubirImagen(this,'${colegioEnc}','${t.key}')">
        </label>
      </div>`;
  }).join('');

  return `
    <div class="esc-imgs-section">
      <div class="esc-section-title">📸 Imágenes de referencia</div>
      <div class="esc-img-tabs">${tabsHTML}</div>
      ${panelsHTML}
    </div>`;
}

function escImgThumbHTML(img) {
  const src = `/uploads/escuelas/${esc(img.filename)}`;
  return `
    <div class="esc-img-thumb-wrap" id="esc-img-${img.id}">
      <img class="esc-img-thumb" src="${src}" alt="${esc(img.descripcion || img.tipo)}"
        onclick="escVerImagen('${src}')">
      ${img.descripcion ? `<p class="esc-img-desc">${esc(img.descripcion)}</p>` : ''}
      <button class="esc-img-del" onclick="escEliminarImagen(${img.id})" title="Eliminar">✕</button>
    </div>`;
}

// ── Fila de pedido ────────────────────────────────────────────
function pedidoRowHTML(p, isAdmin) {
  // ── Progreso basado en el estado del pedido ──
  const porcentaje = estadoPct(p.estado);
  const barColor   = pctColor(porcentaje);
  const estado     = escEstadoLabel(p.estado);
  const colorCfg   = escEstadoColor(p.estado);
  const fecha      = p.fecha_entrega ? fmtFechaEsc(p.fecha_entrega) : '—';

  const pedAvances = _escAvances.filter(a => a.pedido_id === p.id);
  const avancesHTML = pedAvances.map(a => avanceItemHTML(a, false)).join('');
  const hasContent  = pedAvances.length > 0;

  return `
    <div class="esc-pedido-row">
      <div class="esc-pedido-header">
        <span class="esc-pedido-code">${esc(p.codigo)}</span>
        ${p.grado ? `<span class="esc-pedido-grado">📚 ${esc(p.grado)}</span>` : ''}
        <span class="esc-pedido-alumnos">👥 ${p.total_alumnos || 0}</span>
        <span class="esc-pedido-fecha">📅 ${fecha}</span>
        <span class="esc-badge" style="background:${colorCfg.bg};color:${colorCfg.fg}">${estado}</span>
      </div>

      <div class="esc-progreso">
        <div class="esc-pbar-header">
          <span class="esc-pbar-label">📊 Progreso del pedido</span>
          <span class="esc-pbar-pct" style="color:${barColor}">${porcentaje}%</span>
        </div>
        <div class="esc-pbar-track">
          <div class="esc-pbar-fill" style="width:${porcentaje}%;background:${barColor}"></div>
        </div>
        <p class="esc-pbar-estado-hint">${estado}</p>
      </div>

      ${hasContent ? `
      <div class="esc-avances">
        <div class="esc-avances-title">📝 Actualizaciones del equipo</div>
        <div id="esc-avances-list-${p.id}">${avancesHTML}</div>
      </div>` : ''}
    </div>`;
}

function avanceItemHTML(a, isAdmin) {
  const src = a.filename ? `/uploads/avances/${esc(a.filename)}` : null;
  return `
    <div class="esc-avance-item" id="esc-av-${a.id}">
      <div class="esc-avance-meta">
        <span class="esc-avance-fecha">📅 ${fmtFechaEsc(a.creado_en)}</span>
        ${isAdmin ? `<button class="esc-av-del" onclick="escEliminarAvance(${a.id},${a.pedido_id})" title="Eliminar">🗑️</button>` : ''}
      </div>
      ${a.mensaje  ? `<p class="esc-avance-msg">${esc(a.mensaje)}</p>` : ''}
      ${src        ? `<img class="esc-avance-img" src="${src}" onclick="escVerImagen('${src}')">` : ''}
    </div>`;
}

// ── Cambiar tab de imágenes ───────────────────────────────────
function escTabChange(btn, tipo) {
  const section = btn.closest('.esc-imgs-section');
  section.querySelectorAll('.esc-img-panel').forEach(p =>
    p.classList.toggle('esc-hidden', p.dataset.tipo !== tipo));
  section.querySelectorAll('.esc-img-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tipo === tipo));
}

// ── Lightbox ──────────────────────────────────────────────────
function escVerImagen(src) {
  const ov = document.createElement('div');
  ov.className = 'esc-lightbox';
  ov.innerHTML = `
    <div class="esc-lightbox-inner">
      <img src="${src}">
      <button onclick="this.closest('.esc-lightbox').remove()">✕ Cerrar</button>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

// ── Subir imagen de escuela ───────────────────────────────────
async function escSubirImagen(input, colegioEnc, tipo) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const fd   = new FormData();
  fd.append('imagen', file);
  fd.append('tipo', tipo);
  input.value = '';

  showToast('Subiendo imagen…', 'info');
  const r = await subirArchivo(`/api/escuelas/${colegioEnc}/imagenes`, fd);
  if (!r.ok) return showToast(r.msg || 'Error al subir', 'error');

  const img = r.imagen;
  _escImagenes.push(img);

  const panel = input.closest('.esc-img-panel');
  const grid  = panel?.querySelector('.esc-img-grid');
  if (grid) {
    const div = document.createElement('div');
    div.className = 'esc-img-thumb-wrap';
    div.id = `esc-img-${img.id}`;
    const previewSrc = URL.createObjectURL(file);
    const realSrc    = `/uploads/escuelas/${esc(img.filename)}`;
    div.innerHTML = `
      <img class="esc-img-thumb" src="${previewSrc}" onclick="escVerImagen('${realSrc}')">
      <button class="esc-img-del" onclick="escEliminarImagen(${img.id})" title="Eliminar">✕</button>`;
    grid.appendChild(div);
  }
  showToast('Imagen subida ✅', 'success');
}

// ── Eliminar imagen de escuela ────────────────────────────────
async function escEliminarImagen(id) {
  if (!confirm('¿Eliminar esta imagen?')) return;
  const r = await API.delete(`/api/escuelas/imagenes/${id}`);
  if (!r.ok) return showToast(r.msg || 'Error', 'error');
  _escImagenes = _escImagenes.filter(i => i.id !== id);
  document.getElementById(`esc-img-${id}`)?.remove();
  showToast('Imagen eliminada', 'success');
}

// ── Publicar avance de pedido (mensaje + foto opcional) ───────
async function escSubirAvance(pedidoId) {
  const msgEl = document.getElementById(`av-msg-${pedidoId}`);
  const imgEl = document.getElementById(`av-img-${pedidoId}`);
  const msg   = msgEl?.value?.trim() || '';
  const file  = imgEl?.files[0] || null;

  if (!msg && !file) return showToast('Escribe un mensaje o selecciona una foto', 'error');

  const fd = new FormData();
  fd.append('mensaje', msg);
  if (file) fd.append('archivos', file);

  showToast('Publicando avance…', 'info');
  const r = await subirArchivo(`/api/escuelas/pedidos/${pedidoId}/avances`, fd);
  if (!r.ok) return showToast(r.msg || 'Error al publicar avance', 'error');

  const av = (r.avances || [])[0];
  _escAvances.push(av);

  const list = document.getElementById(`esc-avances-list-${pedidoId}`);
  if (list) {
    const avancesDiv = list.closest('.esc-avances');
    if (avancesDiv && !avancesDiv.querySelector('.esc-avances-title')) {
      const title = document.createElement('div');
      title.className = 'esc-avances-title';
      title.textContent = '📝 Avances publicados';
      avancesDiv.insertBefore(title, list);
    }

    const div = document.createElement('div');
    div.className = 'esc-avance-item';
    div.id = `esc-av-${av.id}`;
    const preview = file ? URL.createObjectURL(file) : null;
    const real    = av.filename ? `/uploads/avances/${esc(av.filename)}` : null;
    div.innerHTML = `
      <div class="esc-avance-meta">
        <span class="esc-avance-fecha">📅 ${fmtFechaEsc(new Date().toISOString())}</span>
        <button class="esc-av-del" onclick="escEliminarAvance(${av.id},${pedidoId})" title="Eliminar">🗑️</button>
      </div>
      ${msg     ? `<p class="esc-avance-msg">${esc(msg)}</p>` : ''}
      ${preview ? `<img class="esc-avance-img" src="${preview}" onclick="escVerImagen('${real || preview}')">` : ''}`;
    list.appendChild(div);
  }

  if (msgEl) msgEl.value = '';
  if (imgEl) imgEl.value = '';
  showToast('Avance publicado ✅', 'success');
}

// ── Eliminar avance ───────────────────────────────────────────
async function escEliminarAvance(avanceId, pedidoId) {
  if (!confirm('¿Eliminar este avance?')) return;
  const r = await API.delete(`/api/escuelas/avances/${avanceId}`);
  if (!r.ok) return showToast(r.msg || 'Error', 'error');
  _escAvances = _escAvances.filter(a => a.id !== avanceId);
  document.getElementById(`esc-av-${avanceId}`)?.remove();
  showToast('Avance eliminado', 'success');
}

// ── Subida multipart — devuelve siempre JSON ──────────────────
async function subirArchivo(url, formData) {
  try {
    const res  = await fetch(url, { method: 'POST', body: formData, credentials: 'include' });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error('[subirArchivo] Respuesta no JSON:', res.status, text.slice(0, 300));
      return { ok: false, msg: `Error del servidor (${res.status}) — revisa la consola` };
    }
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ── Helper: extraer datos de envío de un pedido ───────────────
function extraerEnvio(p) {
  return {
    tipo:        p.tipo_entrega || '',
    destinatario:p.destinatario  || '',
    tel_envio:   p.tel_envio     || '',
    cp:          p.cp            || '',
    colonia:     p.colonia       || '',
    direccion:   p.direccion     || '',
    email_envio: p.email_envio   || '',
  };
}

// ── Card de escuela — vista CLIENTE (solo info, sin avances) ──
function escuelaClientCardHTML(e) {
  const initials = e.nombre.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const envio    = e._envio || {};
  const tieneEnvio = envio.tipo === 'domicilio';

  const totalAlumnos = e.pedidos.reduce((s, p) => s + (p.total_alumnos || 0), 0);
  const totalNinas   = e.pedidos.reduce((s, p) => s + (p.total_ninas   || 0), 0);
  const totalNinos   = e.pedidos.reduce((s, p) => s + (p.total_ninos   || 0), 0);

  const ir = (lbl, val) => val
    ? `<div class="esc-info-row"><span class="esc-info-lbl">${lbl}</span><span class="esc-info-val">${esc(val)}</span></div>`
    : '';

  return `
    <div class="esc-card">

      <div class="esc-card-header">
        <div class="esc-logo-placeholder">${initials || '🏫'}</div>
        <div class="esc-card-info">
          <h3 class="esc-nombre">${esc(e.nombre)}</h3>
          <p class="esc-ciudad">${esc(e.ciudad)}</p>
        </div>
      </div>

      <div class="esc-alumnos-row">
        <span class="esc-stat-chip">👥 ${totalAlumnos} alumnos</span>
        ${totalNinas ? `<span class="esc-stat-chip niña">👧 ${totalNinas} niñas</span>` : ''}
        ${totalNinos ? `<span class="esc-stat-chip niño">👦 ${totalNinos} niños</span>` : ''}
      </div>

      <div class="esc-info-section">
        <div class="esc-section-title">👤 Datos de contacto</div>
        <div class="esc-info-grid">
          ${ir('Responsable', e.contacto)}
          ${ir('Teléfono',   e.telefono)}
          ${ir('Email',      e.email)}
          ${ir('Ciudad',     e.ciudad)}
        </div>
      </div>

      <div class="esc-info-section">
        <div class="esc-section-title">📦 Datos de entrega</div>
        <div class="esc-info-grid">
          <div class="esc-info-row">
            <span class="esc-info-lbl">Tipo</span>
            <span class="esc-info-val">${tieneEnvio ? '🚚 Envío a domicilio' : '🏪 Ocurre en tienda'}</span>
          </div>
          ${tieneEnvio ? `
            ${ir('Destinatario', envio.destinatario)}
            ${ir('Tel. envío',   envio.tel_envio)}
            ${ir('C.P.',         envio.cp)}
            ${ir('Colonia',      envio.colonia)}
            ${ir('Dirección',    envio.direccion)}
            ${ir('Email envío',  envio.email_envio)}
          ` : ''}
        </div>
      </div>

      <div class="esc-info-section">
        <div class="esc-section-title">📋 Mis pedidos</div>
        ${e.pedidos.map(p => `
          <div class="esc-ped-mini">
            <span class="esc-pedido-code">${esc(p.codigo)}</span>
            ${p.grado ? `<span class="esc-chip">📚 ${esc(p.grado)}</span>` : ''}
            <span class="esc-chip">👥 ${p.total_alumnos || 0}</span>
            ${p.fecha_entrega ? `<span class="esc-chip">📅 ${fmtFechaEsc(p.fecha_entrega)}</span>` : ''}
            <button class="btn btn-outline btn-sm" style="margin-left:auto" onclick="verDetalle(${p.id})">Ver detalle →</button>
          </div>
        `).join('')}
      </div>

    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────
function fmtFechaEsc(f) {
  if (!f) return '—';
  const d = new Date(f.includes('T') ? f : f + 'T12:00:00');
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pctColor(pct) {
  if (pct >= 100) return '#2e7d32';   // verde oscuro  — entregado
  if (pct >=  75) return '#43a047';   // verde medio   — casi listo
  if (pct >=  50) return '#00897b';   // teal          — buen avance
  if (pct >=  25) return '#1e88e5';   // azul          — en proceso
  return '#42a5f5';                   // azul claro    — iniciando
}

const ESC_ESTADOS = {
  iniciando:         { label: '🔔 Iniciando',           bg: '#e8eaf6', fg: '#3949ab' },
  consiguiendo_tela: { label: '🔍 Consiguiendo tela',   bg: '#fff8e1', fg: '#e65100' },
  tela_conseguida:   { label: '🧵 Tela conseguida',     bg: '#f9fbe7', fg: '#558b2f' },
  cortando_tela:     { label: '✂️ Cortando tela',       bg: '#fff3e0', fg: '#f57c00' },
  bordando:          { label: '🪡 Bordando',            bg: '#fce4ec', fg: '#c2185b' },
  cosiendo:          { label: '🧶 Cosiendo',            bg: '#e0f2f1', fg: '#00796b' },
  rellenando:        { label: '🪢 Rellenando',          bg: '#f3e5f5', fg: '#6a1b9a' },
  vistiendo:         { label: '👗 Vistiendo',           bg: '#ede7f6', fg: '#7b1fa2' },
  sesion_fotos:      { label: '📸 Sesión de fotos',     bg: '#e1f5fe', fg: '#0277bd' },
  empacando:         { label: '📦 Empacando',           bg: '#e0f7fa', fg: '#00838f' },
  terminado:         { label: '✅ Terminado',           bg: '#e8f5e9', fg: '#2e7d32' },
  enviado:           { label: '🚚 Enviado',             bg: '#dcedc8', fg: '#1b5e20' },
  // legacy
  recibido:          { label: '📥 Pedido recibido',     bg: '#eceff1', fg: '#37474f' },
  pendiente:         { label: '⏳ Pendiente',           bg: '#fff3e0', fg: '#e65100' },
  en_proceso:        { label: '🔧 En proceso',          bg: '#e3f2fd', fg: '#1565c0' },
  listo:             { label: '✅ Listo',               bg: '#e8f5e9', fg: '#2e7d32' },
  cancelado:         { label: '❌ Cancelado',           bg: '#ffebee', fg: '#b71c1c' },
};

function escEstadoLabel(e) { return (ESC_ESTADOS[e] || { label: e || '—' }).label; }
function escEstadoColor(e) { const d = ESC_ESTADOS[e]; return d ? { bg: d.bg, fg: d.fg } : { bg: '#f4f4f6', fg: '#5c5c72' }; }
