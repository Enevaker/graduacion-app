// public/js/admin.js — Panel de administrador

async function renderAdmin() {
  if (!['admin', 'colaborador'].includes(window.currentUser?.rol)) return;

  document.getElementById('adminLista').innerHTML = '';

  const r = await API.get('/api/pedidos');
  if (!r.ok) return showToast(r.msg, 'error');

  const pedidos = r.pedidos;

  const _ciudadesP = [...new Set(pedidos.map(p => (p.ciudad||'').toLowerCase()).filter(Boolean))].sort();
  const _ciudadOptsP = _ciudadesP.map(c => `<option value="${esc(c)}">${esc(c.charAt(0).toUpperCase()+c.slice(1))}</option>`).join('');

  document.getElementById('adminFiltros').innerHTML = `
    <input class="at-filter-input" type="text" id="filtroColegio"
      placeholder="🏫 Buscar colegio…" oninput="filtrarAdmin()">
    <select id="filtroCiudad" onchange="filtrarAdmin()"
      style="border:1px solid var(--g200);border-radius:10px;padding:8px 10px;font-size:.84rem;color:var(--navy)">
      <option value="">📍 Todas las ciudades</option>${_ciudadOptsP}
    </select>`;

  window._adminPedidos = pedidos;
  filtrarAdmin();

  // Restaurar tab anterior si venimos del detalle
  const prevTab = window._adminPrevTab;
  if (prevTab) {
    window._adminPrevTab = null;
    setAdminTab(prevTab);
  }
}

function filtrarAdmin() {
  const pedidos  = window._adminPedidos || [];
  const colegio  = (document.getElementById('filtroColegio')?.value  || '').toLowerCase();
  const contacto = (document.getElementById('filtroContacto')?.value || '').toLowerCase();
  const ciudad   = document.getElementById('filtroCiudad')?.value || '';

  const filtered = pedidos.filter(p => {
    if (colegio  && !(p.colegio  || '').toLowerCase().includes(colegio))  return false;
    if (contacto && !(p.contacto || '').toLowerCase().includes(contacto)) return false;
    if (ciudad   && (p.ciudad||'').toLowerCase() !== ciudad)               return false;
    return true;
  });

  renderAdminLista(filtered);
}

function diasRestantes(fechaEntrega) {
  if (!fechaEntrega) return null;
  const hoy     = new Date(); hoy.setHours(0,0,0,0);
  const entrega = new Date(fechaEntrega); entrega.setHours(0,0,0,0);
  return Math.round((entrega - hoy) / 86400000);
}

function fmtFecha(f) {
  if (!f) return '—';
  const d = new Date(f);
  return isNaN(d) ? f : d.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' });
}

const AT_ESTADOS = {
  iniciando:         { label:'🔔 Iniciando',           color:'#3949ab', bg:'#e8eaf6' },
  consiguiendo_tela: { label:'🔍 Consiguiendo tela',   color:'#e65100', bg:'#fff8e1' },
  tela_conseguida:   { label:'🧵 Tela conseguida',     color:'#558b2f', bg:'#f9fbe7' },
  cortando_tela:     { label:'✂️ Cortando tela',       color:'#f57c00', bg:'#fff3e0' },
  bordando:          { label:'🪡 Bordando',            color:'#c2185b', bg:'#fce4ec' },
  cosiendo:          { label:'🧶 Cosiendo',            color:'#00796b', bg:'#e0f2f1' },
  rellenando:        { label:'🪢 Rellenando',          color:'#6a1b9a', bg:'#f3e5f5' },
  vistiendo:         { label:'👗 Vistiendo',           color:'#7b1fa2', bg:'#ede7f6' },
  sesion_fotos:      { label:'📸 Sesión de fotos',     color:'#0277bd', bg:'#e1f5fe' },
  empacando:         { label:'📦 Empacando',           color:'#00838f', bg:'#e0f7fa' },
  terminado:         { label:'✅ Terminado',           color:'#2e7d32', bg:'#e8f5e9' },
  enviado:           { label:'🚚 Enviado',             color:'#1b5e20', bg:'#dcedc8' },
  // Compatibilidad
  recibido:          { label:'📥 Pedido recibido',     color:'#37474f', bg:'#eceff1' },
  pendiente:         { label:'⏳ Pendiente',           color:'#e65100', bg:'#fff3e0' },
  en_proceso:        { label:'🔧 En proceso',          color:'#1565c0', bg:'#e3f2fd' },
  listo:             { label:'✅ Listo',               color:'#2e7d32', bg:'#e8f5e9' },
  cancelado:         { label:'❌ Cancelado',           color:'#b71c1c', bg:'#ffebee' },
};

function renderAdminLista(pedidos) {
  const el = document.getElementById('adminLista');
  if (!pedidos.length) {
    el.innerHTML = '<div class="empty-state" style="padding:48px"><div class="emo">🔍</div><p>No hay pedidos con esos filtros</p></div>';
    return;
  }

  el.innerHTML = `<div class="admin-cards-list">${pedidos.map(p => adminRowHTML(p)).join('')}</div>`;
}

function adminRowHTML(p) {
  const dias    = diasRestantes(p.fecha_entrega);
  const diasTxt = dias === null ? '—'
    : dias < 0  ? `<span style="color:#b71c1c;font-weight:700">${Math.abs(dias)}d venc.</span>`
    : dias <= 10 ? `<span style="color:#c62828;font-weight:700">${dias}d</span>`
    : dias <= 30 ? `<span style="color:#e65100;font-weight:600">${dias}d</span>`
    :              `<span style="color:#2e7d32">${dias}d</span>`;

  const est      = AT_ESTADOS[p.estado] || { label: p.estado, color:'#555', bg:'#f5f5f5' };
  const waMsg    = encodeURIComponent(`🎓 Pedido *${p.codigo}*\n📋 ${p.colegio}\n👤 ${p.contacto} · ${p.telefono}`);
  const waLink   = p.telefono ? `https://wa.me/52${p.telefono.replace(/\D/g,'')}?text=${waMsg}` : null;
  const pct      = estadoPct(p.estado);
  const barColor = pctColor(pct);

  return `
    <div class="adm-card">
      <div class="adm-card-top">
        <div>
          <div class="adm-card-colegio">${p.colegio || '—'}</div>
          <div class="adm-card-meta">👤 ${p.contacto || '—'} &nbsp;·&nbsp; 📅 ${fmtFecha(p.fecha_entrega)} &nbsp;·&nbsp; ${diasTxt}</div>
        </div>
        <div class="adm-card-actions">
          <button class="at-btn" title="Ver detalle" onclick="adminVerDetalle(${p.id})">👁️</button>
          <button class="at-btn" title="Avances" onclick="abrirAvancesModal(${p.id}, '${esc(p.colegio||'')}')">📸</button>
          <a class="at-btn" title="Excel" href="/api/pedidos/${p.id}/excel" target="_blank">📊</a>
          ${waLink ? `<a class="at-btn" title="WhatsApp" href="${waLink}" target="_blank">💬</a>` : ''}
          <button class="at-btn" title="Editar pedido" onclick="editarPedido(${p.id})">✏️</button>
          <button class="at-btn" title="Eliminar pedido" onclick="eliminarPedido(${p.id},'${esc(p.colegio||'')}')">🗑️</button>
        </div>
      </div>
      <select class="at-estado-sel"
        style="background:${est.bg};color:${est.color};border-color:${est.color}33;width:100%;margin-top:10px"
        onchange="cambiarEstado(${p.id}, this.value)">
        <option value="iniciando"          ${p.estado==='iniciando'          ?'selected':''}>🔔 Iniciando</option>
        <option value="consiguiendo_tela"  ${p.estado==='consiguiendo_tela'  ?'selected':''}>🔍 Consiguiendo tela</option>
        <option value="tela_conseguida"    ${p.estado==='tela_conseguida'    ?'selected':''}>🧵 Tela conseguida</option>
        <option value="cortando_tela"      ${p.estado==='cortando_tela'      ?'selected':''}>✂️ Cortando tela</option>
        <option value="bordando"           ${p.estado==='bordando'           ?'selected':''}>🪡 Bordando</option>
        <option value="cosiendo"           ${p.estado==='cosiendo'           ?'selected':''}>🧶 Cosiendo</option>
        <option value="rellenando"         ${p.estado==='rellenando'         ?'selected':''}>🪢 Rellenando</option>
        <option value="vistiendo"          ${p.estado==='vistiendo'          ?'selected':''}>👗 Vistiendo</option>
        <option value="sesion_fotos"       ${p.estado==='sesion_fotos'       ?'selected':''}>📸 Sesión de fotos</option>
        <option value="empacando"          ${p.estado==='empacando'          ?'selected':''}>📦 Empacando</option>
        <option value="terminado"          ${p.estado==='terminado'          ?'selected':''}>✅ Terminado</option>
        <option value="enviado"            ${p.estado==='enviado'            ?'selected':''}>🚚 Enviado</option>
      </select>
      <div style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:.74rem;color:var(--g400)">📊 Progreso</span>
          <span style="font-size:.74rem;font-weight:700;color:${barColor}">${pct}%</span>
        </div>
        <div style="height:7px;background:var(--g100);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .4s ease"></div>
        </div>
      </div>
    </div>`;
}

async function cambiarEstado(id, estado) {
  if (!estado) return;
  const r = await API.put(`/api/pedidos/${id}/estado`, { estado });
  if (!r.ok) { showToast(r.msg, 'error'); renderAdmin(); return; }

  // Actualizar localmente en admin sin re-fetch completo
  if (window._adminPedidos) {
    const p = window._adminPedidos.find(p => p.id === id);
    if (p) { p.estado = estado; filtrarAdmin(); }
  }

  // Actualizar también en "Mis Pedidos" del cliente si está cargado
  if (window.todosLosPedidosRef) {
    const p = window.todosLosPedidosRef.find(p => p.id === id);
    if (p) p.estado = estado;
  }

  showToast('Estado actualizado ✅', 'success');
}

async function adminVerDetalle(id) {
  // Guardar tab activo antes de ir al detalle
  window._adminPrevTab = ['pedidos','estados','dashboard','finanzas','escuelas','usuarios']
    .find(t => document.getElementById(`atb-${t}`)?.classList.contains('atb-active')) || 'pedidos';

  await verDetalle(id);

  // Cambiar el botón volver para que regrese al admin
  const acciones = document.getElementById('detalleAcciones');
  if (acciones) {
    const volverBtn = acciones.querySelector('.btn-volver');
    if (volverBtn) volverBtn.setAttribute('onclick', "goTo('admin')");
  }
}

function exportarTodosExcel() {
  window.open('/api/pedidos/admin/excel-todos', '_blank');
}

// ── Editar / Eliminar Pedido ───────────────────────────────────
async function editarPedido(id) {
  const r = await API.get(`/api/pedidos/${id}`);
  if (!r.ok) return showToast(r.msg || 'Error al cargar pedido', 'error');
  const p = r.pedido;

  document.getElementById('modalContent').innerHTML = `
    <h3 style="font-family:'DM Serif Display',serif;color:var(--navy);margin-bottom:16px">✏️ Editar Pedido</h3>
    <div class="fields-grid2">
      <div class="field"><label>Colegio</label>
        <input type="text" id="epColegio" value="${esc(p.colegio||'')}"></div>
      <div class="field"><label>Contacto</label>
        <input type="text" id="epContacto" value="${esc(p.contacto||'')}"></div>
      <div class="field"><label>Teléfono</label>
        <input type="text" id="epTelefono" value="${esc(p.telefono||'')}"></div>
      <div class="field"><label>Email</label>
        <input type="email" id="epEmail" value="${esc(p.email||'')}"></div>
      <div class="field"><label>Ciudad</label>
        <input type="text" id="epCiudad" value="${esc(p.ciudad||'')}"></div>
      <div class="field"><label>Grado</label>
        <input type="text" id="epGrado" value="${esc(p.grado||'')}"></div>
      <div class="field"><label>Fecha entrega</label>
        <input type="date" id="epFechaEntrega" value="${p.fecha_entrega||''}"></div>
    </div>
    <div style="margin-top:12px">
      <p style="font-size:.8rem;font-weight:700;color:var(--navy);text-transform:uppercase;margin-bottom:8px">Uniforme</p>
      <div class="fields-grid2">
        <div class="field"><label>Calceta niñas</label>
          <input type="text" id="epCalceta" value="${esc(p.calceta||'')}"></div>
        <div class="field"><label>Zapato niñas</label>
          <input type="text" id="epZapatoNina" value="${esc(p.zapato_nina||'')}"></div>
        <div class="field"><label>Moños</label>
          <input type="text" id="epMonos" value="${esc(p.monos||'')}"></div>
        <div class="field"><label>Zapato niños</label>
          <input type="text" id="epZapatoNino" value="${esc(p.zapato_nino||'')}"></div>
        <div class="field"><label>Pantalón</label>
          <input type="text" id="epPantalon" value="${esc(p.pantalon||'')}"></div>
        <div class="field"><label>Escudos</label>
          <input type="text" id="epEscudos" value="${esc(p.escudos||'')}"></div>
      </div>
    </div>
    <div style="margin-top:12px" class="field"><label>Notas</label>
      <textarea id="epNotas" rows="3" style="width:100%;resize:vertical">${esc(p.notas||'')}</textarea>
    </div>
    <div id="epErr" class="auth-error" style="display:none"></div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-primary" id="epSaveBtn" onclick="guardarEditPedido(${id})">💾 Guardar cambios</button>
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    </div>`;
  openModal();
}

async function guardarEditPedido(id) {
  const btn = document.getElementById('epSaveBtn');
  const err = document.getElementById('epErr');
  btn.disabled = true; btn.textContent = 'Guardando…';
  err.style.display = 'none';

  const datos = {
    colegio:      document.getElementById('epColegio').value.trim(),
    contacto:     document.getElementById('epContacto').value.trim(),
    telefono:     document.getElementById('epTelefono').value.trim(),
    email:        document.getElementById('epEmail').value.trim(),
    ciudad:       document.getElementById('epCiudad').value.trim(),
    grado:        document.getElementById('epGrado').value.trim(),
    fecha_entrega: document.getElementById('epFechaEntrega').value || null,
    calceta:      document.getElementById('epCalceta').value.trim(),
    zapato_nina:  document.getElementById('epZapatoNina').value.trim(),
    monos:        document.getElementById('epMonos').value.trim(),
    zapato_nino:  document.getElementById('epZapatoNino').value.trim(),
    pantalon:     document.getElementById('epPantalon').value.trim(),
    escudos:      document.getElementById('epEscudos').value.trim(),
    notas:        document.getElementById('epNotas').value.trim(),
  };

  const r = await API.put(`/api/pedidos/${id}`, datos);
  if (!r.ok) {
    err.textContent = r.msg || 'Error al guardar';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = '💾 Guardar cambios';
    return;
  }

  // Actualizar localmente
  if (window._adminPedidos) {
    const idx = window._adminPedidos.findIndex(p => p.id === id);
    if (idx !== -1) window._adminPedidos[idx] = { ...window._adminPedidos[idx], ...r.pedido };
  }
  closeModal();
  filtrarAdmin();
  showToast('Pedido actualizado ✅', 'success');
}

async function eliminarPedido(id, colegio) {
  if (!confirm(`¿Eliminar el pedido de "${colegio}"?\nSe eliminarán también sus alumnos, pagos y avances.\nEsta acción no se puede deshacer.`)) return;
  const r = await API.delete(`/api/pedidos/${id}`);
  if (!r.ok) return showToast(r.msg || 'Error al eliminar', 'error');
  if (window._adminPedidos) {
    window._adminPedidos = window._adminPedidos.filter(p => p.id !== id);
  }
  filtrarAdmin();
  showToast('Pedido eliminado', 'success');
}

// ── Modal de avances por pedido ────────────────────────────────
async function abrirAvancesModal(pedidoId, colegio) {
  document.getElementById('modalContent').innerHTML = `
    <h3 style="font-family:'DM Serif Display',serif;color:var(--navy);margin-bottom:4px">📸 Avances del pedido</h3>
    <p style="color:var(--g400);font-size:.82rem;margin-bottom:16px">🏫 ${esc(colegio)}</p>
    <div id="avModalLista" style="max-height:320px;overflow-y:auto;margin-bottom:16px">
      <div class="loading-state">Cargando…</div>
    </div>
    <div class="sec-card" style="padding:16px;margin-bottom:0">
      <div class="field" style="margin-bottom:10px">
        <label style="font-size:.82rem;font-weight:600">Mensaje (opcional)</label>
        <textarea id="avModalMsg" rows="2" placeholder="Descripción del avance…"
          style="width:100%;border:1px solid var(--g200);border-radius:var(--r-sm);padding:8px;font-size:.88rem;resize:vertical"></textarea>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label style="font-size:.82rem;font-weight:600">Fotos o videos <span style="color:var(--g400);font-weight:400">(puedes elegir varios)</span></label>
        <input type="file" id="avModalFiles" multiple accept="image/*,video/mp4,video/quicktime,video/webm"
          style="display:block;margin-top:6px">
      </div>
      <button class="btn btn-primary btn-sm" id="btnPublicarAv" onclick="subirAvancesAdmin(${pedidoId})">📤 Publicar avance</button>
    </div>`;
  openModal();

  // Cargar avances existentes
  const r = await API.get('/api/escuelas/data');
  const lista = document.getElementById('avModalLista');
  if (!lista) return;
  if (!r.ok) { lista.innerHTML = '<p style="color:red">Error al cargar avances</p>'; return; }

  const avances = (r.avances || []).filter(a => a.pedido_id === pedidoId);
  if (!avances.length) {
    lista.innerHTML = '<p style="color:var(--g400);text-align:center;padding:12px">Sin avances publicados aún</p>';
  } else {
    lista.innerHTML = avances.map(a => avModalItemHTML(a)).join('');
  }
}

function avModalItemHTML(a) {
  const isVideo = a.filename && /\.(mp4|mov|webm)$/i.test(a.filename);
  const src = a.filename ? `/uploads/avances/${esc(a.filename)}` : null;
  return `
    <div class="esc-avance-item" id="avm-${a.id}" style="border-bottom:1px solid var(--g100);padding-bottom:10px;margin-bottom:10px">
      <div class="esc-avance-meta">
        <span class="esc-avance-fecha">📅 ${fmtFecha(a.creado_en)}</span>
        <button class="esc-av-del" onclick="eliminarAvanceModal(${a.id})" title="Eliminar">🗑️</button>
      </div>
      ${a.mensaje ? `<p class="esc-avance-msg">${esc(a.mensaje)}</p>` : ''}
      ${src && isVideo  ? `<video class="esc-avance-img" src="${src}" controls style="max-width:100%;border-radius:8px;margin-top:6px"></video>` : ''}
      ${src && !isVideo ? `<img class="esc-avance-img" src="${src}" onclick="escVerImagen('${src}')" style="cursor:pointer">` : ''}
    </div>`;
}

async function subirAvancesAdmin(pedidoId) {
  const msg     = document.getElementById('avModalMsg')?.value?.trim() || '';
  const input   = document.getElementById('avModalFiles');
  const files   = Array.from(input?.files || []);

  if (!msg && !files.length) {
    showToast('Escribe un mensaje o adjunta un archivo', 'error'); return;
  }

  const btn = document.getElementById('btnPublicarAv');
  btn.disabled = true; btn.textContent = 'Publicando…';

  const fd = new FormData();
  fd.append('mensaje', msg);
  files.forEach(f => fd.append('archivos', f));

  const r = await subirArchivo(`/api/escuelas/pedidos/${pedidoId}/avances`, fd);
  btn.disabled = false; btn.textContent = '📤 Publicar avance';

  if (!r.ok) { showToast(r.msg || 'Error al publicar', 'error'); return; }

  // Agregar nuevos avances al modal
  const lista = document.getElementById('avModalLista');
  if (lista) {
    const sinMsg = lista.querySelector('p');
    if (sinMsg) sinMsg.remove();
    (r.avances || []).forEach(a => {
      const div = document.createElement('div');
      div.innerHTML = avModalItemHTML(a);
      lista.appendChild(div.firstElementChild);
    });
  }

  document.getElementById('avModalMsg').value = '';
  if (input) input.value = '';
  showToast('Avance publicado ✅', 'success');
}

async function eliminarAvanceModal(id) {
  if (!confirm('¿Eliminar este avance?')) return;
  const r = await API.delete(`/api/escuelas/avances/${id}`);
  if (!r.ok) { showToast(r.msg || 'Error', 'error'); return; }
  document.getElementById(`avm-${id}`)?.remove();
  showToast('Avance eliminado', 'success');
}

// ── Tabs del admin ─────────────────────────────────────────────
function setAdminTab(tab) {
  ['pedidos','estados','dashboard','finanzas','escuelas','usuarios'].forEach(t => {
    document.getElementById(`atb-${t}`)?.classList.toggle('atb-active', t === tab);
    const con = document.getElementById(`atab-${t}`);
    if (con) con.style.display = t === tab ? '' : 'none';
  });
  sessionStorage.setItem('lastAdminTab', tab);
  if (tab === 'estados')   renderAdminEstados();
  if (tab === 'dashboard') renderAdminDashboard();
  if (tab === 'finanzas')  renderAdminFinanzas();
  if (tab === 'escuelas')  renderAdminEscuelasTab();
  if (tab === 'usuarios')  renderAdminUsuariosTab();
}

// ── Tab Estados ────────────────────────────────────────────────
function renderAdminEstados() {
  const el = document.getElementById('adminEstadosContenido');
  if (!el) return;

  const todos = window._adminPedidos || [];
  if (!todos.length) {
    el.innerHTML = '<div class="empty-state" style="padding:48px"><div class="emo">🏷️</div><p>Sin pedidos aún</p></div>';
    return;
  }

  // Ciudades únicas para dropdown
  const ciudades = [...new Set(todos.map(p => p.ciudad).filter(Boolean))].sort();
  const ciudadOpts = ciudades.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  el.innerHTML = `
    <div style="padding:8px 2px">
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);padding:14px 16px;margin-bottom:18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <input class="at-filter-input" id="estFiltColegio" placeholder="🔍 Buscar colegio…" oninput="filtrarEstados()" style="flex:1;min-width:140px">
        <select id="estFiltCiudad" onchange="filtrarEstados()"
          style="border:1px solid var(--g200);border-radius:10px;padding:8px 10px;font-size:.84rem;color:var(--navy)">
          <option value="">📍 Todas las ciudades</option>${ciudadOpts}
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:.83rem;color:var(--g400);cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="estFiltOcultar" onchange="filtrarEstados()" style="cursor:pointer">
          Ocultar terminados
        </label>
      </div>
      <div id="estadosLista"></div>
    </div>`;

  filtrarEstados();
}

function filtrarEstados() {
  const todos      = window._adminPedidos || [];
  const buscar     = (document.getElementById('estFiltColegio')?.value || '').toLowerCase();
  const ciudad     = document.getElementById('estFiltCiudad')?.value || '';
  const ocultarFin = document.getElementById('estFiltOcultar')?.checked;

  const FINALES = ['terminado','enviado'];
  const ORDEN   = [
    'iniciando','consiguiendo_tela','tela_conseguida','cortando_tela',
    'bordando','cosiendo','rellenando','vistiendo',
    'sesion_fotos','empacando','terminado','enviado'
  ];

  let pedidos = todos.filter(p => {
    if (buscar && !(p.colegio||'').toLowerCase().includes(buscar)) return false;
    if (ciudad && p.ciudad !== ciudad) return false;
    if (ocultarFin && FINALES.includes(p.estado)) return false;
    return true;
  });

  const grupos = {};
  for (const p of pedidos) {
    const k = ORDEN.includes(p.estado) ? p.estado : 'iniciando';
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(p);
  }

  const pedidoMiniCard = (p, accent) => {
    const dias = diasRestantes(p.fecha_entrega);
    const diasTxt = dias === null ? ''
      : dias < 0  ? `<span style="color:#b71c1c;font-weight:700">${Math.abs(dias)}d venc.</span>`
      : dias <= 10 ? `<span style="color:#c62828;font-weight:700">${dias}d</span>`
      : dias <= 30 ? `<span style="color:#e65100">${dias}d</span>`
      :              `<span style="color:#2e7d32">${dias}d</span>`;
    return `
      <div style="background:#fff;border-radius:14px;box-shadow:0 2px 10px ${accent}33;border-top:3px solid ${accent};padding:13px 15px;cursor:pointer;min-width:150px;flex:1 1 150px;max-width:220px"
           onclick="adminVerDetalle(${p.id})">
        <div style="font-weight:700;font-size:.88rem;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.colegio||'—')}</div>
        <div style="font-size:.75rem;color:var(--g400);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">👤 ${esc(p.contacto||'—')}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:7px;font-size:.75rem">
          <span>🪆 ${p.total_alumnos||0} muñecos</span>
          <span>📅 ${diasTxt||fmtFecha(p.fecha_entrega)}</span>
        </div>
      </div>`;
  };

  const secciones = ORDEN.filter(k => grupos[k]?.length).map(k => {
    const est = AT_ESTADOS[k] || { label: k, color:'#555' };
    const lista = grupos[k]; const accent = est.color;
    return `
      <div style="background:linear-gradient(135deg,${accent}12 0%,#fff 70%);border-radius:20px;border:1px solid ${accent}30;padding:18px 20px;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="width:34px;height:34px;border-radius:10px;background:${accent}22;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${est.label.split(' ')[0]}</div>
          <h3 style="margin:0;font-family:'DM Serif Display',serif;font-size:1rem;color:var(--navy);font-weight:400">${est.label.split(' ').slice(1).join(' ')}</h3>
          <span style="margin-left:auto;background:${accent};color:#fff;border-radius:20px;padding:2px 10px;font-size:.75rem;font-weight:700">${lista.length}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px">${lista.map(p => pedidoMiniCard(p, accent)).join('')}</div>
      </div>`;
  });

  document.getElementById('estadosLista').innerHTML =
    secciones.join('') ||
    `<div class="empty-state" style="padding:40px"><div class="emo">🔍</div><p>Sin resultados con esos filtros</p></div>`;
}

// ── Tab Dashboard / Detalles de muñeco ────────────────────────
async function renderAdminDashboard() {
  const el = document.getElementById('adminDashboardContenido');
  if (!el) return;
  el.innerHTML = '<div class="loading-state">Cargando…</div>';

  const r = await API.get('/api/pedidos/caracteristicas');
  if (!r.ok) {
    el.innerHTML = `<div class="empty-state" style="padding:48px"><div class="emo">🪆</div><p>Error al cargar datos</p></div>`;
    return;
  }

  window._dashPedidos = r.pedidos;
  _renderDashFiltros(el);
}

const _DASH_CAMPOS = [
  { key:'pelo_nina',   icon:'💇‍♀️', label:'Pelo — Niñas',  accent:'#e91e8c', multi:true,  field:'pelos_ninas' },
  { key:'pelo_nino',   icon:'💇‍♂️', label:'Pelo — Niños',  accent:'#283593', multi:true,  field:'pelos_ninos' },
  { key:'zapato_nina', icon:'👠',    label:'Zapato niña',   accent:'#c2185b', multi:false, field:'zapato_nina' },
  { key:'zapato_nino', icon:'👟',    label:'Zapato niño',   accent:'#1565c0', multi:false, field:'zapato_nino' },
  { key:'calceta',     icon:'🧦',    label:'Calceta',       accent:'#00838f', multi:false, field:'calceta' },
  { key:'monos',       icon:'🎀',    label:'Moños',         accent:'#ad1457', multi:false, field:'monos' },
  { key:'pantalon',    icon:'👖',    label:'Pantalón',      accent:'#4527a0', multi:false, field:'pantalon' },
];

function _dashCountVals(arr) {
  const counts = {};
  arr.filter(Boolean).forEach(v => { counts[v] = (counts[v]||0) + 1; });
  return Object.entries(counts).sort((a,b) => b[1]-a[1]);
}

function _renderDashFiltros(el) {
  const pedidos = window._dashPedidos || [];
  if (!pedidos.length) {
    el.innerHTML = '<div class="empty-state" style="padding:48px"><div class="emo">🪆</div><p>Sin pedidos aún</p></div>';
    return;
  }

  const botonesHTML = _DASH_CAMPOS.map(c => `
    <button id="dbtn-${c.key}" onclick="toggleDashCampo('${c.key}')" data-active="false"
      style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:50px;
             border:2px solid ${c.accent};background:#fff;color:${c.accent};font-size:.82rem;
             font-weight:600;cursor:pointer;transition:all .18s">
      ${c.icon} ${c.label}
    </button>`).join('');

  el.innerHTML = `
    <div style="padding:8px 2px">
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">${botonesHTML}</div>
      <div id="dashCaracteristicas"></div>
    </div>`;

  _renderCaracteristicasCards(pedidos);
}

function toggleDashCampo(key) {
  const btn  = document.getElementById(`dbtn-${key}`);
  const card = document.getElementById(`dash-card-${key}`);
  if (!btn || !card) return;
  const c = _DASH_CAMPOS.find(x => x.key === key);
  const wasActive = btn.dataset.active === 'true';
  if (wasActive) {
    btn.dataset.active = 'false';
    btn.style.background = '#fff';
    btn.style.color = c.accent;
    card.style.display = 'none';
  } else {
    btn.dataset.active = 'true';
    btn.style.background = c.accent;
    btn.style.color = '#fff';
    card.style.display = '';
  }
}

function _renderCaracteristicasCards(pedidos) {
  const el = document.getElementById('dashCaracteristicas');
  if (!el) return;

  const summaryHTML = _DASH_CAMPOS.map(c => {
    const raw = c.multi
      ? pedidos.flatMap(p => (p[c.field]||'').split(',').map(s=>s.trim()).filter(Boolean))
      : pedidos.map(p => p[c.field]).filter(Boolean);
    const vals = _dashCountVals(raw);

    const valCards = vals.length
      ? vals.map(([val, n]) => `
          <div style="background:#fff;border-radius:14px;padding:12px 14px;text-align:center;
               box-shadow:0 1px 8px ${c.accent}20;min-width:90px;flex:1 1 90px;max-width:160px">
            <div style="font-size:1.5rem;font-weight:700;color:${c.accent};font-family:'DM Serif Display',serif">${n}</div>
            <div style="font-size:.76rem;color:var(--navy);font-weight:500;margin-top:3px;word-break:break-word">${esc(val)}</div>
          </div>`).join('')
      : `<span style="color:var(--g400);font-size:.83rem">Sin datos aún</span>`;

    return `
      <div id="dash-card-${c.key}" style="display:none;background:linear-gradient(135deg,${c.accent}09 0%,#fff 65%);border-radius:20px;
           border:1px solid ${c.accent}25;padding:16px 18px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="width:38px;height:38px;border-radius:11px;background:${c.accent}18;
               display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0">${c.icon}</div>
          <h3 style="margin:0;font-family:'DM Serif Display',serif;font-size:1rem;color:var(--navy)">${c.label}</h3>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${valCards}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="font-size:.84rem;color:var(--navy);margin-bottom:12px;font-weight:700;padding:0 2px">
      🪆 ${pedidos.length} pedido${pedidos.length!==1?'s':''}
    </div>
    ${summaryHTML}`;
}

function _renderDashEstadisticas() {
  const pedidos = (window._adminPedidos || []).filter(p => p.estado !== 'cancelado');
  const el = document.getElementById('dashEstadisticas');
  if (!el) return;

  if (!pedidos.length) {
    el.innerHTML = '<div class="empty-state" style="padding:48px"><div class="emo">📊</div><p>Sin datos de pedidos</p></div>';
    return;
  }

  const porCiudad  = {};
  const porColegio = {};
  const porCuenta  = {};

  for (const p of pedidos) {
    const ciudad  = p.ciudad  || '(Sin ciudad)';
    const colegio = p.colegio || '(Sin colegio)';
    const cuenta  = p.usuario_nombre || p.usuario_email || '(Sin cuenta)';

    const agg = (obj, key) => {
      if (!obj[key]) obj[key] = { pedidos: 0, alumnos: 0, ninas: 0, ninos: 0, ciudad: p.ciudad || '' };
      obj[key].pedidos++;
      obj[key].alumnos += p.total_alumnos || 0;
      obj[key].ninas   += p.total_ninas   || 0;
      obj[key].ninos   += p.total_ninos   || 0;
    };
    agg(porCiudad,  ciudad);
    agg(porColegio, colegio);
    agg(porCuenta,  cuenta);
  }

  const sortBy = (obj, key) => Object.entries(obj).sort((a, b) => b[1][key] - a[1][key]);
  const ciudades  = sortBy(porCiudad,  'alumnos');
  const colegios  = sortBy(porColegio, 'alumnos');
  const cuentas   = sortBy(porCuenta,  'pedidos');

  const totalAlumnos = pedidos.reduce((s, p) => s + (p.total_alumnos||0), 0);
  const totalNinas   = pedidos.reduce((s, p) => s + (p.total_ninas||0),   0);
  const totalNinos   = pedidos.reduce((s, p) => s + (p.total_ninos||0),   0);

  const barPct     = (n, max) => max ? Math.round(n / max * 100) : 0;
  const maxAlumnos = colegios[0]?.[1].alumnos || 1;

  el.innerHTML = `
    <div class="astat-totales">
      <div class="astat-tot-card">
        <div class="astat-tot-num">${pedidos.length}</div>
        <div class="astat-tot-lbl">📋 Pedidos activos</div>
      </div>
      <div class="astat-tot-card">
        <div class="astat-tot-num" style="color:var(--rose)">${totalNinas}</div>
        <div class="astat-tot-lbl">👧 Total niñas</div>
      </div>
      <div class="astat-tot-card">
        <div class="astat-tot-num" style="color:var(--navy)">${totalNinos}</div>
        <div class="astat-tot-lbl">👦 Total niños</div>
      </div>
      <div class="astat-tot-card">
        <div class="astat-tot-num" style="color:var(--gold)">${totalAlumnos}</div>
        <div class="astat-tot-lbl">🪆 Total muñecos</div>
      </div>
    </div>

    <div class="astat-section">
      <h4 class="astat-title">🏙️ Por Ciudad</h4>
      <div class="astat-chips">
        ${ciudades.map(([ciudad, d]) => `
          <div class="astat-chip">
            <div class="astat-chip-name">${ciudad}</div>
            <div class="astat-chip-meta">${d.pedidos} pedido${d.pedidos!==1?'s':''} · 👧 ${d.ninas} · 👦 ${d.ninos}</div>
            <div class="astat-chip-total">${d.alumnos} muñecos</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="astat-section">
      <h4 class="astat-title">🏫 Por Colegio <span style="font-size:.75rem;font-weight:400;color:var(--g400)">(ordenado por muñecos)</span></h4>
      <div class="astat-colegio-list">
        ${colegios.map(([colegio, d]) => `
          <div class="astat-colegio-row">
            <div class="astat-colegio-info">
              <span class="astat-colegio-name">${colegio}</span>
              <span class="astat-colegio-ciudad">${d.ciudad || '—'}</span>
            </div>
            <div class="astat-colegio-bar-wrap">
              <div class="astat-colegio-bar" style="width:${barPct(d.alumnos, maxAlumnos)}%"></div>
            </div>
            <div class="astat-colegio-nums">
              <span style="color:var(--rose)">👧 ${d.ninas}</span>
              <span style="color:var(--navy)">👦 ${d.ninos}</span>
              <strong>${d.alumnos}</strong>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div class="astat-section">
      <h4 class="astat-title">👤 Por Vendedor / Cuenta</h4>
      <div class="astat-chips">
        ${cuentas.map(([cuenta, d]) => `
          <div class="astat-chip">
            <div class="astat-chip-name">${cuenta}</div>
            <div class="astat-chip-meta">${d.pedidos} pedido${d.pedidos!==1?'s':''}</div>
            <div class="astat-chip-total">${d.alumnos} muñecos</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Vista de estadísticas ──────────────────────────────────────
function renderAdminEstadisticas() {
  const pedidos = (window._adminPedidos || []).filter(p => p.estado !== 'cancelado');
  const el = document.getElementById('adminEstadisticas');
  if (!el) return;

  if (!pedidos.length) {
    el.innerHTML = '<div class="empty-state" style="padding:48px"><div class="emo">📊</div><p>Sin datos de pedidos</p></div>';
    return;
  }

  // Agrupar
  const porCiudad  = {};
  const porColegio = {};
  const porCuenta  = {};

  for (const p of pedidos) {
    const ciudad  = p.ciudad   || '(Sin ciudad)';
    const colegio = p.colegio  || '(Sin colegio)';
    const cuenta  = p.usuario_nombre ? `${p.usuario_nombre}` : (p.usuario_email || '(Sin cuenta)');

    const agg = (obj, key) => {
      if (!obj[key]) obj[key] = { pedidos: 0, alumnos: 0, ninas: 0, ninos: 0, ciudad: p.ciudad || '' };
      obj[key].pedidos++;
      obj[key].alumnos += p.total_alumnos || 0;
      obj[key].ninas   += p.total_ninas   || 0;
      obj[key].ninos   += p.total_ninos   || 0;
    };
    agg(porCiudad,  ciudad);
    agg(porColegio, colegio);
    agg(porCuenta,  cuenta);
  }

  const sortBy = (obj, key) => Object.entries(obj).sort((a,b) => b[1][key] - a[1][key]);

  const ciudades  = sortBy(porCiudad,  'alumnos');
  const colegios  = sortBy(porColegio, 'alumnos');
  const cuentas   = sortBy(porCuenta,  'pedidos');

  const totalAlumnos = pedidos.reduce((s,p) => s + (p.total_alumnos||0), 0);
  const totalNinas   = pedidos.reduce((s,p) => s + (p.total_ninas||0), 0);
  const totalNinos   = pedidos.reduce((s,p) => s + (p.total_ninos||0), 0);

  const barPct = (n, max) => max ? Math.round(n / max * 100) : 0;
  const maxAlumnos = colegios[0]?.[1].alumnos || 1;

  el.innerHTML = `
    <!-- TOTALES GLOBALES -->
    <div class="astat-totales">
      <div class="astat-tot-card">
        <div class="astat-tot-num">${pedidos.length}</div>
        <div class="astat-tot-lbl">📋 Pedidos activos</div>
      </div>
      <div class="astat-tot-card">
        <div class="astat-tot-num" style="color:var(--rose)">${totalNinas}</div>
        <div class="astat-tot-lbl">👧 Total niñas</div>
      </div>
      <div class="astat-tot-card">
        <div class="astat-tot-num" style="color:var(--navy)">${totalNinos}</div>
        <div class="astat-tot-lbl">👦 Total niños</div>
      </div>
      <div class="astat-tot-card">
        <div class="astat-tot-num" style="color:var(--gold)">${totalAlumnos}</div>
        <div class="astat-tot-lbl">🪆 Total muñecos</div>
      </div>
    </div>

    <!-- POR CIUDAD -->
    <div class="astat-section">
      <h4 class="astat-title">🏙️ Por Ciudad</h4>
      <div class="astat-chips">
        ${ciudades.map(([ciudad, d]) => `
          <div class="astat-chip">
            <div class="astat-chip-name">${ciudad}</div>
            <div class="astat-chip-meta">${d.pedidos} pedido${d.pedidos!==1?'s':''} · 👧 ${d.ninas} · 👦 ${d.ninos}</div>
            <div class="astat-chip-total">${d.alumnos} muñecos</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- POR COLEGIO -->
    <div class="astat-section">
      <h4 class="astat-title">🏫 Por Colegio <span style="font-size:.75rem;font-weight:400;color:var(--g400)">(ordenado por muñecos)</span></h4>
      <div class="astat-colegio-list">
        ${colegios.map(([colegio, d]) => `
          <div class="astat-colegio-row">
            <div class="astat-colegio-info">
              <span class="astat-colegio-name">${colegio}</span>
              <span class="astat-colegio-ciudad">${d.ciudad || '—'}</span>
            </div>
            <div class="astat-colegio-bar-wrap">
              <div class="astat-colegio-bar" style="width:${barPct(d.alumnos, maxAlumnos)}%"></div>
            </div>
            <div class="astat-colegio-nums">
              <span style="color:var(--rose)">👧 ${d.ninas}</span>
              <span style="color:var(--navy)">👦 ${d.ninos}</span>
              <strong>${d.alumnos}</strong>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- POR CUENTA -->
    <div class="astat-section">
      <h4 class="astat-title">👤 Por Vendedor / Cuenta</h4>
      <div class="astat-chips">
        ${cuentas.map(([cuenta, d]) => `
          <div class="astat-chip">
            <div class="astat-chip-name">${cuenta}</div>
            <div class="astat-chip-meta">${d.pedidos} pedido${d.pedidos!==1?'s':''}</div>
            <div class="astat-chip-total">${d.alumnos} muñecos</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Tab Escuelas (solo imágenes de referencia) ─────────────────
async function renderAdminEscuelasTab() {
  const el = document.getElementById('adminEscuelasContenido');
  if (!el) return;
  el.innerHTML = '<div class="loading-state">Cargando escuelas…</div>';

  const [rUsuarios, rEscData] = await Promise.all([
    API.get('/api/usuarios'),
    API.get('/api/escuelas/data'),
  ]);

  const escuelas = (rUsuarios.ok ? (rUsuarios.usuarios || []) : [])
    .filter(u => u.rol === 'cliente');
  _escImagenes = rEscData.ok ? (rEscData.imagenes || []) : [];
  window._escuelasLista = escuelas;

  if (!escuelas.length) {
    el.innerHTML = '<div class="empty-state" style="padding:32px"><div class="emo">🏫</div><p>No hay escuelas registradas</p></div>';
    return;
  }

  const _ciudadesEsc = [...new Set(escuelas.map(u => u.ciudad).filter(Boolean))].sort();
  const _ciudadOptsEsc = _ciudadesEsc.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  el.innerHTML = `
    <div>
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);padding:12px 16px;margin-bottom:18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <input class="at-filter-input" id="escFiltNombre" placeholder="🔍 Buscar escuela…"
          oninput="filtrarEscuelas()" style="flex:1;min-width:140px">
        <select id="escFiltCiudad" onchange="filtrarEscuelas()"
          style="border:1px solid var(--g200);border-radius:10px;padding:8px 10px;font-size:.84rem;color:var(--navy)">
          <option value="">📍 Todas las ciudades</option>${_ciudadOptsEsc}
        </select>
      </div>
      <div id="escuelasListaContenido" class="esc-grid"></div>
    </div>`;

  filtrarEscuelas();
}

function filtrarEscuelas() {
  const escuelas = window._escuelasLista || [];
  const buscar   = (document.getElementById('escFiltNombre')?.value || '').toLowerCase();
  const ciudad   = document.getElementById('escFiltCiudad')?.value || '';

  const filtered = escuelas.filter(u => {
    if (buscar && !(u.colegio || u.nombre || '').toLowerCase().includes(buscar)) return false;
    if (ciudad && u.ciudad !== ciudad) return false;
    return true;
  });

  const el = document.getElementById('escuelasListaContenido');
  if (!el) return;

  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state" style="padding:40px"><div class="emo">🔍</div><p>Sin escuelas con ese nombre</p></div>';
    return;
  }

  el.innerHTML = filtered.map(u => {
    const nombre = (u.colegio || u.nombre || '').trim();
    return `
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-header">
          <div class="esc-icon">🏫</div>
          <div class="esc-card-info">
            <h3 class="esc-nombre">${esc(nombre)}</h3>
            <p class="esc-ciudad">${esc(u.ciudad || '')}</p>
          </div>
        </div>
        ${adminImgSectionHTML(nombre)}
      </div>`;
  }).join('');
}

// ── Imágenes de referencia por escuela (sin pedidos) ──────────
async function renderAdminImagenesEscuelas(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="loading-state">Cargando imágenes…</div>';

  const [rUsuarios, rEscData] = await Promise.all([
    API.get('/api/usuarios'),
    API.get('/api/escuelas/data'),
  ]);

  const escuelas = (rUsuarios.ok ? (rUsuarios.usuarios || []) : [])
    .filter(u => u.rol === 'cliente');
  _escImagenes = rEscData.ok ? (rEscData.imagenes || []) : [];

  if (!escuelas.length) {
    el.innerHTML = '<div class="empty-state" style="padding:32px"><div class="emo">🏫</div><p>No hay escuelas registradas</p></div>';
    return;
  }

  const cardsHTML = escuelas.map(u => {
    const nombre = (u.colegio || u.nombre || '').trim();
    return `
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-header">
          <div class="esc-icon">🏫</div>
          <div class="esc-card-info">
            <h3 class="esc-nombre">${esc(nombre)}</h3>
            <p class="esc-ciudad">${esc(u.ciudad || '')}</p>
          </div>
        </div>
        ${adminImgSectionHTML(nombre)}
      </div>`;
  }).join('');

  el.innerHTML = `<div class="esc-grid">${cardsHTML}</div>`;
}

// ── Tab Finanzas ───────────────────────────────────────────────
const PRECIO_MUNECO = 630;

async function renderAdminFinanzas() {
  const el = document.getElementById('adminFinanzasContenido');
  if (!el) return;
  el.innerHTML = '<div class="loading-state">Cargando finanzas…</div>';

  const r = await API.get('/api/pedidos/finanzas/resumen');
  if (!r.ok) {
    el.innerHTML = `<div class="empty-state" style="padding:48px"><div class="emo">⚠️</div><p>${esc(r.msg)}</p></div>`;
    return;
  }

  const pedidos = r.pedidos;
  if (!pedidos.length) {
    el.innerHTML = '<div class="empty-state" style="padding:48px"><div class="emo">💰</div><p>Sin pedidos aún</p></div>';
    return;
  }

  window._finanzasPedidos = pedidos;

  const _ciudadesFin = [...new Set(pedidos.map(p => (p.ciudad||'').toLowerCase()).filter(Boolean))].sort();
  const _ciudadOptsFin = _ciudadesFin.map(c => `<option value="${esc(c)}">${esc(c.charAt(0).toUpperCase()+c.slice(1))}</option>`).join('');

  el.innerHTML = `
    <div style="padding:8px 2px">
      <!-- Barra de filtros -->
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);padding:14px 16px;margin-bottom:18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <input class="at-filter-input" id="finFiltColegio" placeholder="🔍 Buscar colegio…" oninput="filtrarFinanzas()" style="flex:1;min-width:140px">
        <select id="finFiltCiudad" onchange="filtrarFinanzas()"
          style="border:1px solid var(--g200);border-radius:10px;padding:8px 10px;font-size:.84rem;color:var(--navy)">
          <option value="">📍 Todas las ciudades</option>${_ciudadOptsFin}
        </select>
        <select id="finFiltEstado" onchange="filtrarFinanzas()"
          style="border:1px solid var(--g200);border-radius:10px;padding:8px 10px;font-size:.84rem;color:var(--navy)">
          <option value="">💳 Todos</option>
          <option value="pendiente">⏳ Con saldo pendiente</option>
          <option value="pagado">✅ Pagados</option>
          <option value="sin_pagos">🚫 Sin pagos aún</option>
        </select>
        <select id="finFiltOrden" onchange="filtrarFinanzas()"
          style="border:1px solid var(--g200);border-radius:10px;padding:8px 10px;font-size:.84rem;color:var(--navy)">
          <option value="">📅 Orden: Fecha entrega</option>
          <option value="mayor_pendiente">⬆️ Mayor pendiente</option>
          <option value="menor_pendiente">⬇️ Menor pendiente</option>
        </select>
      </div>
      <div id="finanzasResumen"></div>
      <div id="finanzasCartas"></div>
    </div>`;

  filtrarFinanzas();
}

function _finCardHTML(p) {
  const fmt       = n => '$' + Math.round(n).toLocaleString('es-MX');
  const pagos     = p.pagos || [];
  const base      = (p.total_alumnos || 0) * PRECIO_MUNECO;
  const desc      = p.descuento || 0;
  const final     = base * (1 - desc / 100);
  const pagado    = pagos.reduce((s, pg) => s + pg.monto, 0);
  const pendiente = final - pagado;
  const pct       = final > 0 ? Math.min(100, Math.round(pagado / final * 100)) : 0;
  const pColor    = pendiente <= 0 ? '#2e7d32' : pendiente > final * 0.5 ? '#e65100' : '#f57c00';

  return `
    <div onclick="abrirFinDetalle(${p.id})"
      style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);
             margin-bottom:10px;overflow:hidden;cursor:pointer;
             transition:box-shadow .18s,transform .18s"
      onmouseenter="this.style.boxShadow='0 4px 20px rgba(26,39,68,.13)';this.style.transform='translateY(-1px)'"
      onmouseleave="this.style.boxShadow='0 2px 12px rgba(26,39,68,.07)';this.style.transform=''">
      <div style="padding:14px 16px;display:flex;align-items:center;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.9rem;color:var(--navy);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${esc(p.colegio||'—')}
          </div>
          <div style="font-size:.73rem;color:var(--g400);margin-top:2px">
            📋 ${esc(p.codigo)} &nbsp;·&nbsp; 🪆 ${p.total_alumnos} muñecos
            ${p.ciudad ? `&nbsp;·&nbsp; 📍 ${esc(p.ciudad)}` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:700;color:${pColor};font-size:.9rem">${fmt(pendiente)}</div>
          <div style="font-size:.7rem;color:var(--g400)">pendiente</div>
        </div>
        <span style="color:var(--g300);font-size:1rem">›</span>
      </div>
      <div style="height:4px;background:var(--g100)">
        <div style="height:100%;width:${pct}%;background:${pColor};transition:width .4s"></div>
      </div>
      <div style="padding:6px 16px;display:flex;justify-content:space-between;font-size:.72rem;color:var(--g400)">
        <span>${fmt(pagado)} cobrado</span>
        <span>${pct}% completado</span>
      </div>
    </div>`;
}

// ── Detalle exclusivo de finanzas ─────────────────────────────
function _finDetalleHTML(p) {
  const fmt       = n => '$' + Math.round(n).toLocaleString('es-MX');
  const pagos     = p.pagos || [];
  const base      = (p.total_alumnos || 0) * PRECIO_MUNECO;
  const desc      = p.descuento || 0;
  const final     = base * (1 - desc / 100);
  const pagado    = pagos.reduce((s, pg) => s + pg.monto, 0);
  const pendiente = final - pagado;
  const pct       = final > 0 ? Math.min(100, Math.round(pagado / final * 100)) : 0;
  const pColor    = pendiente <= 0 ? '#2e7d32' : pendiente > final * 0.5 ? '#e65100' : '#f57c00';
  const hoy       = new Date().toISOString().slice(0, 10);

  const tipoLabel = t => t === 'anticipo_50' ? '💵 Anticipo 50%' : t === 'pago_final' ? '✅ Pago final' : '✍️ Anticipo';
  const tipoBg    = t => t === 'pago_final' ? '#e8f5e9' : '#e8eaf6';
  const tipoClr   = t => t === 'pago_final' ? '#2e7d32'  : '#3949ab';

  const pagosHTML = pagos.length
    ? pagos.map(pg => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
                    background:#fff;border-radius:12px;border:1px solid var(--g100)">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="background:${tipoBg(pg.tipo)};color:${tipoClr(pg.tipo)};
                           border-radius:20px;padding:2px 10px;font-size:.72rem;font-weight:600">
                ${tipoLabel(pg.tipo)}</span>
              <span style="font-size:.76rem;color:var(--g400)">${pg.fecha}</span>
            </div>
          </div>
          <span style="font-weight:700;color:var(--navy);font-size:.95rem">${fmt(pg.monto)}</span>
          <button onclick="eliminarPago(${pg.id},${p.id})"
            style="background:none;border:none;cursor:pointer;color:var(--g300);
                   padding:4px;border-radius:6px;line-height:1;font-size:.9rem"
            title="Eliminar pago">🗑️</button>
        </div>`).join('')
    : `<div style="text-align:center;padding:20px;color:var(--g300);font-size:.85rem">
         <div style="font-size:1.6rem;margin-bottom:6px">💳</div>Sin pagos registrados aún</div>`;

  return `
    <!-- Header con volver -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
      <button onclick="cerrarFinDetalle()"
        style="background:#fff;border:1px solid var(--g200);border-radius:12px;
               padding:8px 14px;cursor:pointer;font-size:.83rem;color:var(--navy);
               display:flex;align-items:center;gap:6px;font-weight:600;
               box-shadow:0 1px 4px rgba(26,39,68,.07)">
        ← Volver
      </button>
      <div style="flex:1;min-width:0">
        <div style="font-family:'DM Serif Display',serif;font-size:1.15rem;color:var(--navy);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${esc(p.colegio||'—')}
        </div>
        <div style="font-size:.72rem;color:var(--g400);margin-top:1px">
          📋 ${esc(p.codigo)} &nbsp;·&nbsp; 🪆 ${p.total_alumnos} muñecos
          ${p.ciudad ? `&nbsp;·&nbsp; 📍 ${esc(p.ciudad)}` : ''}
        </div>
      </div>
    </div>

    <!-- Tarjetas de resumen -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      ${[
        { icon:'💰', label:'Total a cobrar', val: fmt(final),     color:'#1a2744' },
        { icon:'✅', label:'Cobrado',         val: fmt(pagado),    color:'#2e7d32' },
        { icon:'⏳', label:'Pendiente',       val: fmt(pendiente), color: pColor   },
      ].map(c => `
        <div style="background:#fff;border-radius:14px;padding:14px 12px;
                    box-shadow:0 2px 10px rgba(26,39,68,.07);text-align:center;
                    border-top:3px solid ${c.color}">
          <div style="font-size:1.1rem;margin-bottom:4px">${c.icon}</div>
          <div style="font-size:1.1rem;font-weight:700;color:${c.color};
                      font-family:'DM Serif Display',serif">${c.val}</div>
          <div style="font-size:.66rem;color:var(--g400);margin-top:2px">${c.label}</div>
        </div>`).join('')}
    </div>

    <!-- Barra de progreso -->
    <div style="background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:14px;
                box-shadow:0 2px 10px rgba(26,39,68,.07)">
      <div style="display:flex;justify-content:space-between;font-size:.78rem;
                  color:var(--g400);margin-bottom:8px">
        <span>Progreso de cobro</span><span style="font-weight:700;color:${pColor}">${pct}%</span>
      </div>
      <div style="height:10px;background:var(--g100);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${pColor};
                    border-radius:99px;transition:width .5s"></div>
      </div>
    </div>

    <!-- Desglose + Descuento -->
    <div style="background:#fff;border-radius:14px;padding:16px;margin-bottom:14px;
                box-shadow:0 2px 10px rgba(26,39,68,.07)">
      <div style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:12px">📋 Desglose</div>
      <div style="display:flex;justify-content:space-between;font-size:.84rem;
                  color:var(--g400);margin-bottom:6px">
        <span>${p.total_alumnos} muñecos × $${PRECIO_MUNECO}</span>
        <span style="font-weight:600;color:var(--navy)">${fmt(base)}</span>
      </div>
      ${desc > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:.84rem;
                  color:#e65100;margin-bottom:6px">
        <span>Descuento ${desc}%</span>
        <span>−${fmt(base * desc / 100)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:.88rem;font-weight:700;
                  color:var(--navy);border-top:1px solid var(--g100);padding-top:8px;margin-top:4px">
        <span>Total a cobrar</span><span>${fmt(final)}</span>
      </div>
      <!-- Campo descuento -->
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--g100);
                  display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:.8rem;color:var(--g400);font-weight:600">🔖 Descuento</span>
        <input type="number" min="0" max="100" value="${desc}" id="desc-${p.id}"
          style="width:64px;border:1px solid var(--g200);border-radius:8px;
                 padding:6px 8px;font-size:.84rem;text-align:center">
        <span style="font-size:.8rem;color:var(--g400)">%</span>
        <button onclick="guardarDescuento(${p.id})" class="btn btn-outline btn-sm">Aplicar</button>
      </div>
    </div>

    <!-- Historial de pagos -->
    <div style="background:#fff;border-radius:14px;padding:16px;margin-bottom:14px;
                box-shadow:0 2px 10px rgba(26,39,68,.07)">
      <div style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:12px">💳 Historial de pagos</div>
      <div style="display:flex;flex-direction:column;gap:8px">${pagosHTML}</div>
    </div>

    <!-- Registrar pago -->
    <div style="background:var(--navy);border-radius:14px;padding:16px;
                box-shadow:0 2px 10px rgba(26,39,68,.15)">
      <div style="font-size:.72rem;font-weight:700;color:rgba(255,255,255,.7);
                  text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px">
        ➕ Registrar pago
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.6);margin-bottom:4px">Tipo de pago</div>
          <select id="tipo-${p.id}"
            data-pendiente="${Math.round(pendiente)}"
            data-final="${Math.round(final)}"
            onchange="autoFillMonto(this,${p.id})"
            style="width:100%;border:none;border-radius:9px;padding:8px 10px;
                   font-size:.83rem;background:#fff;color:var(--navy)">
            <option value="anticipo_50">💵 Anticipo 50%</option>
            <option value="pago_final">✅ Pago final (saldo)</option>
            <option value="anticipo">✍️ Monto personalizado</option>
          </select>
        </div>
        <div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.6);margin-bottom:4px">Fecha</div>
          <input type="date" id="fechapago-${p.id}" value="${hoy}"
            style="width:100%;border:none;border-radius:9px;padding:8px 10px;
                   font-size:.83rem;background:#fff;color:var(--navy);box-sizing:border-box">
        </div>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:.72rem;color:rgba(255,255,255,.6);margin-bottom:4px">Monto $</div>
        <input type="number" min="1" id="monto-${p.id}" value="${Math.round(final * 0.5)}"
          placeholder="0.00"
          style="width:100%;border:none;border-radius:9px;padding:10px 12px;
                 font-size:1rem;font-weight:700;background:#fff;color:var(--navy);
                 box-sizing:border-box">
      </div>
      <button onclick="agregarPago(${p.id})"
        style="width:100%;background:#e91e8c;border:none;border-radius:10px;
               padding:12px;font-size:.88rem;font-weight:700;color:#fff;cursor:pointer">
        ➕ Registrar pago
      </button>
    </div>`;
}

function abrirFinDetalle(pedidoId) {
  window._finDetalleId = pedidoId;
  const p = (window._finanzasPedidos || []).find(x => x.id === pedidoId);
  if (!p) return;
  _renderFinDetalleEl(p);
  document.querySelector('.page-inner')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function _renderFinDetalleEl(p) {
  const el = document.getElementById('adminFinanzasContenido');
  if (!el) return;
  el.innerHTML = `<div style="padding:8px 2px">${_finDetalleHTML(p)}</div>`;
}

async function _refetchFinDetalle(pedidoId) {
  const r = await API.get('/api/pedidos/finanzas/resumen');
  if (!r.ok) return;
  window._finanzasPedidos = r.pedidos;
  const p = r.pedidos.find(x => x.id === pedidoId);
  if (p) _renderFinDetalleEl(p);
}

function cerrarFinDetalle() {
  window._finDetalleId = null;
  renderAdminFinanzas();
}

function filtrarFinanzas() {
  const todos  = window._finanzasPedidos || [];
  const buscar = (document.getElementById('finFiltColegio')?.value || '').toLowerCase();
  const ciudad = document.getElementById('finFiltCiudad')?.value || '';
  const estado = document.getElementById('finFiltEstado')?.value || '';
  const orden  = document.getElementById('finFiltOrden')?.value || '';
  const fmt    = n => '$' + Math.round(n).toLocaleString('es-MX');

  // Pre-calcular valores financieros
  const withFin = todos.map(p => {
    const pagos     = p.pagos || [];
    const base      = (p.total_alumnos || 0) * PRECIO_MUNECO;
    const final     = base * (1 - (p.descuento || 0) / 100);
    const pagado    = pagos.reduce((s, pg) => s + pg.monto, 0);
    const pendiente = final - pagado;
    return { ...p, _final: final, _pagado: pagado, _pendiente: pendiente };
  });

  // Filtrar
  let pedidos = withFin.filter(p => {
    if (buscar && !(p.colegio||'').toLowerCase().includes(buscar))        return false;
    if (ciudad && (p.ciudad||'').toLowerCase() !== ciudad)                return false;
    if (estado === 'pendiente' && p._pendiente <= 0)                      return false;
    if (estado === 'pagado'    && p._pendiente > 0)                       return false;
    if (estado === 'sin_pagos' && (p.pagos||[]).length > 0)               return false;
    return true;
  });

  // Ordenar
  if (orden === 'mayor_pendiente') pedidos.sort((a, b) => b._pendiente - a._pendiente);
  else if (orden === 'menor_pendiente') pedidos.sort((a, b) => a._pendiente - b._pendiente);

  const resumenEl = document.getElementById('finanzasResumen');
  const cartasEl  = document.getElementById('finanzasCartas');
  if (!resumenEl || !cartasEl) return;

  // Resumen de los pedidos filtrados
  let totalFac = 0, totalCob = 0;
  pedidos.forEach(p => { totalFac += p._final; totalCob += p._pagado; });
  const totalPend = totalFac - totalCob;

  resumenEl.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px">
      ${[
        { icon:'💰', label:'Total facturado', val: fmt(totalFac), color:'#2e7d32' },
        { icon:'✅', label:'Cobrado',          val: fmt(totalCob), color:'#1565c0' },
        { icon:'⏳', label:'Pendiente',        val: fmt(totalPend), color: totalPend > 0 ? '#e65100' : '#2e7d32' },
      ].map(c => `
        <div style="background:#fff;border-radius:16px;padding:16px 20px;box-shadow:0 2px 12px ${c.color}22;border-top:3px solid ${c.color};flex:1;min-width:130px">
          <div style="font-size:1.35rem">${c.icon}</div>
          <div style="font-size:1.3rem;font-weight:700;color:${c.color};font-family:'DM Serif Display',serif;margin-top:4px">${c.val}</div>
          <div style="font-size:.73rem;color:var(--g400);margin-top:2px">${c.label}</div>
        </div>`).join('')}
    </div>`;

  if (!pedidos.length) {
    cartasEl.innerHTML = `<div class="empty-state" style="padding:40px"><div class="emo">🔍</div><p>Sin resultados con esos filtros</p></div>`;
    return;
  }

  cartasEl.innerHTML = pedidos.map(p => _finCardHTML(p)).join('');
}

function autoFillMonto(sel, pedidoId) {
  const montoEl = document.getElementById(`monto-${pedidoId}`);
  if (!montoEl) return;
  if (sel.value === 'pago_final') {
    montoEl.value = sel.dataset.pendiente;
  } else if (sel.value === 'anticipo_50') {
    montoEl.value = Math.round(parseFloat(sel.dataset.final) * 0.5);
  } else {
    montoEl.value = '';
  }
}

function toggleFinCard(id) {
  const body = document.getElementById(`finbody-${id}`);
  const chev = document.getElementById(`finchev-${id}`);
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  if (chev) chev.textContent = open ? '▴' : '▾';
}

async function agregarPago(pedidoId) {
  const monto = parseFloat(document.getElementById(`monto-${pedidoId}`)?.value);
  const tipo  = document.getElementById(`tipo-${pedidoId}`)?.value || 'anticipo';
  const fecha = document.getElementById(`fechapago-${pedidoId}`)?.value;
  if (!monto || monto <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
  const r = await API.post(`/api/pedidos/${pedidoId}/pagos`, { monto, tipo, fecha });
  if (!r.ok) { showToast(r.msg, 'error'); return; }
  showToast('Pago registrado ✅', 'success');
  if (window._finDetalleId) _refetchFinDetalle(pedidoId);
  else renderAdminFinanzas();
}

async function guardarDescuento(pedidoId) {
  const desc = parseInt(document.getElementById(`desc-${pedidoId}`)?.value) || 0;
  const r = await API.put(`/api/pedidos/${pedidoId}/descuento`, { descuento: desc });
  if (!r.ok) { showToast(r.msg, 'error'); return; }
  showToast('Descuento aplicado ✅', 'success');
  if (window._finDetalleId) _refetchFinDetalle(pedidoId);
  else renderAdminFinanzas();
}

async function eliminarPago(pagoId, pedidoId) {
  if (!confirm('¿Eliminar este pago?')) return;
  const r = await API.delete(`/api/pedidos/pagos/${pagoId}`);
  if (!r.ok) { showToast(r.msg, 'error'); return; }
  showToast('Pago eliminado', 'success');
  if (window._finDetalleId) _refetchFinDetalle(pedidoId);
  else renderAdminFinanzas();
}

// ── Tab Usuarios ───────────────────────────────────────────────
async function renderAdminUsuariosTab() {
  const el = document.getElementById('adminUsuariosContenido');
  if (!el) return;
  const isAdmin = window.currentUser?.rol === 'admin';

  if (!isAdmin) {
    el.innerHTML = '<div class="empty-state" style="padding:48px"><div class="emo">🔒</div><p>Solo los administradores pueden gestionar usuarios.</p></div>';
    return;
  }

  el.innerHTML = '<div class="loading-state">Cargando usuarios…</div>';
  const r = await API.get('/api/usuarios');
  const usuarios = r.ok ? r.usuarios : [];
  window._usuariosLista = usuarios;

  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto">
      <h3 style="font-family:'DM Serif Display',serif;color:var(--navy);margin:0 0 16px;text-align:center">Usuarios</h3>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
        <button class="btn btn-primary" style="width:100%" onclick="abrirCrearUsuario('cliente')">🏫 Nueva Escuela</button>
        <button class="btn btn-outline" style="width:100%" onclick="abrirCrearUsuario('admin')">👑 Nuevo Admin</button>
        <button class="btn btn-outline" style="width:100%" onclick="abrirCrearUsuario('colaborador')">🤝 Nuevo Colaborador</button>
      </div>
      <div style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(26,39,68,.06);padding:10px 12px;margin-bottom:14px">
        <input class="at-filter-input" id="usFiltNombre" placeholder="🔍 Buscar por nombre o escuela…"
          oninput="filtrarUsuarios()" style="width:100%">
      </div>
      <div id="adminUsuariosLista" style="background:var(--g100);border-radius:20px;padding:12px;display:flex;flex-direction:column;gap:10px"></div>
    </div>`;

  filtrarUsuarios();
}

function filtrarUsuarios() {
  const usuarios = window._usuariosLista || [];
  const buscar   = (document.getElementById('usFiltNombre')?.value || '').toLowerCase();

  const filtered = usuarios.filter(u => {
    if (!buscar) return true;
    return (u.nombre||'').toLowerCase().includes(buscar) ||
           (u.colegio||'').toLowerCase().includes(buscar) ||
           (u.ciudad||'').toLowerCase().includes(buscar);
  });

  const el = document.getElementById('adminUsuariosLista');
  if (!el) return;

  el.innerHTML = filtered.length
    ? filtered.map(u => usuarioCardHTML(u)).join('')
    : '<p style="color:var(--g400);text-align:center;padding:20px">Sin coincidencias</p>';
}

// ── Gestión de usuarios ────────────────────────────────────────
async function renderAdminUsuarios() {
  const el = document.getElementById('adminUsuarios');
  if (!el) return;
  el.innerHTML = '<div class="loading-state">Cargando usuarios…</div>';

  const r = await API.get('/api/usuarios');
  if (!r.ok) { el.innerHTML = `<p style="color:red">${r.msg}</p>`; return; }

  const usuarios = r.usuarios;
  const admins  = usuarios.filter(u => u.rol === 'admin').length;
  const activos = usuarios.filter(u => u.activo).length;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div class="admin-stat"><div class="num">${usuarios.length}</div><div class="lbl">Total</div></div>
        <div class="admin-stat"><div class="num" style="color:var(--navy)">${admins}</div><div class="lbl">⚙️ Admins</div></div>
        <div class="admin-stat"><div class="num" style="color:#2e7d32">${activos}</div><div class="lbl">✅ Activos</div></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="abrirCrearUsuario()">➕ Nuevo usuario</button>
    </div>
    <div id="usuariosLista">
      ${usuarios.map(u => usuarioCardHTML(u)).join('')}
    </div>`;
}

function usuarioCardHTML(u) {
  const fecha = u.creado_en
    ? new Date(u.creado_en).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
    : '—';
  const nombre = u.nombre.replace(/'/g, "\\'");
  return `
    <div class="pedido-card" style="flex-direction:column;align-items:stretch;border:1px solid var(--g200)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div class="pc-info">
          <div class="pc-codigo">${u.nombre}
            <span class="estado-badge estado-${u.rol === 'admin' ? 'listo' : u.rol === 'colaborador' ? 'iniciando' : 'en_proceso'}" style="font-size:.7rem;margin-left:8px">
              ${u.rol === 'admin' ? '⚙️ Admin' : u.rol === 'colaborador' ? '🤝 Colaborador' : '🏫 Escuela'}
            </span>
            ${!u.activo ? '<span class="estado-badge estado-cancelado" style="font-size:.7rem;margin-left:4px">❌ Inactivo</span>' : ''}
          </div>
          ${u.email ? `<div class="pc-meta">✉️ ${u.email}</div>` : ''}
          <div class="pc-meta">
            ${u.telefono ? `📱 ${u.telefono}` : ''}
            ${u.ciudad   ? ` · 🏙️ ${u.ciudad}` : ''}
            ${u.colegio  ? ` · 🏫 ${u.colegio}` : ''}
          </div>
          ${(u.direccion || u.colonia || u.cp || u.estado) ? `
          <div class="pc-meta" style="margin-top:4px">
            📦 ${[u.direccion, u.colonia, u.cp ? `CP ${u.cp}` : '', u.estado].filter(Boolean).map(s => esc(s)).join(' · ')}
            ${u.referencias ? `<br><span style="font-size:.72rem;color:var(--g400)">📍 ${esc(u.referencias)}</span>` : ''}
          </div>` : ''}
          <div class="pc-meta" style="font-size:.72rem;color:var(--g400)">Creado: ${fecha}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="editarUsuario(${u.id})">✏️ Editar</button>
          <button class="btn btn-outline btn-sm" style="color:#c62828;border-color:#c62828"
            onclick="eliminarUsuario(${u.id}, '${nombre}')">🗑️ Eliminar</button>
        </div>
      </div>
    </div>`;
}

function abrirCrearUsuario(rol = 'cliente') {
  const esEscuela = rol === 'cliente';
  const titulo    = esEscuela ? '🏫 Nueva Escuela' : rol === 'admin' ? '👑 Nuevo Admin' : '🤝 Nuevo Colaborador';
  const labelNombre = esEscuela ? 'Nombre de escuela' : 'Nombre completo';
  document.getElementById('modalContent').innerHTML = `
    <h3 style="font-family:'DM Serif Display',serif;color:var(--navy);margin-bottom:20px">${titulo}</h3>
    <input type="hidden" id="uRol" value="${rol}">
    <div class="field" style="margin-bottom:14px"><label>${labelNombre} <span class="req">*</span></label>
      <input type="text" id="uColegio" placeholder="${esEscuela ? 'Nombre del colegio' : 'Nombre completo'}"></div>
    <div class="field" style="margin-bottom:14px"><label>Contraseña <span class="req">*</span></label>
      <input type="password" id="uPass" placeholder="Mínimo 6 caracteres"></div>
    <div id="uError" class="auth-error" style="display:none"></div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-primary" id="btnGuardarU" onclick="guardarNuevoUsuario()">💾 Crear</button>
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    </div>`;
  openModal();
}

async function guardarNuevoUsuario() {
  const errEl   = document.getElementById('uError');
  const colegio = document.getElementById('uColegio').value.trim();
  const password = document.getElementById('uPass').value;
  const rol     = document.getElementById('uRol')?.value || 'cliente';

  if (!colegio || !password) {
    errEl.textContent = 'Nombre y contraseña son requeridos';
    errEl.style.display = ''; return;
  }
  if (password.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
    errEl.style.display = ''; return;
  }

  const slug   = colegio.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const email  = `${slug}_${Date.now()}@escuela.mx`;
  const nombre = colegio;
  const body   = { nombre, email, password, rol };
  if (rol === 'cliente') body.colegio = colegio;

  const btn = document.getElementById('btnGuardarU');
  btn.disabled = true; btn.textContent = 'Guardando…';
  const r = await API.post('/api/usuarios', body);
  btn.disabled = false; btn.textContent = '💾 Crear';

  if (!r.ok) { errEl.textContent = r.msg; errEl.style.display = ''; return; }
  closeModal();
  showToast('Creado ✅', 'success');
  renderAdminUsuariosTab();
}

async function editarUsuario(id) {
  const r = await API.get('/api/usuarios');
  if (!r.ok) return showToast(r.msg, 'error');
  const u = r.usuarios.find(u => u.id === id);
  if (!u) return showToast('Usuario no encontrado', 'error');

  document.getElementById('modalContent').innerHTML = `
    <h3 style="font-family:'DM Serif Display',serif;color:var(--navy);margin-bottom:20px">✏️ Editar Usuario</h3>
    <div class="fields-grid2">
      <div class="field"><label>Nombre completo</label>
        <input type="text" id="euNombre" value="${u.nombre||''}"></div>
      <div class="field"><label>Correo electrónico</label>
        <input type="email" id="euEmail" value="${u.email||''}"></div>
      <div class="field" style="grid-column:span 2;background:#fff8e1;border:1px solid #ffe082;border-radius:10px;padding:12px">
        <label style="color:#795548">🔑 Cambiar contraseña
          <span style="font-size:.75rem;color:var(--g400);font-weight:400">(dejar vacío para no cambiar)</span></label>
        <input type="password" id="euPass" placeholder="Nueva contraseña (mín. 6 caracteres)"
          style="margin-top:6px"></div>
      <div class="field"><label>Rol</label>
        <select id="euRol">
          <option value="cliente"     ${u.rol==='cliente'     ?'selected':''}>🏫 Escuela</option>
          <option value="colaborador" ${u.rol==='colaborador' ?'selected':''}>🤝 Colaborador</option>
          <option value="admin"       ${u.rol==='admin'       ?'selected':''}>⚙️ Admin</option>
        </select></div>
      <div class="field"><label>Teléfono</label>
        <input type="tel" id="euTel" value="${u.telefono||''}" maxlength="10"
          oninput="this.value=this.value.replace(/\\D/g,'')"></div>
      <div class="field"><label>Colegio</label>
        <input type="text" id="euColegio" value="${u.colegio||''}"></div>
    </div>

    ${u.rol === 'cliente' ? `
    <div class="divider" style="margin:14px 0 12px"></div>
    <p style="font-size:.75rem;font-weight:700;color:var(--navy);margin-bottom:10px;text-transform:uppercase;letter-spacing:.04em">📦 Datos de envío</p>
    <div class="fields-grid2">
      <div class="field"><label>Ciudad</label>
        <input type="text" id="euCiudad" value="${u.ciudad||''}" placeholder="Ej: Monterrey"></div>
      <div class="field"><label>Estado</label>
        <input type="text" id="euEstado" value="${u.estado||''}" placeholder="Ej: Nuevo León"></div>
      <div class="field"><label>Colonia / Fraccionamiento</label>
        <input type="text" id="euColonia" value="${u.colonia||''}" placeholder="Nombre de colonia"></div>
      <div class="field"><label>Código postal</label>
        <input type="text" id="euCp" value="${u.cp||''}" maxlength="5" placeholder="00000"
          oninput="this.value=this.value.replace(/\\D/g,'')"></div>
      <div class="field" style="grid-column:span 2"><label>Dirección (calle y número)</label>
        <input type="text" id="euDireccion" value="${u.direccion||''}" placeholder="Ej: Av. Constitución 456"></div>
      <div class="field" style="grid-column:span 2"><label>Referencias</label>
        <input type="text" id="euReferencias" value="${u.referencias||''}" placeholder="Entre calles, puntos de referencia…"></div>
    </div>` : ''}
    <div class="fields-grid2" style="margin-top:12px">
      <div class="field" style="grid-column:span 2">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400">
          <input type="checkbox" id="euActivo" ${u.activo?'checked':''}>
          Cuenta activa
        </label>
      </div>
    </div>
    <div id="euError" class="auth-error" style="display:none"></div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-primary" id="btnGuardarEU" onclick="guardarEditUsuario(${id})">💾 Guardar cambios</button>
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    </div>`;
  openModal();
}

async function guardarEditUsuario(id) {
  const errEl   = document.getElementById('euError');
  const nombre   = document.getElementById('euNombre').value.trim();
  const email    = document.getElementById('euEmail').value.trim();
  const password = document.getElementById('euPass').value;
  const rol      = document.getElementById('euRol').value;
  const telefono   = document.getElementById('euTel')?.value.trim()        || '';
  const colegio    = document.getElementById('euColegio')?.value.trim()    || '';
  const ciudad     = document.getElementById('euCiudad')?.value.trim()     || '';
  const estado     = document.getElementById('euEstado')?.value.trim()     || '';
  const colonia    = document.getElementById('euColonia')?.value.trim()    || '';
  const cp         = document.getElementById('euCp')?.value.trim()         || '';
  const direccion  = document.getElementById('euDireccion')?.value.trim()  || '';
  const referencias = document.getElementById('euReferencias')?.value.trim() || '';
  const activo     = document.getElementById('euActivo').checked;

  const body = { nombre, email, telefono, colegio, ciudad, estado, colonia, cp, direccion, referencias, rol, activo };
  if (password) body.password = password;

  const btn = document.getElementById('btnGuardarEU');
  btn.disabled = true; btn.textContent = 'Guardando…';
  const r = await API.put(`/api/usuarios/${id}`, body);
  btn.disabled = false; btn.textContent = '💾 Guardar cambios';

  if (!r.ok) { errEl.textContent = r.msg; errEl.style.display = ''; return; }
  closeModal();
  showToast('Usuario actualizado ✅', 'success');
  renderAdminUsuariosTab();
}

async function eliminarUsuario(id, nombre) {
  if (!confirm(`¿Eliminar al usuario "${nombre}"?\nEsta acción no se puede deshacer.`)) return;
  const r = await API.delete(`/api/usuarios/${id}`);
  if (!r.ok) return showToast(r.msg, 'error');
  showToast('Usuario eliminado', 'success');
  renderAdminUsuariosTab();
}
