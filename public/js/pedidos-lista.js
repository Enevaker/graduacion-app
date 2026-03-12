// public/js/pedidos-lista.js — Lista de pedidos del cliente + detalle

let todosLosPedidos  = [];
let currentAlumnos   = [];
let filtroTab        = 'uniforme';
let filtrosPanelOpen = false;
let statsGlobal      = null;
let _pedListAvances  = [];

const FILTROS_INIT = {
  zapato: '', calceta: '', monos: '', pantalon: '', pelo: ''
};
let filtros = { ...FILTROS_INIT };

// ── Lista principal ────────────────────────────────────────────
async function renderPedidosLista() {
  document.getElementById('pedidosLista').innerHTML = '<div class="loading-state">Cargando pedidos…</div>';
  const [r, rAv] = await Promise.all([
    API.get('/api/pedidos'),
    API.get('/api/escuelas/mis-avances'),
  ]);
  if (!r.ok) return showToast(r.msg, 'error');
  if (rAv.ok) _pedListAvances = rAv.avances || [];
  todosLosPedidos = r.pedidos;
  window.todosLosPedidosRef = todosLosPedidos;

  // ── Auto-refresh silencioso cada 60 s ──────────────────────
  if (window._pedidosRefreshTimer) clearInterval(window._pedidosRefreshTimer);
  window._pedidosRefreshTimer = setInterval(async () => {
    const pg = document.getElementById('page-pedidos');
    if (!pg || pg.style.display === 'none') return;
    const [rr, rrAv] = await Promise.all([
      API.get('/api/pedidos'),
      API.get('/api/escuelas/mis-avances'),
    ]);
    if (!rr.ok) return;
    todosLosPedidos = rr.pedidos;
    window.todosLosPedidosRef = todosLosPedidos;
    if (rrAv.ok) _pedListAvances = rrAv.avances || [];
    _renderPedidosList();
  }, 60000);

  _renderPedidosList();
}

function _renderPedidosList() {
  const el = document.getElementById('pedidosLista');
  if (!todosLosPedidos.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:60px 20px">
        <div class="emo" style="font-size:3rem;margin-bottom:12px">📋</div>
        <p style="font-size:1rem;font-weight:600;color:var(--navy);margin-bottom:6px">Aún no tienes pedidos</p>
        <p style="color:var(--g400)">Usa el botón "Nuevo Pedido" para crear tu primer pedido.</p>
      </div>`;
    return;
  }
  el.innerHTML = `<div class="pedidos-grid">${todosLosPedidos.map(p => pedidoCardHTML(p)).join('')}</div>`;
}

// ── Panel de filtros HTML ──────────────────────────────────────
function filtrosPanelHTML() {
  const CALCETA  = ['Blanco','Marino','Rojo','Verde botella','Azul plumbago','Beige','Negro','Gris','Rosa','Café'];
  const PANTALON = ['Negro','Marino','Gris','Caqui','Café','Verde botella','Beige'];
  const MONOS    = ['Blanco','Rosa','Azul','Rojo','Negro','Morado','Verde','Beige'];

  const sel = (id, key, opts) => `
    <select id="ff-${id}" data-fkey="${key}" onchange="setFiltro('${key}',this.value)">
      <option value="">Todos</option>
      ${opts.map(o => `<option>${o}</option>`).join('')}
    </select>`;

  return `
  <div class="filtros-wrap">
    <button class="filtros-toggle" onclick="toggleFiltros()">
      🔍 Filtros
      <span class="filtros-badge" id="filtrosBadge" style="display:none">0</span>
      <span class="filtros-chev" id="filtrosChev">▾</span>
    </button>

    <div class="filtros-panel" id="filtrosPanel" style="display:none">
      <div class="ftabs">
        <button class="ftab ftab-active" id="ftab-uniforme" onclick="setFiltroTab('uniforme')">🎒 Uniforme</button>
        <button class="ftab"             id="ftab-resumen"  onclick="setFiltroTab('resumen')">📊 Resumen</button>
      </div>

      <!-- UNIFORME (combinado) -->
      <div id="fcon-uniforme" class="ftab-content">
        <div class="filtros-grid">
          <div class="f-field"><label>ZAPATO</label>${sel('zapato','zapato',['Negro','Café','Blanco','Azul marino','Rojo','Verde botella','Azul plumbago','Beige'])}</div>
          <div class="f-field"><label>CALCETA</label>${sel('calceta','calceta',CALCETA)}</div>
          <div class="f-field"><label>MOÑOS</label>${sel('monos','monos',MONOS)}</div>
          <div class="f-field"><label>PANTALÓN</label>${sel('pantalon','pantalon',PANTALON)}</div>
          <div class="f-field">
            <label>PELO</label>
            <select id="ff-pelo" data-fkey="pelo" onchange="setFiltro('pelo',this.value)">
              <option value="">Todos</option>
              <option value="castaño">🟫 Castaño</option>
              <option value="tabaco">🤎 Tabaco</option>
              <option value="rubio">💛 Rubio</option>
              <option value="pelirrojo">🟠 Pelirrojo</option>
            </select>
          </div>
        </div>
      </div>

      <!-- RESUMEN -->
      <div id="fcon-resumen" class="ftab-content" style="display:none">
        ${statsResumenHTML()}
      </div>

      <div class="filtros-foot">
        <button class="btn btn-outline btn-sm" onclick="limpiarFiltros()">✕ Limpiar</button>
        <span class="filtros-result" id="filtrosResult"></span>
      </div>
    </div>
  </div>`;
}

// ── Controles de filtros ───────────────────────────────────────
function toggleFiltros() {
  filtrosPanelOpen = !filtrosPanelOpen;
  const panel = document.getElementById('filtrosPanel');
  const chev  = document.getElementById('filtrosChev');
  if (panel) panel.style.display = filtrosPanelOpen ? 'block' : 'none';
  if (chev)  chev.style.transform = filtrosPanelOpen ? 'rotate(180deg)' : '';
}

function setFiltroTab(tab) {
  filtroTab = tab;
  ['uniforme','resumen'].forEach(t => {
    document.getElementById(`ftab-${t}`)?.classList.toggle('ftab-active', t === tab);
    const con = document.getElementById(`fcon-${t}`);
    if (con) con.style.display = t === tab ? 'block' : 'none';
  });
}

function setFiltro(key, val) {
  filtros[key] = val;
  aplicarFiltros();
  actualizarBadge();
}

function limpiarFiltros() {
  filtros = { ...FILTROS_INIT };
  document.querySelectorAll('[data-fkey]').forEach(el => { el.value = ''; });
  aplicarFiltros();
  actualizarBadge();
}

function aplicarFiltros() {
  const grid    = document.getElementById('pedidosGrid');
  const empty   = document.getElementById('filtrosEmpty');
  const resumen = document.getElementById('filtrosResumen');
  if (!grid) return;

  const hayFiltros = Object.values(filtros).some(v => v);

  // Sin filtros activos → vista normal de cards
  if (!hayFiltros) {
    grid.style.display = '';
    if (empty)   empty.style.display   = 'none';
    if (resumen) resumen.style.display = 'none';
    grid.innerHTML = todosLosPedidos.map(p => pedidoCardHTML(p)).join('');
    const res = document.getElementById('filtrosResult');
    if (res) res.textContent = '';
    return;
  }

  // Dos listas separadas: niñas (sin pantalón) y niños (sin moños)
  const reNinas = todosLosPedidos.filter(matchFiltrosNinas);
  const reNinos = todosLosPedidos.filter(matchFiltrosNinos);

  const idsNinas = new Set(reNinas.map(p => p.id));
  const idsNinos = new Set(reNinos.map(p => p.id));
  const union    = todosLosPedidos.filter(p => idsNinas.has(p.id) || idsNinos.has(p.id));

  const totalNinas = reNinas.reduce((s, p) => s + (p.total_ninas || 0), 0);
  const totalNinos = reNinos.reduce((s, p) => s + (p.total_ninos || 0), 0);
  const total      = totalNinas + totalNinos;

  // Con filtros → ocultar grid de cards
  grid.style.display = 'none';

  if (!union.length) {
    if (empty)   empty.style.display   = 'block';
    if (resumen) resumen.style.display = 'none';
  } else {
    if (empty) empty.style.display = 'none';

    if (resumen) {
      resumen.style.display = 'block';
      resumen.innerHTML = `
        <div class="fresumen-stats">
          <div class="fresumen-stat fresumen-nino">
            <div class="fresumen-num">${totalNinos}</div>
            <div class="fresumen-lbl">👦 Niños</div>
          </div>
          <div class="fresumen-stat fresumen-nina">
            <div class="fresumen-num">${totalNinas}</div>
            <div class="fresumen-lbl">👧 Niñas</div>
          </div>
          <div class="fresumen-stat fresumen-total">
            <div class="fresumen-num">${total}</div>
            <div class="fresumen-lbl">Total alumnos</div>
          </div>
        </div>
        <div class="fresumen-pedidos">
          <p class="fresumen-sub">${union.length} pedido${union.length !== 1 ? 's' : ''} coinciden</p>
          ${union.map(p => {
            const ninas = idsNinas.has(p.id) ? p.total_ninas : 0;
            const ninos = idsNinos.has(p.id) ? p.total_ninos : 0;
            return `
            <div class="fresumen-row">
              <span class="fresumen-codigo">📋 ${p.codigo}</span>
              <span class="fresumen-colegio">${p.colegio || '—'}</span>
              <span class="fresumen-count">👧 ${ninas}  👦 ${ninos}</span>
              <button class="btn btn-outline btn-sm" onclick="verDetalle(${p.id})">Ver</button>
            </div>`;
          }).join('')}
        </div>`;
    }
  }

  const res = document.getElementById('filtrosResult');
  if (res) res.textContent = `${union.length} pedidos · 👧 ${totalNinas} niñas · 👦 ${totalNinos} niños`;
}

function matchFiltros(p) {
  const has = (field, val) => !val || (field || '').toLowerCase().includes(val.toLowerCase());

  if (filtros.zapato && !has(p.zapato_nino, filtros.zapato) && !has(p.zapato_nina, filtros.zapato)) return false;
  if (!has(p.calceta,     filtros.calceta))  return false;
  if (!has(p.monos,       filtros.monos))    return false;
  if (!has(p.pantalon,    filtros.pantalon)) return false;
  if (!has(p.pelos_ninos, filtros.pelo))     return false;

  return true;
}

// Sin moños (campo exclusivo de niñas) → para contar niños
function matchFiltrosNinos(p) {
  const has = (field, val) => !val || (field || '').toLowerCase().includes(val.toLowerCase());

  if (filtros.zapato && !has(p.zapato_nino, filtros.zapato) && !has(p.zapato_nina, filtros.zapato)) return false;
  if (!has(p.calceta,     filtros.calceta))  return false;
  if (!has(p.pantalon,    filtros.pantalon)) return false;
  if (!has(p.pelos_ninos, filtros.pelo))     return false;

  return true;
}

// Sin pantalón (campo exclusivo de niños) → para contar niñas
function matchFiltrosNinas(p) {
  const has = (field, val) => !val || (field || '').toLowerCase().includes(val.toLowerCase());

  if (filtros.zapato && !has(p.zapato_nino, filtros.zapato) && !has(p.zapato_nina, filtros.zapato)) return false;
  if (!has(p.calceta, filtros.calceta)) return false;
  if (!has(p.monos,   filtros.monos))   return false;
  if (!has(p.pelos_ninos, filtros.pelo)) return false;

  return true;
}

function actualizarBadge() {
  const n = Object.values(filtros).filter(v => v).length;
  const badge = document.getElementById('filtrosBadge');
  if (badge) {
    badge.style.display = n ? 'inline-flex' : 'none';
    badge.textContent = n;
  }
}

// ── Tarjeta de pedido ──────────────────────────────────────────
function pedidoCardHTML(p) {
  const fecha      = p.creado_en ? new Date(p.creado_en).toLocaleDateString('es-MX',
    { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const porcentaje = estadoPct(p.estado);
  const barColor   = pctColor(porcentaje);
  const estadoHint = escEstadoLabel(p.estado);

  const pedAvances = _pedListAvances.filter(a => a.pedido_id === p.id);
  const avancesHTML = pedAvances.map(a => {
    const src = a.filename ? `/uploads/avances/${esc(a.filename)}` : null;
    return `
      <div class="esc-avance-item">
        <div class="esc-avance-meta">
          <span class="esc-avance-fecha">📅 ${fmtFechaEsc(a.creado_en)}</span>
        </div>
        ${a.mensaje ? `<p class="esc-avance-msg">${esc(a.mensaje)}</p>` : ''}
        ${src ? `<img class="esc-avance-img" src="${src}" onclick="escVerImagen('${src}')">` : ''}
      </div>`;
  }).join('');

  return `
    <div class="pedido-card">
      <div class="pc-info">
        <div class="pc-codigo">📋 ${p.codigo}</div>
        <div class="pc-colegio">${p.colegio || '—'}</div>
        <div class="pc-meta">
          ${p.ciudad || ''} · ${p.grado || ''} · ${p.total_alumnos} alumnos
          (${p.total_ninas} 👧 ${p.total_ninos} 👦) · Entrega: ${p.fecha_entrega || '—'}
        </div>
        <div class="pc-meta" style="margin-top:3px">${fecha}</div>
      </div>
      <div class="pc-actions">
        <span class="estado-badge estado-${p.estado}">${estadoLabel(p.estado)}</span>
        <button class="btn btn-outline btn-sm" onclick="verDetalle(${p.id})">Ver detalle</button>
        <a class="btn btn-outline btn-sm" href="/api/pedidos/${p.id}/excel" target="_blank">📊 Excel</a>
      </div>
      <div class="pc-progress-section">
        <div class="esc-progreso">
          <div class="esc-pbar-header">
            <span class="esc-pbar-label">📊 Progreso del pedido</span>
            <span class="esc-pbar-pct" style="color:${barColor}">${porcentaje}%</span>
          </div>
          <div class="esc-pbar-track">
            <div class="esc-pbar-fill" style="width:${porcentaje}%;background:${barColor}"></div>
          </div>
          <p class="esc-pbar-estado-hint">${estadoHint}</p>
        </div>
        ${pedAvances.length ? `
          <div class="esc-avances" style="margin-top:10px">
            <div class="esc-avances-title">📝 Actualizaciones del equipo</div>
            ${avancesHTML}
          </div>
        ` : ''}
      </div>
    </div>`;
}

// ── Detalle de un pedido ───────────────────────────────────────
async function verDetalle(id) {
  const r = await API.get(`/api/pedidos/${id}`);
  if (!r.ok) return showToast(r.msg, 'error');
  const { pedido: p, alumnos } = r;

  currentAlumnos = alumnos;
  const ninas = alumnos.filter(a => a.tipo === 'niña');
  const ninos = alumnos.filter(a => a.tipo === 'niño');

  document.getElementById('detalleTitulo').textContent = `Pedido ${p.codigo}`;
  document.getElementById('detalleAcciones').innerHTML = `
    <button class="btn-volver" onclick="goTo('pedidos')">← Volver</button>
    <span class="estado-badge estado-${p.estado}">${estadoLabel(p.estado)}</span>
    <a class="btn btn-outline btn-sm" href="/api/pedidos/${p.id}/excel" target="_blank">📊 Excel</a>`;

  document.getElementById('detalleContenido').innerHTML = `
    <div class="detalle-grid">
      <div class="detalle-sec">
        <h4>📋 Datos Generales</h4>
        ${kv('Ciudad', p.ciudad)} ${kv('Fecha pedido', p.fecha_pedido)}
        ${kv('Grado', p.grado)}
      </div>
      <div class="detalle-sec">
        <h4>🏫 Cliente / Escuela</h4>
        ${kv('Contacto', p.contacto)} ${kv('Colegio', p.colegio)}
        ${kv('Teléfono', p.telefono)} ${kv('Email', p.email)}
      </div>
      <div class="detalle-sec">
        <h4>👗 Uniforme</h4>
        ${kv('Calceta niñas', p.calceta)} ${kv('Zapato niñas', p.zapato_nina)}
        ${kv('Moños', p.monos)} ${kv('Zapato niño', p.zapato_nino)}
        ${kv('Pantalón', p.pantalon)} ${kv('Escudos bordado', p.escudos)}
      </div>
      <div class="detalle-sec">
        <h4>📅 Entrega</h4>
        ${kv('Fecha', p.fecha_entrega)} ${kv('Tipo', p.tipo_entrega === 'domicilio' ? 'Envío a domicilio' : 'Ocurre')}
        ${p.tipo_entrega === 'domicilio' ? `
          ${kv('Destinatario', p.destinatario)} ${kv('Teléfono', p.tel_envio)}
          ${kv('C.P.', p.cp)} ${kv('Colonia', p.colonia)}
          ${kv('Dirección', p.direccion)}` : ''}
      </div>
    </div>

    <!-- Filtro dentro del pedido -->
    <div class="detalle-search">
      <span style="font-size:.75rem;font-weight:700;color:var(--navy-soft);white-space:nowrap">🔍 Buscar alumno:</span>
      <input type="text" id="dSearchNombre" placeholder="Nombre…"
        oninput="filtrarAlumnosDetalle()" style="flex:1;min-width:120px">
      <select id="dSearchPelo" onchange="filtrarAlumnosDetalle()" style="flex:1;min-width:130px">
        <option value="">Todos los pelos</option>
        <option value="castaño">🟫 Castaño</option>
        <option value="tabaco">🤎 Tabaco</option>
        <option value="rubio">💛 Rubio</option>
        <option value="pelirrojo">🟠 Pelirrojo</option>
      </select>
      <select id="dSearchTipo" onchange="filtrarAlumnosDetalle()" style="flex:0 0 auto">
        <option value="">Todos</option>
        <option value="niña">👧 Solo niñas</option>
        <option value="niño">👦 Solo niños</option>
      </select>
    </div>

    <div class="detalle-alumnos-grid">
      <div class="detalle-sec">
        <h4 style="color:var(--rose)">👧 Niñas (<span id="cntNinasD">${ninas.length}</span>)</h4>
        <div id="tbNinasD">${tablaAlumnos(ninas, 'niña')}</div>
      </div>
      <div class="detalle-sec">
        <h4 style="color:var(--navy)">👦 Niños (<span id="cntNinosD">${ninos.length}</span>)</h4>
        <div id="tbNinosD">${tablaAlumnos(ninos, 'niño')}</div>
      </div>
    </div>`;

  showPage('detalle');
}

// ── Filtro dentro del detalle ──────────────────────────────────
function filtrarAlumnosDetalle() {
  const nombre = (document.getElementById('dSearchNombre')?.value || '').toLowerCase();
  const pelo   = document.getElementById('dSearchPelo')?.value  || '';
  const tipo   = document.getElementById('dSearchTipo')?.value  || '';

  const filtrar = lista => lista.filter(a =>
    (!nombre || a.nombre.toLowerCase().includes(nombre)) &&
    (!pelo   || a.pelo === pelo)
  );

  const ninas = filtrar(currentAlumnos.filter(a => a.tipo === 'niña' && (!tipo || tipo === 'niña')));
  const ninos = filtrar(currentAlumnos.filter(a => a.tipo === 'niño' && (!tipo || tipo === 'niño')));

  const tbN = document.getElementById('tbNinasD');
  const tbM = document.getElementById('tbNinosD');
  if (tbN) tbN.innerHTML = tablaAlumnos(ninas, 'niña');
  if (tbM) tbM.innerHTML = tablaAlumnos(ninos, 'niño');
  const cntN = document.getElementById('cntNinasD');
  const cntM = document.getElementById('cntNinosD');
  if (cntN) cntN.textContent = ninas.length;
  if (cntM) cntM.textContent = ninos.length;
}

// ── Resumen de stats ───────────────────────────────────────────
function statsResumenHTML() {
  if (!statsGlobal) return '<p style="color:var(--g400);font-size:.85rem;padding:8px 0">Sin datos aún.</p>';
  const { por_pelo = {}, por_tipo = {} } = statsGlobal;
  const PELO = { castaño: '🟫 Castaño', tabaco: '🤎 Tabaco', rubio: '💛 Rubio', pelirrojo: '🟠 Pelirrojo' };
  const total = (por_tipo.niña || 0) + (por_tipo.niño || 0);

  const peloRows = Object.entries(PELO).map(([k, label]) => {
    const n = por_pelo[k] || 0;
    const pct = total ? Math.round(n / total * 100) : 0;
    return `
      <div class="sresumen-row">
        <span class="sresumen-lbl">${label}</span>
        <div class="sresumen-bar-wrap">
          <div class="sresumen-bar" style="width:${pct}%"></div>
        </div>
        <span class="sresumen-val">${n}</span>
      </div>`;
  }).join('');

  return `
    <div class="sresumen-grid">
      <div class="sresumen-card nina-card">
        <div class="sresumen-num">${por_tipo.niña || 0}</div>
        <div class="sresumen-key">👧 Niñas</div>
      </div>
      <div class="sresumen-card nino-card">
        <div class="sresumen-num">${por_tipo.niño || 0}</div>
        <div class="sresumen-key">👦 Niños</div>
      </div>
      <div class="sresumen-card total-card">
        <div class="sresumen-num">${total}</div>
        <div class="sresumen-key">Total alumnos</div>
      </div>
    </div>
    <p class="sresumen-pelo-titulo">Color de pelo (todos los pedidos)</p>
    <div class="sresumen-pelo">${peloRows}</div>`;
}

// ── Helpers ────────────────────────────────────────────────────
const PELO_COLOR = {
  castaño:   { bg: '#efebe9', fg: '#4e342e', dot: '🟫' },
  tabaco:    { bg: '#fbe9e7', fg: '#6d4c41', dot: '🤎' },
  rubio:     { bg: '#fff8e1', fg: '#f57f17', dot: '💛' },
  pelirrojo: { bg: '#fce4ec', fg: '#c62828', dot: '🟠' },
};

function peloChip(pelo) {
  const c = PELO_COLOR[pelo];
  if (!c) return pelo || '—';
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;background:${c.bg};color:${c.fg};font-weight:600;font-size:.78rem">${c.dot} ${pelo}</span>`;
}

function tablaAlumnos(lista, tipo) {
  if (!lista.length) return '<p style="color:var(--g400);font-size:.82rem;padding:8px 0">—</p>';
  const numColor = tipo === 'niña' ? 'var(--rose)' : 'var(--navy)';
  return `<table style="font-size:.82rem;width:100%;border-collapse:collapse">
    <thead><tr style="background:var(--g100)">
      <th style="padding:6px 8px;text-align:left;color:var(--g400);font-size:.7rem">#</th>
      <th style="padding:6px 8px;text-align:left;color:var(--g400);font-size:.7rem">NOMBRE</th>
      <th style="padding:6px 8px;text-align:left;color:var(--g400);font-size:.7rem">PELO</th>
    </tr></thead>
    <tbody>${lista.map((a, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : 'var(--g50,#fafafa)'}">
      <td style="padding:6px 8px;border-bottom:1px solid var(--g100);font-weight:700;color:${numColor}">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid var(--g100);font-weight:500;color:var(--navy)">${a.nombre}</td>
      <td style="padding:6px 8px;border-bottom:1px solid var(--g100)">${peloChip(a.pelo)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function kv(key, val) {
  return `<div class="kv-row"><span class="kv-key">${key}</span><span class="kv-val">${val||'—'}</span></div>`;
}

function estadoLabel(e) {
  return {
    iniciando:         '🔔 Iniciando',
    consiguiendo_tela: '🔍 Consiguiendo tela',
    tela_conseguida:   '🧵 Tela conseguida',
    cortando_tela:     '✂️ Cortando tela',
    bordando:          '🪡 Bordando',
    cosiendo:          '🧶 Cosiendo',
    rellenando:        '🪢 Rellenando',
    vistiendo:         '👗 Vistiendo',
    sesion_fotos:      '📸 Sesión de fotos',
    empacando:         '📦 Empacando',
    terminado:         '✅ Terminado',
    enviado:           '🚚 Enviado',
    // legacy
    recibido:          '📥 Pedido recibido',
    pendiente:         '⏳ Pendiente',
    en_proceso:        '🔧 En proceso',
    listo:             '✅ Listo',
    cancelado:         '❌ Cancelado',
  }[e] || e;
}
