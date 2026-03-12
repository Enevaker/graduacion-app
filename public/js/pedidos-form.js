// public/js/pedidos-form.js — Formulario de nuevo pedido (wizard por pasos)

let alumnos = [];
let alumnoCounter = 0;
let currentGrupo  = null;
let wizardNivel   = null;
let _wizardGrupos = [];
let _formStep     = 1;

const _FORM_STEPS = [
  { icon:'📋', label:'Datos'    },
  { icon:'🎒', label:'Alumnos'  },
  { icon:'👕', label:'Uniforme' },
  { icon:'📅', label:'Entrega'  },
  { icon:'✅', label:'Resumen'  },
];

// ── Entrada principal ─────────────────────────────────────────
function renderFormPedido() {
  currentGrupo = null;
  renderFormularioPedido(null);
}

function usarGrupoById(idx) {
  usarGrupo(_wizardGrupos[idx]);
}

// ── WIZARD paso 1: elegir nivel ───────────────────────────────
function renderWizardPaso1() {
  const fp = document.getElementById('formPedido');
  fp.innerHTML = `
    <div class="wizard-hero">
      <div class="wizard-hero-inner">
        <h2 class="wizard-title">¡Vamos a crear tu grupo! ✨</h2>
        <p class="wizard-sub">¿Cuál es el nivel educativo?</p>
        <div class="wizard-steps"><div class="wstep active"></div><div class="wstep"></div></div>
      </div>
    </div>
    <div class="wizard-wrap">
      <div class="nivel-grid">
        ${[['preescolar','🌟'],['primaria','📚'],['secundaria','🎒'],
           ['preparatoria','🎓']].map(([n,ic]) => `
          <div class="nivel-card" id="nc-${n}" onclick="seleccionarNivel('${n}')">
            <div class="nivel-card-icon">${ic}</div>
            <div class="nivel-card-lbl">${n}</div>
          </div>`).join('')}
      </div>
      <button class="btn btn-outline btn-sm" style="margin-top:18px" onclick="renderFormPedido()">← Volver</button>
    </div>`;
}

function seleccionarNivel(nivel) {
  wizardNivel = nivel;
  document.querySelectorAll('.nivel-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('nc-' + nivel)?.classList.add('selected');
  setTimeout(() => renderWizardPaso2(), 240);
}

// ── WIZARD paso 2: nombre + colegio ──────────────────────────
function renderWizardPaso2() {
  const u  = window.currentUser || {};
  const ic = NIVEL_ICONS[wizardNivel] || '📁';
  const fp = document.getElementById('formPedido');
  fp.innerHTML = `
    <div class="wizard-hero">
      <div class="wizard-hero-inner">
        <h2 class="wizard-title">¡Perfecto! Ya casi terminamos 😊</h2>
        <p class="wizard-sub">Cuéntanos sobre el grupo de <strong style="color:rgba(255,255,255,.9)">${ic} ${wizardNivel}</strong></p>
        <div class="wizard-steps"><div class="wstep done"></div><div class="wstep active"></div></div>
      </div>
    </div>
    <div class="wizard-wrap">
      <div style="background:#fff;border-radius:16px;border:1px solid var(--g200);box-shadow:var(--sh-sm);padding:24px 20px">
        <div class="field">
          <label>Grupo <span class="req">*</span></label>
          <input type="text" id="wNombre" placeholder="Ej: 6° A, Kínder 3, Turno Matutino…">
          <div class="field-hint">Algo que te ayude a identificarlo fácilmente</div>
        </div>
        <div id="wizardErr" class="auth-error" style="display:none;margin-top:10px"></div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-outline" onclick="renderWizardPaso1()">← Volver</button>
          <button class="btn btn-primary" id="btnCrearGrupo" style="flex:1" onclick="crearGrupo()">Crear grupo →</button>
        </div>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('wNombre')?.focus(), 60);
}

async function crearGrupo() {
  const nombre  = document.getElementById('wNombre')?.value?.trim();
  const colegio = (window.currentUser?.colegio || '').trim();
  const errEl   = document.getElementById('wizardErr');

  if (!nombre) { errEl.textContent = 'El nombre del grupo es requerido'; errEl.style.display = ''; return; }

  const btn = document.getElementById('btnCrearGrupo');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creando…'; }

  const r = await API.post('/api/grupos', { nivel: wizardNivel, nombre, colegio });

  if (!r.ok) {
    if (btn) { btn.disabled = false; btn.textContent = 'Crear grupo →'; }
    if (errEl) { errEl.textContent = r.msg || 'Error al crear el grupo'; errEl.style.display = ''; }
    return;
  }

  showToast('¡Grupo creado! Ahora llena los datos del pedido 📋', 'success');
  usarGrupo(r.grupo);
}

function usarGrupo(grupo) {
  currentGrupo = grupo;
  renderFormularioPedido(grupo);
}

// ── FORMULARIO WIZARD (5 pasos) ───────────────────────────────
function renderFormularioPedido(grupo) {
  const u      = window.currentUser || {};
  const colVal = esc(grupo?.colegio || u.colegio || '');
  _formStep    = 1;
  alumnos = []; alumnoCounter = 0;

  document.getElementById('formPedido').innerHTML = `

    <!-- Indicador de pasos -->
    <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);
                padding:16px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;position:relative">
        <div style="position:absolute;top:18px;left:30px;right:30px;height:2px;
                    background:var(--g200);z-index:0"></div>
        ${_FORM_STEPS.map((s,i) => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;z-index:1;flex:1">
            <div id="fsc-${i+1}" style="width:36px;height:36px;border-radius:50%;background:var(--g200);
              display:flex;align-items:center;justify-content:center;font-size:.88rem;
              transition:background .25s,color .25s">${s.icon}</div>
            <span id="fsl-${i+1}" style="font-size:.6rem;font-weight:600;color:var(--g400);
              text-align:center;white-space:nowrap">${s.label}</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- Paso 1: Datos -->
    <div id="fstep-1">
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);padding:20px">
        <p style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:14px">📋 Datos del pedido</p>
        <div class="field"><label>Ciudad <span class="req">*</span></label>
          <input type="text" id="fCiudad" value="${u.ciudad||''}" placeholder="Ej: Monterrey"></div>
        <div class="field"><label>Fecha del pedido <span class="req">*</span></label>
          <input type="date" id="fFecha"></div>
        <div class="field"><label>Grado escolar <span class="req">*</span></label>
          <select id="fGrado">
            <option value="">Seleccionar…</option>
            <option>Preescolar</option><option>Primaria</option>
            <option>Secundaria</option><option>Preparatoria</option>
          </select></div>
        <div style="height:1px;background:var(--g200);margin:18px 0"></div>
        <p style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:14px">🏫 Datos de la escuela</p>
        <div class="field"><label>Nombre del contacto <span class="req">*</span></label>
          <input type="text" id="fContacto" value="${u.nombre||''}" placeholder="Nombre completo"></div>
        <div class="field"><label>Nombre del colegio <span class="req">*</span></label>
          <input type="text" id="fColegio" value="${colVal}" placeholder="Nombre de la institución"></div>
        <div class="field"><label>Teléfono <span class="req">*</span></label>
          <input type="tel" id="fTel" value="${u.telefono||''}" placeholder="10 dígitos" maxlength="10"
            oninput="this.value=this.value.replace(/\\D/g,'')"></div>
        <div class="field"><label>Correo electrónico</label>
          <input type="email" id="fEmail" value="${u.email||''}" placeholder="correo@ejemplo.com"></div>
      </div>
    </div>

    <!-- Paso 2: Alumnos -->
    <div id="fstep-2" style="display:none">
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);padding:20px">
        <p style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:4px">👶 Lista de Alumnos</p>
        <p style="color:var(--g400);font-size:.8rem;margin-bottom:14px">
          Máx. 9 caracteres por nombre · Máx. 30 alumnos</p>
        <div class="stud-toolbar">
          <div class="stud-count">
            Total: <span id="alumTotal">0</span>/30 &nbsp;·&nbsp;
            👧 <span id="alumNinas">0</span> &nbsp;·&nbsp;
            👦 <span id="alumNinos">0</span>
          </div>
        </div>
        <div class="dual-tables">
          <div class="dual-col">
            <div class="dual-head dh-nina">
              <span>👧 Niñas</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="dual-count" id="cntNinas">0</span>
                <button class="btn-add-inline btn-add-nina" onclick="addNina()">＋</button>
              </div>
            </div>
            <div class="tbl-wrap">
              <table><thead><tr>
                <th class="th-nina" style="width:32px">#</th>
                <th class="th-nina">Nombre</th>
                <th class="th-nina">Pelo</th>
                <th class="th-nina" style="width:32px"></th>
              </tr></thead><tbody id="tbNinas">
                <tr><td colspan="4"><div class="empty-state">
                  <p>Sin niñas aún</p></div></td></tr>
              </tbody></table>
            </div>
          </div>
          <div class="dual-col">
            <div class="dual-head dh-nino">
              <span>👦 Niños</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="dual-count" id="cntNinos">0</span>
                <button class="btn-add-inline btn-add-nino" onclick="addNino()">＋</button>
              </div>
            </div>
            <div class="tbl-wrap">
              <table><thead><tr>
                <th class="th-nino" style="width:32px">#</th>
                <th class="th-nino">Nombre</th>
                <th class="th-nino">Pelo</th>
                <th class="th-nino" style="width:32px"></th>
              </tr></thead><tbody id="tbNinos">
                <tr><td colspan="4"><div class="empty-state">
                  <p>Sin niños aún</p></div></td></tr>
              </tbody></table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Paso 3: Uniforme -->
    <div id="fstep-3" style="display:none">
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);padding:20px">
        <p style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:14px">👗 Uniforme</p>
        ${selField('fCalceta','Color de calceta','Blanco,Marino,Rojo,Verde botella,Azul plumbago,Beige,Negro,Gris,Rosa,Café')}
        ${selField('fZapatoN','Color zapato niñas','Negro,Blanco,Café,Marino,Rojo,Verde botella,Azul plumbago,Beige')}
        ${selField('fMonos','Color de moños','Blanco,Rosa,Azul,Rojo,Negro,Morado,Verde,Beige')}
        ${selField('fZapatoM','Color zapato niño','Negro,Café,Blanco,Marino,Rojo,Verde botella,Azul plumbago,Beige')}
        ${selField('fPantalon','Color de pantalón','Negro,Marino,Gris,Caqui,Café,Verde botella,Beige')}
        <div style="height:1px;background:var(--g200);margin:18px 0"></div>
        <p style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:14px">🪡 Bordado</p>
        <div class="field">
          <label>Cantidad de escudos para bordar</label>
          <input type="number" id="fEscudos" min="0" max="200" placeholder="0">
          <div class="field-hint">Número total de escudos bordados</div>
        </div>
      </div>
    </div>

    <!-- Paso 4: Entrega -->
    <div id="fstep-4" style="display:none">
      <div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(26,39,68,.07);padding:20px">
        <p style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:14px">📅 Información de Entrega</p>
        <div class="field"><label>Fecha de entrega <span class="req">*</span></label>
          <input type="date" id="fFechaEnt"></div>
        <div class="field"><label>Tipo de entrega <span class="req">*</span></label>
          <div class="radio-group">
            <label class="radio-opt">
              <input type="radio" name="tipoEnt" value="ocurre" onchange="toggleShip()">
              📦 Ocurre (paquetería)
            </label>
            <label class="radio-opt">
              <input type="radio" name="tipoEnt" value="domicilio" onchange="toggleShip()">
              🏠 Envío a domicilio
            </label>
          </div>
        </div>
        <div id="shippingSection" style="display:none">
          <div style="height:1px;background:var(--g200);margin:18px 0"></div>
          <p style="font-size:.72rem;font-weight:700;color:var(--navy);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:14px">🚚 Datos de envío</p>
          <div class="field"><label>Destinatario <span class="req">*</span></label>
            <input type="text" id="fDestinatario" placeholder="Nombre completo"
              value="${u.nombre||''}"></div>
          <div class="field"><label>Teléfono <span class="req">*</span></label>
            <input type="tel" id="fTelEnv" placeholder="10 dígitos" maxlength="10"
              value="${u.telefono||''}" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
          <div class="field"><label>Código postal <span class="req">*</span></label>
            <input type="text" id="fCP" placeholder="00000" maxlength="5" value="${u.cp||''}"
              oninput="this.value=this.value.replace(/\\D/g,'')"></div>
          <div class="field"><label>Colonia <span class="req">*</span></label>
            <input type="text" id="fColonia" placeholder="Nombre de la colonia"
              value="${u.colonia||''}"></div>
          <div class="field"><label>Dirección completa <span class="req">*</span></label>
            <input type="text" id="fDireccion" placeholder="Calle, número, referencias"
              value="${u.direccion||''}"></div>
          <div class="field"><label>Correo electrónico</label>
            <input type="email" id="fEmailEnv" placeholder="correo@ejemplo.com"
              value="${u.email||''}"></div>
        </div>
      </div>
    </div>

    <!-- Paso 5: Resumen -->
    <div id="fstep-5" style="display:none">
      <div class="summary-card">
        <h3>📊 Resumen del Pedido</h3>
        <div class="sum-grid">
          <div class="sum-stat"><div class="num" id="sTotal">0</div><div class="lbl">Total alumnos</div></div>
          <div class="sum-stat"><div class="num" id="sNinas">0</div><div class="lbl">Niñas</div></div>
          <div class="sum-stat"><div class="num" id="sNinos">0</div><div class="lbl">Niños</div></div>
          <div class="sum-stat"><div class="num" id="sEscudos">0</div><div class="lbl">Escudos</div></div>
        </div>
        <div class="sum-info">
          <div class="sum-item"><div class="key">Cliente</div><div class="val" id="sContacto">—</div></div>
          <div class="sum-item"><div class="key">Colegio</div><div class="val" id="sColegio">—</div></div>
          <div class="sum-item"><div class="key">Ciudad</div><div class="val" id="sCiudad">—</div></div>
          <div class="sum-item"><div class="key">Grado</div><div class="val" id="sGrado">—</div></div>
          <div class="sum-item"><div class="key">Fecha entrega</div><div class="val" id="sEntrega">—</div></div>
          <div class="sum-item"><div class="key">Tipo entrega</div><div class="val" id="sTipo">—</div></div>
        </div>
      </div>
    </div>

    <!-- Navegación -->
    <div style="display:flex;gap:10px;margin-top:16px">
      <button id="fBtnPrev" class="btn btn-outline" style="display:none" onclick="wizardPrev()">← Anterior</button>
      <button id="fBtnNext" class="btn btn-primary" style="flex:1" onclick="wizardNext()">Siguiente →</button>
      <button id="btnEnviar" class="btn btn-primary" style="flex:1;display:none" onclick="enviarPedido()">📤 Enviar Pedido</button>
    </div>`;

  // Fecha de hoy por defecto
  document.getElementById('fFecha').value = new Date().toISOString().split('T')[0];

  // Pre-llenar grado desde el grupo seleccionado
  if (grupo?.nivel) {
    const gradoMap = { preescolar:'Preescolar', primaria:'Primaria',
                       secundaria:'Secundaria', preparatoria:'Preparatoria' };
    const el = document.getElementById('fGrado');
    if (el) el.value = gradoMap[grupo.nivel] || '';
  }

  _updateWizardUI();
}

// ── Actualizar indicadores y botones ─────────────────────────
function _updateWizardUI() {
  // Mostrar/ocultar pasos
  _FORM_STEPS.forEach((_, i) => {
    const el = document.getElementById(`fstep-${i+1}`);
    if (el) el.style.display = i+1 === _formStep ? '' : 'none';
  });

  // Actualizar círculos del indicador
  _FORM_STEPS.forEach((s, i) => {
    const circle = document.getElementById(`fsc-${i+1}`);
    const lbl    = document.getElementById(`fsl-${i+1}`);
    if (!circle) return;
    const n = i + 1;
    if (n < _formStep) {
      // Completado
      circle.style.background = '#e91e8c';
      circle.style.color      = '#fff';
      circle.textContent      = '✓';
    } else if (n === _formStep) {
      // Activo
      circle.style.background = 'var(--navy)';
      circle.style.color      = '#fff';
      circle.textContent      = s.icon;
      if (lbl) { lbl.style.color = 'var(--navy)'; lbl.style.fontWeight = '700'; }
    } else {
      // Pendiente
      circle.style.background = 'var(--g200)';
      circle.style.color      = 'var(--g400)';
      circle.textContent      = s.icon;
      if (lbl) { lbl.style.color = 'var(--g400)'; lbl.style.fontWeight = '600'; }
    }
  });

  // Botones de navegación
  const prev = document.getElementById('fBtnPrev');
  const next = document.getElementById('fBtnNext');
  const send = document.getElementById('btnEnviar');
  if (prev) prev.style.display = _formStep > 1 ? '' : 'none';
  if (next) next.style.display = _formStep < _FORM_STEPS.length ? '' : 'none';
  if (send) send.style.display = _formStep === _FORM_STEPS.length ? '' : 'none';

  // En el último paso actualizar resumen
  if (_formStep === _FORM_STEPS.length) updSummary();

  // Scroll arriba
  document.querySelector('.page-inner')?.scrollTo({ top:0, behavior:'smooth' });
}

// ── Navegación entre pasos ───────────────────────────────────
function wizardNext() {
  // Validar paso actual antes de avanzar
  if (_formStep === 1) {
    const reqs = ['fCiudad','fFecha','fGrado','fContacto','fColegio','fTel'];
    const missing = reqs.filter(id => !v(id));
    if (missing.length) {
      missing.forEach(markErr);
      return showToast('Completa los campos requeridos ⚠️', 'error');
    }
    reqs.forEach(clearErr);
  }
  if (_formStep === 2) {
    if (!alumnos.length) return showToast('Agrega al menos un alumno 👶', 'error');
    const invalid = alumnos.filter(a => !a.nombre.trim() || a.nombre.length > 9);
    if (invalid.length) return showToast('Revisa los nombres (máx. 9 caracteres)', 'error');
  }
  if (_formStep === 4) {
    if (!v('fFechaEnt')) { markErr('fFechaEnt'); return showToast('Ingresa la fecha de entrega', 'error'); }
    clearErr('fFechaEnt');
    if (!document.querySelector('input[name="tipoEnt"]:checked'))
      return showToast('Selecciona el tipo de entrega', 'error');
    const tipo = document.querySelector('input[name="tipoEnt"]:checked').value;
    if (tipo === 'domicilio') {
      const envReqs = ['fDestinatario','fTelEnv','fCP','fColonia','fDireccion'];
      const missing = envReqs.filter(id => !v(id));
      if (missing.length) { missing.forEach(markErr); return showToast('Completa los datos de envío', 'error'); }
      envReqs.forEach(clearErr);
    }
  }
  if (_formStep < _FORM_STEPS.length) { _formStep++; _updateWizardUI(); }
}

function wizardPrev() {
  if (_formStep > 1) { _formStep--; _updateWizardUI(); }
}

// ── Helpers de campos ─────────────────────────────────────────
function selField(id, lbl, opts) {
  return `<div class="field"><label>${lbl}</label>
    <select id="${id}" onchange="toggleOtro('${id}')">
      <option value="">Seleccionar…</option>
      ${opts.split(',').map(o=>`<option>${o.trim()}</option>`).join('')}
      <option value="otro">✏️ Otro…</option>
    </select>
    <input type="text" id="${id}_otro" placeholder="Escribe el color…" style="display:none;margin-top:6px">
  </div>`;
}

function toggleOtro(id) {
  const sel = document.getElementById(id);
  const inp = document.getElementById(id + '_otro');
  if (!inp) return;
  inp.style.display = sel.value === 'otro' ? '' : 'none';
  if (sel.value === 'otro') inp.focus();
}

function getColorVal(id) {
  const sel = document.getElementById(id);
  if (!sel) return '';
  if (sel.value === 'otro') return document.getElementById(id + '_otro')?.value?.trim() || '';
  return sel.value;
}

function toggleShip() {
  const val = document.querySelector('input[name="tipoEnt"]:checked')?.value;
  const sec = document.getElementById('shippingSection');
  if (sec) sec.style.display = val === 'domicilio' ? 'block' : 'none';
}

// ── Alumnos ───────────────────────────────────────────────────
const PELO_STD    = ['castaño','tabaco','rubio','pelirrojo'];
const PELO_LABELS = { castaño:'🟫 Castaño', tabaco:'🤎 Tabaco', rubio:'💛 Rubio', pelirrojo:'🟠 Pelirrojo' };

function peloSelectHTML(a) {
  const isOtro = a.pelo && !PELO_STD.includes(a.pelo);
  const opts = `<option value="">Color…</option>
    ${PELO_STD.map(k => `<option value="${k}" ${a.pelo===k?'selected':''}>${PELO_LABELS[k]}</option>`).join('')}
    <option value="otro" ${isOtro?'selected':''}>✏️ Otro…</option>`;
  return `<select onchange="onPeloChange('${a.id}',this.value)">${opts}</select>
    <input type="text" id="pelo-txt-${a.id}" placeholder="Especifica…"
      style="${isOtro?'':'display:none;'}margin-top:4px;width:90%;font-size:.82rem"
      value="${isOtro ? esc(a.pelo) : ''}"
      oninput="updAlumno('${a.id}','pelo',this.value)">`;
}

function onPeloChange(id, val) {
  const inp = document.getElementById('pelo-txt-' + id);
  if (val === 'otro') {
    if (inp) { inp.style.display = ''; inp.focus(); }
    updAlumno(id, 'pelo', '');
  } else {
    if (inp) inp.style.display = 'none';
    updAlumno(id, 'pelo', val);
  }
}

function addNina() {
  if (alumnos.length >= 30) return showToast('Máximo 30 alumnos', 'error');
  const id = 'a' + (++alumnoCounter);
  alumnos.push({ id, nombre: '', tipo: 'niña', pelo: '' });
  renderAlumnos();
  setTimeout(() => document.querySelector(`#row-nina-${id} .inp-nom`)?.focus(), 40);
}

function addNino() {
  if (alumnos.length >= 30) return showToast('Máximo 30 alumnos', 'error');
  const id = 'a' + (++alumnoCounter);
  alumnos.push({ id, nombre: '', tipo: 'niño', pelo: '' });
  renderAlumnos();
  setTimeout(() => document.querySelector(`#row-nino-${id} .inp-nom`)?.focus(), 40);
}

function removeAlumno(id) {
  alumnos = alumnos.filter(a => a.id !== id);
  renderAlumnos();
}

function updAlumno(id, field, val) {
  const a = alumnos.find(x => x.id === id);
  if (a) a[field] = val;
}

function checkNom(inp) {
  if (inp.value.length > 9) { inp.style.borderColor = '#e55'; showToast('Máximo 9 caracteres', 'error'); }
  else inp.style.borderColor = '';
}

function renderAlumnos() {
  const ninas = alumnos.filter(a => a.tipo === 'niña');
  const ninos = alumnos.filter(a => a.tipo === 'niño');

  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('alumTotal', alumnos.length);
  setTxt('alumNinas', ninas.length);
  setTxt('alumNinos', ninos.length);
  setTxt('cntNinas',  ninas.length);
  setTxt('cntNinos',  ninos.length);

  const rowHTML = (a, i) => `
    <tr id="row-${a.tipo === 'niña' ? 'nina' : 'nino'}-${a.id}">
      <td class="td-num">${i+1}</td>
      <td><input class="inp-nom" type="text" maxlength="9" value="${esc(a.nombre)}"
        placeholder="Nombre" oninput="updAlumno('${a.id}','nombre',this.value);checkNom(this)"></td>
      <td>${peloSelectHTML(a)}</td>
      <td><button class="btn-del" onclick="removeAlumno('${a.id}')">✕</button></td>
    </tr>`;

  const tbN = document.getElementById('tbNinas');
  if (tbN) tbN.innerHTML = ninas.length
    ? ninas.map((a,i) => rowHTML(a,i)).join('')
    : `<tr><td colspan="4"><div class="empty-state"><p>Sin niñas aún</p></div></td></tr>`;

  const tbM = document.getElementById('tbNinos');
  if (tbM) tbM.innerHTML = ninos.length
    ? ninos.map((a,i) => rowHTML(a,i)).join('')
    : `<tr><td colspan="4"><div class="empty-state"><p>Sin niños aún</p></div></td></tr>`;
}

// ── Resumen ───────────────────────────────────────────────────
function updSummary() {
  const ninas = alumnos.filter(a => a.tipo === 'niña').length;
  const ninos = alumnos.filter(a => a.tipo === 'niño').length;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sTotal',    alumnos.length);
  set('sNinas',    ninas);
  set('sNinos',    ninos);
  set('sEscudos',  v('fEscudos') || '0');
  set('sContacto', v('fContacto') || '—');
  set('sColegio',  v('fColegio')  || '—');
  set('sCiudad',   v('fCiudad')   || '—');
  set('sGrado',    v('fGrado')    || '—');
  set('sEntrega',  v('fFechaEnt') || '—');
  const tipo = document.querySelector('input[name="tipoEnt"]:checked');
  set('sTipo', tipo ? (tipo.value === 'domicilio' ? '🏠 Domicilio' : '📦 Ocurre') : '—');
}

// sin uso pero se llama desde algunos sitios, conservar como no-op
function updProg() {}
function toggleSec() {}

// ── Validar y enviar ──────────────────────────────────────────
async function enviarPedido() {
  // Validar campos base
  const reqs = ['fCiudad','fFecha','fGrado','fContacto','fColegio','fTel'];
  let ok = true;
  reqs.forEach(id => { if (!v(id)) { markErr(id); ok = false; } else clearErr(id); });
  if (!ok) return showToast('Completa los campos requeridos', 'error');
  if (!alumnos.length) return showToast('Agrega al menos un alumno', 'error');
  if (!document.querySelector('input[name="tipoEnt"]:checked'))
    return showToast('Selecciona el tipo de entrega', 'error');

  const tipo = document.querySelector('input[name="tipoEnt"]:checked').value;
  if (tipo === 'domicilio') {
    const envReqs = ['fDestinatario','fTelEnv','fCP','fColonia','fDireccion'];
    envReqs.forEach(id => { if (!v(id)) { markErr(id); ok = false; } else clearErr(id); });
    if (!ok) return showToast('Completa los datos de envío', 'error');
  }

  const nombresInvalidos = alumnos.filter(a => !a.nombre.trim() || a.nombre.length > 9);
  if (nombresInvalidos.length) return showToast('Revisa los nombres de los alumnos (máx. 9 caracteres)', 'error');

  const btnEnv = document.getElementById('btnEnviar');
  if (btnEnv) { btnEnv.disabled = true; btnEnv.textContent = '⏳ Enviando…'; }

  const payload = {
    ciudad: v('fCiudad'), fecha_pedido: v('fFecha'), grado: v('fGrado'),
    contacto: v('fContacto'), colegio: v('fColegio'), telefono: v('fTel'), email: v('fEmail'),
    calceta: getColorVal('fCalceta'), zapato_nina: getColorVal('fZapatoN'), monos: getColorVal('fMonos'),
    zapato_nino: getColorVal('fZapatoM'), pantalon: getColorVal('fPantalon'), escudos: v('fEscudos')||'0',
    fecha_entrega: v('fFechaEnt'), tipo_entrega: tipo,
    destinatario: v('fDestinatario'), tel_envio: v('fTelEnv'), cp: v('fCP'),
    colonia: v('fColonia'), direccion: v('fDireccion'), email_envio: v('fEmailEnv'),
    alumnos: alumnos.map(a => ({ nombre: a.nombre.trim(), tipo: a.tipo, pelo: a.pelo })),
    grupo_id: currentGrupo?.id || null,
  };

  const r = await API.post('/api/pedidos', payload);
  if (btnEnv) { btnEnv.disabled = false; btnEnv.textContent = '📤 Enviar Pedido'; }

  if (!r.ok) return showToast(r.msg || 'Error al enviar el pedido', 'error');
  showToast(`✅ Pedido ${r.codigo} enviado con éxito`, 'success');
  goTo('pedidos');
}

function showExitoModal(codigo, waLink) {
  document.getElementById('modalContent').innerHTML = `
    <h3>🎉 ¡Pedido enviado!</h3>
    <div style="background:var(--g100);border-radius:10px;padding:16px;text-align:center;margin-bottom:16px">
      <p style="color:var(--g400);font-size:.75rem;margin-bottom:4px">CÓDIGO DE PEDIDO</p>
      <p style="font-family:'DM Serif Display',serif;font-size:2rem;color:var(--navy)">${codigo}</p>
    </div>
    <p style="color:var(--g600);font-size:.88rem;margin-bottom:18px">
      Tu pedido fue recibido. Guarda tu código para dar seguimiento.
    </p>
    ${waLink ? `<a href="${waLink}" target="_blank" class="wa-btn" style="width:100%;justify-content:center;margin-bottom:12px">
      💬 Notificar por WhatsApp al admin</a>` : ''}
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" onclick="closeModal();goTo('pedidos')">Ver mis pedidos</button>
    </div>`;
  openModal();
}

function limpiarForm() {
  alumnos = []; alumnoCounter = 0;
  renderFormPedido();
}

function markErr(id) { const el = document.getElementById(id); if (el) el.classList.add('err'); }
function clearErr(id) { const el = document.getElementById(id); if (el) el.classList.remove('err'); }
