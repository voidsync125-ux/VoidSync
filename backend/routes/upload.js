const express = require("express");
const { upload, getUploadOptions } = require("../config/cloudinary");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ── POST /api/upload ─────────────────────────────────────────────────
// Accepts a single file field named "file".
// Returns the Cloudinary URL, resource type, original filename, and size.
// Used by the Chat frontend before sending a message.
//
// Example response:
// {
//   url: "https://res.cloudinary.com/...",
//   type: "image" | "file" | "voice",
//   fileName: "photo.jpg",
//   fileSize: 204800,
//   mimeType: "image/jpeg"
// }
router.post(
  "/",
  requireAuth,
  (req, res, next) => {
    // Run multer upload, catch multer-level errors (file too large, blocked type)
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const mime = req.file.mimetype || "";
      let type = "file";
      if (mime.startsWith("image/")) type = "image";
      else if (mime.startsWith("audio/")) type = "voice";

      res.json({
        url:      req.file.path,         // Cloudinary secure URL
        type,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: mime,
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

module.exports = router;
