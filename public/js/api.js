// public/js/api.js — Wrapper HTTP para todas las llamadas al backend

const API = {
  async call(method, url, body) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(url, opts);
      const data = await r.json();
      if (r.status === 401) {
        // Sesión expirada → regresar a login
        window.currentUser = null;
        showPage('auth');
        showToast('Sesión expirada, inicia sesión', 'error');
      }
      return { status: r.status, ...data };
    } catch (e) {
      return { ok: false, msg: 'Error de conexión con el servidor' };
    }
  },
  get:    (url)       => API.call('GET',    url),
  post:   (url, body) => API.call('POST',   url, body),
  put:    (url, body) => API.call('PUT',    url, body),
  delete: (url)       => API.call('DELETE', url),
};
