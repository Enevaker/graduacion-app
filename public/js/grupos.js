// public/js/grupos.js — Página "Mis Grupos"

const NIVEL_ICONS = {
  preescolar: '🌟', primaria: '📚', secundaria: '🎒',
  preparatoria: '🎓', maestro: '👨‍🏫', coordinador: '📋'
};

const ESTADO_LABELS_G = {
  recibido:'Recibido', iniciando:'Iniciando', buscando_tela:'Buscando tela',
  tela_conseguida:'Tela lista', haciendo_uniformes:'En producción', vistiendo:'Vistiendo',
  empaquetando:'Empaquetando', listos:'Listos', enviando:'Enviando',
  en_paqueteria:'En paquetería', entregado:'Entregado',
  pendiente:'Pendiente', en_proceso:'En proceso', listo:'Listo', cancelado:'Cancelado'
};

async function renderGrupos() {
  const contenido = document.getElementById('gruposContenido');
  if (!contenido) return;
  contenido.innerHTML = '<div class="loading-state">Cargando grupos…</div>';

  const r = await API.get('/api/grupos');

  if (!r.ok) {
    contenido.innerHTML = `<div class="empty-state"><div class="emo">⚠️</div><p>${esc(r.msg || 'Error al cargar')}</p></div>`;
    return;
  }

  if (!r.grupos.length) {
    contenido.innerHTML = `
      <div class="empty-state" style="padding:56px 20px">
        <div class="emo" style="font-size:3rem">🎒</div>
        <p style="font-size:1rem;font-weight:600;color:var(--navy);margin:10px 0 6px">Aún no tienes grupos</p>
        <p style="max-width:280px;margin:0 auto">Se crearán automáticamente al hacer tu primer pedido de muñecos.</p>
      </div>`;
    return;
  }

  contenido.innerHTML = `<div class="grupos-list">${r.grupos.map(g => grupoItemHTML(g)).join('')}</div>`;
}

function grupoItemHTML(g) {
  const peds = g.pedidos || [];
  const pedsHTML = peds.length
    ? peds.map(p => {
        const pct   = p.porcentaje || 0;
        const color = pct >= 100 ? '#4caf50' : pct >= 60 ? 'var(--gold)' : 'var(--rose)';
        const label = ESTADO_LABELS_G[p.estado] || p.estado;
        return `
          <div class="grupo-ped-row">
            <span class="grupo-ped-code">${esc(p.codigo)}</span>
            <span class="grupo-ped-info">👤 ${p.total_alumnos || 0} alumnos</span>
            <div class="grupo-ped-pbar">
              <div class="grupo-ped-pbar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <span class="grupo-ped-pct">${pct}%</span>
            <span class="estado-badge estado-${esc(p.estado)}" style="font-size:.65rem">${esc(label)}</span>
          </div>`;
      }).join('')
    : `<div class="gp-empty">📋 Aún no hay pedidos para este grupo</div>`;

  return `
    <div class="grupo-item">
      <div class="grupo-item-header">
        <div class="gi-icon">${NIVEL_ICONS[g.nivel] || '📁'}</div>
        <div class="gi-info">
          <div class="gi-nombre">${esc(g.nombre)}</div>
          <div class="gi-colegio">🏫 ${esc(g.colegio)}</div>
        </div>
        <div class="gi-nivel-chip">${esc(g.nivel)}</div>
      </div>
      <div class="grupo-pedidos">${pedsHTML}</div>
    </div>`;
}
