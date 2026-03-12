// middleware/upload.js — Configuración de multer para subida de imágenes

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Pre-crear los directorios al cargar el módulo para evitar errores en runtime
const BASE_UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
['escuelas', 'avances'].forEach(sub => {
  const dir = path.join(BASE_UPLOADS, sub);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
});

function makeStorage(subdir) {
  const targetDir = path.join(BASE_UPLOADS, subdir);
  return multer.diskStorage({
    destination(req, file, cb) {
      // Garantizar que el directorio exista (por si se borró en runtime)
      try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        cb(null, targetDir);
      } catch (err) {
        cb(err);
      }
    },
    filename(req, file, cb) {
      const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  });
}

const imgFilter = (req, file, cb) => {
  const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'), false);
};

const limits = { fileSize: 8 * 1024 * 1024 }; // 8 MB

const uploadEscuela = multer({ storage: makeStorage('escuelas'), fileFilter: imgFilter, limits });
const uploadAvance  = multer({ storage: makeStorage('avances'),  fileFilter: imgFilter, limits });

// Acepta imágenes Y video (para avances con múltiples archivos)
const mediaFilter = (req, file, cb) => {
  const ok = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm))$/i.test(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error('Solo imágenes (jpg, png, webp) o video (mp4, mov, webm)'), false);
};
const limitsMedia = { fileSize: 80 * 1024 * 1024 }; // 80 MB
const uploadMedia = multer({ storage: makeStorage('avances'), fileFilter: mediaFilter, limits: limitsMedia });

// Wrapper: llama multer y convierte errores a callback para responder JSON
function handleUpload(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ ok: false, msg: err.message || 'Error al subir archivo' });
      }
      next();
    });
  };
}

module.exports = { uploadEscuela, uploadAvance, uploadMedia, handleUpload };
