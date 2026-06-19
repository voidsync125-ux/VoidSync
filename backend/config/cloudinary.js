const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary using env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Determine resource type + folder by mime type ──────────────────
function getUploadOptions(mimetype = "") {
  if (mimetype.startsWith("audio/")) {
    return { resource_type: "video", folder: "voidsync/voice" }; // Cloudinary uses "video" for audio
  }
  if (mimetype.startsWith("image/")) {
    return { resource_type: "image", folder: "voidsync/images" };
  }
  return { resource_type: "raw", folder: "voidsync/files" };
}

// ── Multer + Cloudinary storage ────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const opts = getUploadOptions(file.mimetype);
    return {
      folder: opts.folder,
      resource_type: opts.resource_type,
      // Keep original filename (sanitized) so downloads are readable
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      // For audio: set format so browser can play it
      ...(file.mimetype.startsWith("audio/") ? { format: "mp3" } : {}),
    };
  },
});

// File size limits per type
const limits = { fileSize: 50 * 1024 * 1024 }; // 50MB max

const upload = multer({
  storage,
  limits,
  fileFilter: (req, file, cb) => {
    // Block executables
    const blocked = [".exe", ".bat", ".sh", ".cmd", ".msi", ".dmg"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error("Executable files are not allowed"));
    }
    cb(null, true);
  },
});

module.exports = { cloudinary, upload, getUploadOptions };
