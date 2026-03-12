// public/js/auth.js — Login, registro, perfil

function showAuthTab(tab) {
  document.getElementById('formLogin').style.display   = tab === 'login'    ? '' : 'none';
  document.getElementById('formRegistro').style.display = tab === 'registro' ? '' : 'none';
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabReg').classList.toggle('active',   tab === 'registro');
}

async function doLogin() {
  const nombre = v('loginNombre'), pass = v('loginPass');
  if (!nombre || !pass) return setAuthError('loginError', 'Ingresa tu nombre y contraseña');
  setBtnLoading('btnLogin', true);
  const r = await API.post('/api/auth/login', { nombre, password: pass });
  setBtnLoading('btnLogin', false);
  if (!r.ok) return setAuthError('loginError', r.msg);
  onLoginSuccess(r.user);
}

async function doRegistro() {
  const nombre = v('regNombre'), email = v('regEmail'),
        pass = v('regPass'), pass2 = v('regPass2');
  if (!nombre || !email || !pass) return setAuthError('regError', 'Completa los campos requeridos');
  if (pass !== pass2)            return setAuthError('regError', 'Las contraseñas no coinciden');
  if (pass.length < 6)           return setAuthError('regError', 'La contraseña debe tener al menos 6 caracteres');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAuthError('regError', 'Correo no válido');

  setBtnLoading('btnReg', true);
  const r = await API.post('/api/auth/registro', {
    nombre, email, password: pass,
    telefono: v('regTel'), ciudad: v('regCiudad'), colegio: v('regColegio'),
  });
  setBtnLoading('btnReg', false);
  if (!r.ok) return setAuthError('regError', r.msg);
  onLoginSuccess(r.user);
}

async function logout() {
  await API.post('/api/auth/logout');
  window.currentUser = null;
  window.location.href = '/bienvenida.html';
}

function onLoginSuccess(user, opts = {}) {
  window.currentUser = user;
  document.getElementById('siteHeader').style.display = '';
  // Mostrar botón admin si corresponde
  const isAdmin = ['admin', 'colaborador'].includes(user.rol);
  // Nav admin
  document.getElementById('navAdmin').style.display = isAdmin ? '' : 'none';
  // Nav cliente — ocultar todos para clientes (navegan desde el home)
  document.getElementById('navHome').style.display = 'none';
  document.getElementById('navPedidos').style.display = 'none';
  document.getElementById('navNuevo').style.display = 'none';
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  // Botones de cliente — solo visibles para clientes
  document.querySelectorAll('.client-back').forEach(el => el.style.display = isAdmin ? 'none' : '');

  // Al recargar: restaurar la última página visitada
  if (opts.restorePage) {
    const saved     = sessionStorage.getItem('lastPage');
    const savedTab  = sessionStorage.getItem('lastAdminTab');
    const clientOk  = new Set(['pedidos', 'perfil', 'home', 'escuelas']);
    const validPage = saved && (isAdmin || clientOk.has(saved));
    if (validPage) {
      goTo(saved);
      if (saved === 'admin' && savedTab) setTimeout(() => setAdminTab(savedTab), 350);
      return;
    }
  }

  goTo(isAdmin ? 'admin' : 'pedidos');
  if (!opts.restorePage) showToast(`¡Bienvenido, ${user.nombre}!`, 'success');
}

// ── Perfil ────────────────────────────────────────────────────
function renderPerfil() {
  const u = window.currentUser;
  const rolLabel = u.rol === 'admin' ? '⚙️ Administrador' : u.rol === 'colaborador' ? '🤝 Colaborador' : '🏫 Escuela';
  document.getElementById('perfilContenido').innerHTML = `
    <div class="perfil-card">
      <div class="perfil-avatar">👤</div>
      <h3 style="font-family:'DM Serif Display',serif;color:var(--navy);margin-bottom:4px">${u.nombre}</h3>
      <p style="color:var(--g400);font-size:.82rem;margin-bottom:24px">${rolLabel}</p>

      <!-- Datos de cuenta -->
      <p style="font-size:.78rem;font-weight:700;color:var(--navy);margin-bottom:12px;letter-spacing:.04em;text-transform:uppercase">👤 Datos de cuenta</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
        <div class="field"><label>Nombre completo</label>
          <input type="text" id="pNombre" value="${u.nombre||''}"></div>
        <div class="field"><label>Correo electrónico</label>
          <input type="email" id="pEmail" value="${u.email||''}" placeholder="correo@ejemplo.com"></div>
        <div class="field"><label>Teléfono</label>
          <input type="tel" id="pTel" value="${u.telefono||''}" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
        <div class="field"><label>Colegio / Escuela</label>
          <input type="text" id="pColegio" value="${u.colegio||''}"></div>
      </div>

      ${u.rol === 'cliente' ? `
      <div class="divider"></div>

      <!-- Datos de envío (solo escuelas) -->
      <p style="font-size:.78rem;font-weight:700;color:var(--navy);margin-bottom:12px;letter-spacing:.04em;text-transform:uppercase">📦 Datos de envío</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
        <div class="field"><label>Ciudad</label>
          <input type="text" id="pCiudad" value="${u.ciudad||''}" placeholder="Ej: Monterrey"></div>
        <div class="field"><label>Estado</label>
          <input type="text" id="pEstado" value="${u.estado||''}" placeholder="Ej: Nuevo León"></div>
        <div class="field"><label>Colonia / Fraccionamiento</label>
          <input type="text" id="pColonia" value="${u.colonia||''}" placeholder="Nombre de colonia"></div>
        <div class="field"><label>Código postal</label>
          <input type="text" id="pCp" value="${u.cp||''}" maxlength="5" placeholder="00000"
            oninput="this.value=this.value.replace(/\\D/g,'')"></div>
        <div class="field" style="grid-column:span 2"><label>Dirección (calle y número)</label>
          <input type="text" id="pDireccion" value="${u.direccion||''}" placeholder="Ej: Av. Constitución 456, Col. Centro"></div>
        <div class="field" style="grid-column:span 2"><label>Referencias</label>
          <input type="text" id="pReferencias" value="${u.referencias||''}" placeholder="Entre calles, puntos de referencia…"></div>
      </div>` : ''}

      <div class="divider"></div>

      <!-- Cambiar contraseña -->
      <p style="font-size:.78rem;font-weight:700;color:var(--navy);margin-bottom:12px;letter-spacing:.04em;text-transform:uppercase">🔒 Cambiar contraseña <span style="font-weight:400;color:var(--g400)">(opcional)</span></p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
        <div class="field"><label>Contraseña actual</label>
          <input type="password" id="pPassActual" placeholder="Tu contraseña actual"></div>
        <div class="field"><label>Contraseña nueva</label>
          <input type="password" id="pPassNuevo" placeholder="Mínimo 6 caracteres"></div>
      </div>

      <div id="perfilError" class="auth-error" style="display:none"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" onclick="guardarPerfil()" id="btnPerfil">💾 Guardar cambios</button>
      </div>
    </div>`;
}

async function guardarPerfil() {
  setBtnLoading('btnPerfil', true);
  const r = await API.put('/api/auth/perfil', {
    nombre:          v('pNombre'),
    email:           v('pEmail'),
    telefono:        v('pTel'),
    colegio:         v('pColegio'),
    ciudad:          v('pCiudad'),
    estado:          v('pEstado'),
    colonia:         v('pColonia'),
    cp:              v('pCp'),
    direccion:       v('pDireccion'),
    referencias:     v('pReferencias'),
    passwordActual:  v('pPassActual'),
    passwordNuevo:   v('pPassNuevo'),
  });
  setBtnLoading('btnPerfil', false);
  if (!r.ok) {
    document.getElementById('perfilError').textContent = r.msg;
    document.getElementById('perfilError').style.display = '';
    return;
  }
  window.currentUser = r.user;
  showToast('Perfil actualizado ✅', 'success');
  document.getElementById('perfilError').style.display = 'none';
}

// ── Helpers ───────────────────────────────────────────────────
function setAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.style.display = '';
}
function setBtnLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Cargando…' : btn.dataset.label || btn.textContent;
}
