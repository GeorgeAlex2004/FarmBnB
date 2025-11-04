const express = require('express');
const multer = require('multer');
const path = require('path');
const { verifyFirebaseToken, requireAdmin } = require('../middleware/firebaseAuth');
const { supabase } = require('../utils/supabase');

const router = express.Router();

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'images';

// Configure multer for in-memory uploads (we forward to Supabase)
const storage = multer.memoryStorage();

// File filter: allow images and videos
const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error('Only image or video files are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    // Allow larger uploads by default to support videos; override with MAX_FILE_SIZE
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB default
  },
  fileFilter
});

// @route   POST /api/upload/image
// @desc    Upload single image
// @access  Private (Admin only for properties)
router.post('/image', verifyFirebaseToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname) || '.bin';
    const uniqueName = `property-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = `properties/${uniqueName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ success: false, message: 'Upload failed', error: uploadError.message });
    }

    // Prefer a public URL so images don't expire (ensure bucket is public)
    const { data: publicData } = await supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);
    const publicUrl = publicData?.publicUrl;

    // Also generate a short-lived signed URL (optional)
    const { data: signed, error: signedErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60);

    res.json({
      success: true,
      data: {
        url: publicUrl || signed?.signedUrl,
        path: filePath,
        bucket: BUCKET,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        signedUrl: signed?.signedUrl,
        publicUrl,
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

// @route   POST /api/upload/images
// @desc    Upload multiple images
// @access  Private (Admin only)
router.post('/images', verifyFirebaseToken, requireAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const results = [];
    for (const f of files) {
      const ext = path.extname(f.originalname) || '.bin';
      const uniqueName = `property-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = `properties/${uniqueName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, f.buffer, { contentType: f.mimetype, upsert: false });
      if (uploadError) {
        return res.status(500).json({ success: false, message: 'Upload failed', error: uploadError.message });
      }

      const { data: publicData } = await supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);
      const publicUrl = publicData?.publicUrl;
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 60 * 60);

      results.push({
        url: publicUrl || signed?.signedUrl,
        path: filePath,
        bucket: BUCKET,
        originalName: f.originalname,
        size: f.size,
        mimeType: f.mimetype,
        signedUrl: signed?.signedUrl,
        publicUrl,
      });
    }

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

// @route   POST /api/upload/videos
// @desc    Upload multiple videos
// @access  Private (Admin only)
router.post('/videos', verifyFirebaseToken, requireAdmin, upload.array('videos', 5), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const results = [];
    for (const f of files) {
      if (!f.mimetype.startsWith('video/')) {
        return res.status(400).json({ success: false, message: 'Non-video file detected in videos upload' });
      }

      const ext = path.extname(f.originalname) || '.bin';
      const uniqueName = `property-video-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = `properties/${uniqueName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, f.buffer, { contentType: f.mimetype, upsert: false });
      if (uploadError) {
        return res.status(500).json({ success: false, message: 'Upload failed', error: uploadError.message });
      }

      const { data: publicData } = await supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);
      const publicUrl = publicData?.publicUrl;
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 60 * 60);

      results.push({
        url: publicUrl || signed?.signedUrl,
        path: filePath,
        bucket: BUCKET,
        originalName: f.originalname,
        size: f.size,
        mimeType: f.mimetype,
        signedUrl: signed?.signedUrl,
        publicUrl,
      });
    }

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

// @route   DELETE /api/upload/image/:filename
// @desc    Delete uploaded image
// @access  Private (Admin only)
router.delete('/image/:path(*)', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const storagePath = req.params.path;
    if (!storagePath) {
      return res.status(400).json({ success: false, message: 'Missing path' });
    }

    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) {
      return res.status(500).json({ success: false, message: 'Failed to delete image', error: error.message });
    }

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete image', error: error.message });
  }
});

module.exports = router;

