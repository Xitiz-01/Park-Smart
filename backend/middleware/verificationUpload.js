const multer = require('multer');

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 8 },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return callback(Object.assign(new Error('Only PDF, JPEG, and PNG documents are allowed'), { statusCode: 400 }));
    }
    return callback(null, true);
  },
});

const hasValidSignature = (file) => {
  if (!file?.buffer?.length) return false;
  const bytes = file.buffer;
  if (file.mimetype === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (file.mimetype === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return false;
};

const validateUploadedDocument = (req, res, next) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Select a document to upload' });
  if (!hasValidSignature(req.file)) return res.status(400).json({ success: false, message: 'File content does not match its declared type' });
  return next();
};

module.exports = { verificationUpload: upload.single('document'), validateUploadedDocument, MAX_BYTES };
