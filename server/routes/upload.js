import { v2 as cloudinary } from 'cloudinary';
import { Router } from 'express';
import multer from 'multer';
import { cloudinaryConfigured, config } from '../config.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new AppError('Only JPG, PNG, WEBP, GIF or AVIF images are allowed', 400));
  },
});

function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: config.cloudinary.folder, resource_type: 'image' }, (err, result) =>
        err ? reject(err) : resolve(result.secure_url),
      )
      .end(buffer);
  });
}

const handler = [
  protect,
  restrictTo('admin'),
  (req, _res, next) => {
    if (!cloudinaryConfigured()) return next(new AppError('Image uploads are not configured. Paste an image URL instead.', 503));
    next();
  },
  upload.array('images', 10),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) throw new AppError('Choose at least one image', 400);
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true,
    });
    const urls = await Promise.all(req.files.map((f) => uploadBuffer(f.buffer)));
    res.status(201).json({ status: 'success', data: { urls } });
  }),
];

router.post('/', ...handler);
router.post('/add-new', ...handler);

export default router;
