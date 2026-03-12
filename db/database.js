// db/database.js — Inicializa SQLite y crea todas las tablas

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './db/pedidos.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

// Activar WAL para mejor rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Crear tablas ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    rol         TEXT    NOT NULL DEFAULT 'cliente',  -- 'cliente' | 'admin'
    telefono    TEXT,
    colegio     TEXT,
    ciudad      TEXT,
    activo      INTEGER NOT NULL DEFAULT 1,
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo        TEXT    NOT NULL UNIQUE,
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
    estado        TEXT    NOT NULL DEFAULT 'pendiente',
    -- Datos generales
    ciudad        TEXT,
    fecha_pedido  TEXT,
    grado         TEXT,
    -- Cliente/escuela
    contacto      TEXT,
    colegio       TEXT,
    telefono      TEXT,
    email         TEXT,
    -- Uniforme
    calceta       TEXT,
    zapato_nina   TEXT,
    monos         TEXT,
    zapato_nino   TEXT,
    pantalon      TEXT,
    escudos       INTEGER DEFAULT 0,
    -- Entrega
    fecha_entrega TEXT,
    tipo_entrega  TEXT,
    -- Envío domicilio
    destinatario  TEXT,
    tel_envio     TEXT,
    cp            TEXT,
    colonia       TEXT,
    direccion     TEXT,
    email_envio   TEXT,
    -- Totales
    total_alumnos INTEGER DEFAULT 0,
    total_ninas   INTEGER DEFAULT 0,
    total_ninos   INTEGER DEFAULT 0,
    -- Meta
    notas         TEXT,
    creado_en     TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alumnos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id  INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    nombre     TEXT    NOT NULL,
    tipo       TEXT    NOT NULL,   -- 'niña' | 'niño'
    pelo       TEXT,
    orden      INTEGER DEFAULT 0
  );
`);

// ── Migración: columna google_id ─────────────────────────────
try {
  db.exec('ALTER TABLE usuarios ADD COLUMN google_id TEXT');
} catch (e) { /* columna ya existe */ }

// ── Migración: campos de dirección/envío en usuarios ──────────
['estado','colonia','cp','direccion','referencias'].forEach(col => {
  try { db.exec(`ALTER TABLE usuarios ADD COLUMN ${col} TEXT`); } catch(e) {}
});

// ── Migración: email nullable (login por nombre) ──────────────
try {
  const emailCol = db.pragma('table_info(usuarios)').find(c => c.name === 'email');
  if (emailCol && emailCol.notnull === 1) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE usuarios_v2 (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre    TEXT    NOT NULL,
        email     TEXT    UNIQUE,
        password  TEXT    NOT NULL,
        rol       TEXT    NOT NULL DEFAULT 'cliente',
        telefono  TEXT,
        colegio   TEXT,
        ciudad    TEXT,
        activo    INTEGER NOT NULL DEFAULT 1,
        creado_en TEXT    NOT NULL DEFAULT (datetime('now')),
        google_id TEXT
      );
      INSERT INTO usuarios_v2
        SELECT id,nombre,email,password,rol,telefono,colegio,ciudad,activo,creado_en,google_id
        FROM usuarios;
      DROP TABLE usuarios;
      ALTER TABLE usuarios_v2 RENAME TO usuarios;
    `);
    db.pragma('foreign_keys = ON');
  }
} catch (e) { console.error('Migración email nullable:', e.message); }

// ── Tablas de imágenes de escuela y avances de pedido ─────────
db.exec(`
  CREATE TABLE IF NOT EXISTS escuela_imagenes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    colegio     TEXT    NOT NULL,
    tipo        TEXT    NOT NULL,
    filename    TEXT    NOT NULL,
    descripcion TEXT,
    creado_en   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pedido_avances (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    porcentaje  INTEGER NOT NULL DEFAULT 0,
    mensaje     TEXT,
    filename    TEXT,
    creado_en   TEXT    DEFAULT (datetime('now'))
  );
`);

// ── Tabla grupos ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS grupos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    nivel      TEXT NOT NULL,
    nombre     TEXT NOT NULL,
    colegio    TEXT NOT NULL,
    creado_en  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Migración: grupo_id en pedidos ────────────────────────────
try {
  db.exec('ALTER TABLE pedidos ADD COLUMN grupo_id INTEGER REFERENCES grupos(id)');
} catch (e) { /* columna ya existe */ }

// ── Migración: descuento en pedidos ───────────────────────────
try {
  db.exec('ALTER TABLE pedidos ADD COLUMN descuento INTEGER DEFAULT 0');
} catch (e) { /* columna ya existe */ }

// ── Tabla pagos ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS pagos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id  INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    monto      REAL    NOT NULL,
    tipo       TEXT    NOT NULL DEFAULT 'anticipo',
    fecha      TEXT    NOT NULL DEFAULT (date('now')),
    notas      TEXT,
    creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Crear admin por defecto si no existe ─────────────────────
const existing = db.prepare('SELECT id FROM usuarios WHERE rol = ?').get('admin');
if (!existing) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('Admin2026!', 10);
  db.prepare(`
    INSERT INTO usuarios (nombre, email, password, rol)
    VALUES (?, NULL, ?, 'admin')
  `).run('Administrador', hash);
  console.log('✅ Admin creado: Administrador / Admin2026!  ← CAMBIA ESTA CONTRASEÑA');
}

module.exports = db;
