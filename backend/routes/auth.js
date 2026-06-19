const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { requireAuth, signToken } = require("../middleware/auth");

const router = express.Router();

// ── POST /api/auth/signup ──────────────────────────────────────────
router.post(
  "/signup",
  [
    body("username")
      .trim()
      .isLength({ min: 2, max: 24 })
      .withMessage("Username must be 2-24 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Username can only contain letters, numbers, and underscores"),
    body("email").isEmail().withMessage("Enter a valid email address").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
      const existing = await User.findOne({ $or: [{ email }, { username }] });
      if (existing) {
        const field = existing.email === email ? "email" : "username";
        return res.status(409).json({ error: `That ${field} is already taken` });
      }

      const user = await User.create({
        username,
        email,
        passwordHash: password, // hashed by pre-save hook
        status: "online",
        badges: ["Early Traveller"],
      });

      const token = signToken(user._id);
      res.status(201).json({ token, user: user.toPublicJSON() });
    } catch (err) {
      console.error("Signup error:", err);
      res.status(500).json({ error: "Something went wrong during signup" });
    }
  }
);

// ── POST /api/auth/login ───────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Enter a valid email address").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const match = await user.comparePassword(password);
      if (!match) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      user.status = "online";
      user.lastSeen = new Date();
      await user.save();

      const token = signToken(user._id);
      res.json({ token, user: user.toPublicJSON() });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Something went wrong during login" });
    }
  }
);

// ── GET /api/auth/me ────────────────────────────────────────────────
// Returns the currently authenticated user (used to restore session on app load)
router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

// ── POST /api/auth/logout ───────────────────────────────────────────
// Stateless JWT - logout is mostly client-side (discard token), but we
// update presence status server-side for accuracy.
router.post("/logout", requireAuth, async (req, res) => {
  req.user.status = "offline";
  req.user.lastSeen = new Date();
  await req.user.save();
  res.json({ message: "Logged out" });
});

module.exports = router;
