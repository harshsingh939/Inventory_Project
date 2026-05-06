const fs = require('fs');
const path = require('path');

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

/** Lazily require multer so the API can boot without it (bill upload returns 503 until `npm install`). */
let multerCache = undefined;

function getMulter() {
  if (multerCache !== undefined) return multerCache;
  try {
    const multer = require('multer');
    const fileFilter = (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXT.has(ext)) {
        return cb(null, true);
      }
      cb(new Error('Bill must be a PDF or image (JPEG, PNG, WebP)'));
    };
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'repair-bills');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safeExt = ALLOWED_EXT.has(ext) ? ext : '';
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
      },
    });
    const upload = multer({
      storage,
      limits: { fileSize: MAX_BYTES },
      fileFilter,
    });
    multerCache = { upload, MulterError: multer.MulterError };
    return multerCache;
  } catch (e) {
    console.warn(
      '[repairBillUpload] Optional package "multer" is missing — repair bill upload disabled. Run: npm install',
    );
    multerCache = null;
    return null;
  }
}

/** Optional single file field `repair_bill`; forwards Multer errors as 400 JSON */
function repairBillOptional(req, res, next) {
  const m = getMulter();
  if (!m) {
    return res.status(503).json({
      message: 'Bill upload needs the "multer" package. Open a terminal in the backend folder and run: npm install',
    });
  }
  m.upload.single('repair_bill')(req, res, (err) => {
    if (!err) {
      if (req.body == null || typeof req.body !== 'object') {
        req.body = {};
      }
      return next();
    }
    if (err instanceof m.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Bill file is too large (max 10 MB)' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    return res.status(400).json({ message: err.message || 'Invalid bill upload' });
  });
}

/** Run multer only for multipart PUT/POST so JSON bodies stay parsed by express.json */
function optionalMultipartRepairBill(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (ct.toLowerCase().includes('multipart/form-data')) {
    return repairBillOptional(req, res, next);
  }
  next();
}

module.exports = { repairBillOptional, optionalMultipartRepairBill };
