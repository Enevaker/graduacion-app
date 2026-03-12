// public/js/app.js — Router SPA, utilidades globales, arranque

// ── Utilidades globales ───────────────────────────────────────
function v(id)      { return document.getElementById(id)?.value?.trim() || ''; }
function set(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function esc(s)     { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast-msg ' + type;
  el.innerHTML = `<span>${msg}</span>`;
  t.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function openModal()  { document.getElementById('modalOverlay').classList.add('open'); }
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

function toggleMenu() {
  const m = document.getElementById('mobileMenu');
  m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

// ── Página activa ─────────────────────────────────────────────
const PAGES = ['auth','home','pedidos','escuelas','nuevo','detalle','perfil','admin'];

function showPage(name) {
  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = p === name ? '' : 'none';
  });
  // Marcar nav activo
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navMap = { home:'navHome', pedidos:'navPedidos', escuelas:'navEscuelas', nuevo:'navNuevo', perfil:'navPerfil', admin:'navAdmin' };
  if (navMap[name]) document.getElementById(navMap[name])?.classList.add('active');
  window.scrollTo(0, 0);
}

function renderHome() {
  const u = window.currentUser;
  const nombre = u?.nombre?.split(' ')[0] || 'bienvenido';
  const el = document.getElementById('homeUserName');
  if (el) el.textContent = `¡Hola, ${nombre}!`;
}

// Páginas que NO se guardan (formularios o temporales)
const _NO_SAVE_PAGES = new Set(['auth', 'nuevo', 'detalle']);

function goTo(page) {
  if (!window.currentUser && page !== 'auth') return showPage('auth');
  showPage(page);
  // Guardar página actual para restaurar al recargar
  if (!_NO_SAVE_PAGES.has(page)) sessionStorage.setItem('lastPage', page);
  // Cargar contenido según página
  switch(page) {
    case 'home':      renderHome();         break;
    case 'pedidos':   renderPedidosLista(); break;
    case 'escuelas':  renderEscuelas();     break;
    case 'nuevo':     renderFormPedido();   break;
    case 'perfil':    renderPerfil();       break;
    case 'admin':
      if (['admin', 'colaborador'].includes(window.currentUser?.rol)) renderAdmin();
      else showPage('pedidos');
      break;
  }
}

// ── Arranque ──────────────────────────────────────────────────
const GOOGLE_ERRORS = {
  google_denied:        'Cancelaste el inicio de sesión con Google.',
  google_error:         'Ocurrió un error con Google. Intenta de nuevo.',
  email_not_verified:   'Tu cuenta de Google no tiene el correo verificado.',
  account_disabled:     'Tu cuenta está desactivada.',
  google_not_configured:'El login con Google no está configurado aún.',
};

async function init() {
  // Mostrar error de OAuth si viene en la URL
  const params = new URLSearchParams(window.location.search);
  const err = params.get('error');
  if (err) {
    history.replaceState({}, '', '/');
    // Se mostrará el toast después de renderizar la página auth
  }

  // Intentar restaurar sesión desde cookie
  const r = await API.get('/api/auth/me');
  // Ocultar loading spinner
  const loading = document.getElementById('appLoading');
  if (loading) loading.style.display = 'none';

  if (r.ok) {
    onLoginSuccess(r.user, { restorePage: true });
  } else {
    document.getElementById('siteHeader').style.display = 'none';
    showPage('auth');
    if (err) showToast(GOOGLE_ERRORS[err] || 'Error al iniciar sesión con Google.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
