// db/seed.js — Limpia la BD y crea usuarios de prueba
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');

const db = new Database(path.join(__dirname, 'pedidos.db'));
db.pragma('foreign_keys = OFF');

// ── 1. Limpiar todas las tablas ───────────────────────────────
db.exec(`
  DELETE FROM pedido_avances;
  DELETE FROM alumnos;
  DELETE FROM pedidos;
  DELETE FROM grupos;
  DELETE FROM escuela_imagenes;
  DELETE FROM usuarios;
  DELETE FROM sqlite_sequence WHERE name IN
    ('pedido_avances','alumnos','pedidos','grupos','escuela_imagenes','usuarios');
`);

// ── 2. Crear usuarios ─────────────────────────────────────────
const insert = db.prepare(`
  INSERT INTO usuarios (nombre, email, password, rol, colegio)
  VALUES (?, NULL, ?, ?, ?)
`);

const usuarios = [
  { nombre: 'Gabriela',     pass: 'admin',       rol: 'admin',        colegio: null          },
  { nombre: 'Oli',          pass: 'colaborador', rol: 'colaborador',  colegio: null          },
  { nombre: 'Paulo Freire', pass: 'escuela',     rol: 'cliente',      colegio: 'Paulo Freire'},
];

for (const u of usuarios) {
  const hash = bcrypt.hashSync(u.pass, 10);
  insert.run(u.nombre, hash, u.rol, u.colegio);
  console.log(`✅ ${u.rol.padEnd(12)} | ${u.nombre.padEnd(14)} | contraseña: ${u.pass}`);
}

db.pragma('foreign_keys = ON');
console.log('\n✔ Base de datos limpia y lista.');
