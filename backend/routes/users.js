const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const Room = require("../models/Room");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/users/:username ─────────────────────────────────────────
// Public profile view (own or another user's) - matches the Profile page
router.get("/:username", requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).populate(
      "friends",
      "username avatarColor status"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const isSelf = user._id.equals(req.user._id);

    // Rooms this user is a member of
    const rooms = await Room.find({ members: user._id }).select("name displayName color");

    // Friends list shown depends on context:
    // - own profile -> all friends
    // - someone else's profile -> mutual friends only
    let friendsList = user.friends;
    if (!isSelf) {
      friendsList = user.friends.filter((f) =>
        req.user.friends.some((myFid) => myFid.equals(f._id))
      );
    }

    res.json({
      profile: {
        id: user._id,
        username: user.username,
        bio: user.bio,
        avatarColor: user.avatarColor,
        location: user.location,
        badges: user.badges,
        status: user.status,
        isSelf,
        isFriend: req.user.friends.some((f) => f.equals(user._id)),
        joined: user.createdAt,
        stats: {
          // messages/hours would normally be aggregated/cached; placeholder
          // logic here keeps the route self-contained.
          friends: user.friends.length,
          rooms: rooms.length,
        },
        rooms: rooms.map((r) => ({ id: r._id, name: r.displayName || r.name, color: r.color })),
        friends: friendsList.map((f) => ({
          id: f._id,
          username: f.username,
          avatarColor: f.avatarColor,
          online: f.status === "online",
        })),
      },
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// ── PATCH /api/users/me ───────────────────────────────────────────────
// Update own profile (bio, avatarColor, location)
router.patch(
  "/me",
  requireAuth,
  [
    body("bio").optional().isLength({ max: 280 }),
    body("location").optional().isLength({ max: 60 }),
    body("avatarColor").optional().isHexColor().withMessage("avatarColor must be a hex value"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const { bio, location, avatarColor } = req.body;
      if (bio !== undefined) req.user.bio = bio;
      if (location !== undefined) req.user.location = location;
      if (avatarColor !== undefined) req.user.avatarColor = avatarColor;

      await req.user.save();
      res.json({ user: req.user.toPublicJSON() });
    } catch (err) {
      console.error("Update profile error:", err);
      res.status(500).json({ error: "Failed to update profile" });
    }
  }
);

// ── PATCH /api/users/me/status ────────────────────────────────────────
// Update presence status (online/idle/dnd/invisible)
router.patch("/me/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["online", "idle", "dnd", "invisible"];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });
    }

    req.user.status = status;
    req.user.lastSeen = new Date();
    await req.user.save();

    // Broadcast presence change to friends
    const io = req.app.get("io");
    req.user.friends.forEach((fid) => {
      io?.to(`user:${fid.toString()}`).emit("presence:update", {
        userId: req.user._id,
        status,
      });
    });

    res.json({ status: req.user.status });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ── PATCH /api/users/me/preferences ───────────────────────────────────
// Update settings toggles (notifications, sounds, compact mode, DM policy)
router.patch("/me/preferences", requireAuth, async (req, res) => {
  try {
    const allowed = ["pushNotifications", "soundEffects", "compactMode", "allowDmsFromAnyone"];
    for (const key of allowed) {
      if (typeof req.body[key] === "boolean") {
        req.user.preferences[key] = req.body[key];
      }
    }
    await req.user.save();
    res.json({ preferences: req.user.preferences });
  } catch (err) {
    console.error("Update preferences error:", err);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// ── PATCH /api/users/me/password ──────────────────────────────────────
router.patch(
  "/me/password",
  requireAuth,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const match = await req.user.comparePassword(currentPassword);
      if (!match) return res.status(401).json({ error: "Current password is incorrect" });

      req.user.passwordHash = newPassword; // re-hashed by pre-save hook
      await req.user.save();

      res.json({ message: "Password updated" });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  }
);

// ── DELETE /api/users/me ───────────────────────────────────────────────
router.delete("/me", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.json({ message: "Account deleted" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

module.exports = router;
