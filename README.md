# 🎓 Muñecos de Graduación — Sistema de Pedidos

Aplicación web completa: login de clientes, formulario de pedidos, panel admin, correos, WhatsApp y Excel.

## ⚙️ Instalación local (VS Code)

1. Instala Node.js desde https://nodejs.org
2. Abre la carpeta en VS Code
3. En la terminal: `npm install`
4. Copia `.env.example` a `.env` y llena tus datos
5. Ejecuta: `npm start`
6. Abre: http://localhost:3000

**Admin por defecto:** ADMIN_EMAIL del .env / contraseña: `Admin2026!`
⚠️ Cambia la contraseña al entrar por primera vez.

## 🚀 Subir a Hostinger

1. Hostinger Panel → Hosting → Node.js → Nueva app
   - Startup file: `server.js` | Versión Node: 18.x
2. Sube todos los archivos (sin `node_modules/` ni `.env`)
3. Crea `.env` en el servidor con tus datos
4. SSH: `npm install --production`
5. Reinicia la app desde el panel

Ver README completo en el archivo README.md del proyecto.
