const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const Room = require("../models/Room");
const Message = require("../models/Message");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/rooms ──────────────────────────────────────────────────
// List all public rooms (+ private rooms the user is a member of)
router.get("/", requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [{ isPrivate: false }, { members: req.user._id }],
    }).sort({ pinned: -1, createdAt: 1 });

    res.json({
      rooms: rooms.map((r) => ({
        ...r.toPublicJSON(0),
        isMember: r.members.some((m) => m.equals(req.user._id)),
      })),
    });
  } catch (err) {
    console.error("List rooms error:", err);
    res.status(500).json({ error: "Failed to load rooms" });
  }
});

// ── POST /api/rooms ──────────────────────────────────────────────────
// Create a new room
router.post(
  "/",
  requireAuth,
  [
    body("name")
      .trim()
      .toLowerCase()
      .isLength({ min: 2, max: 32 })
      .withMessage("Room name must be 2-32 characters")
      .matches(/^[a-z0-9-]+$/)
      .withMessage("Room name can only contain lowercase letters, numbers, and hyphens"),
    body("description").optional().isLength({ max: 200 }),
    body("tag").optional().isLength({ max: 20 }),
    body("color").optional().isHexColor().withMessage("Color must be a hex value"),
    body("isPrivate").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, displayName, description, tag, color, isPrivate } = req.body;

    try {
      const existing = await Room.findOne({ name });
      if (existing) {
        return res.status(409).json({ error: "A room with that name already exists" });
      }

      const room = await Room.create({
        name,
        displayName,
        description,
        tag,
        color,
        isPrivate: !!isPrivate,
        owner: req.user._id,
        members: [req.user._id],
        admins: [req.user._id],
      });

      res.status(201).json({ room: room.toPublicJSON(1) });
    } catch (err) {
      console.error("Create room error:", err);
      res.status(500).json({ error: "Failed to create room" });
    }
  }
);

// ── POST /api/rooms/:id/join ────────────────────────────────────────
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.isPrivate && !room.members.some((m) => m.equals(req.user._id))) {
      return res.status(403).json({ error: "This room is private" });
    }

    if (!room.members.some((m) => m.equals(req.user._id))) {
      room.members.push(req.user._id);
      await room.save();
    }

    res.json({ room: room.toPublicJSON(room.members.length) });
  } catch (err) {
    console.error("Join room error:", err);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// ── POST /api/rooms/:id/leave ───────────────────────────────────────
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    room.members = room.members.filter((m) => !m.equals(req.user._id));
    room.admins = room.admins.filter((m) => !m.equals(req.user._id));
    await room.save();

    res.json({ message: "Left room" });
  } catch (err) {
    console.error("Leave room error:", err);
    res.status(500).json({ error: "Failed to leave room" });
  }
});

// ── GET /api/rooms/:id/invite-code ──────────────────────────────────
// Returns the room's invite code, generating one on first request.
// Any current member can view it.
router.get("/:id/invite-code", requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (!room.members.some((m) => m.equals(req.user._id))) {
      return res.status(403).json({ error: "You must be a member to view the invite code" });
    }

    if (!room.inviteCode) {
      room.inviteCode = crypto.randomBytes(5).toString("hex"); // 10-char code
      await room.save();
    }

    res.json({ inviteCode: room.inviteCode });
  } catch (err) {
    console.error("Get invite code error:", err);
    res.status(500).json({ error: "Failed to get invite code" });
  }
});

// ── POST /api/rooms/:id/invite-code/regenerate ──────────────────────
// Owner/admin can rotate the code to invalidate old links.
router.post("/:id/invite-code/regenerate", requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const isAdmin = room.owner.equals(req.user._id) || room.admins.some((a) => a.equals(req.user._id));
    if (!isAdmin) return res.status(403).json({ error: "Only the room owner or admins can regenerate the invite code" });

    room.inviteCode = crypto.randomBytes(5).toString("hex");
    await room.save();

    res.json({ inviteCode: room.inviteCode });
  } catch (err) {
    console.error("Regenerate invite code error:", err);
    res.status(500).json({ error: "Failed to regenerate invite code" });
  }
});

// ── POST /api/rooms/join-by-code/:code ──────────────────────────────
// Join any room (including private ones) using its invite code.
router.post("/join-by-code/:code", requireAuth, async (req, res) => {
  try {
    const room = await Room.findOne({ inviteCode: req.params.code });
    if (!room) return res.status(404).json({ error: "Invalid or expired invite code" });

    if (!room.members.some((m) => m.equals(req.user._id))) {
      room.members.push(req.user._id);
      await room.save();
    }

    res.json({ room: room.toPublicJSON(room.members.length) });
  } catch (err) {
    console.error("Join by code error:", err);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// ── POST /api/rooms/:id/invite ───────────────────────────────────────
// Invite a specific user by username. For private rooms, this is the
// only way to add someone (besides sharing the invite code/link).
// Any current member can invite others.
router.post(
  "/:id/invite",
  requireAuth,
  [body("username").trim().notEmpty().withMessage("username is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const room = await Room.findById(req.params.id);
      if (!room) return res.status(404).json({ error: "Room not found" });

      if (!room.members.some((m) => m.equals(req.user._id))) {
        return res.status(403).json({ error: "You must be a member of this room to invite others" });
      }

      const target = await User.findOne({ username: req.body.username });
      if (!target) return res.status(404).json({ error: "User not found" });

      if (room.members.some((m) => m.equals(target._id))) {
        return res.status(409).json({ error: `${target.username} is already in this room` });
      }

      room.members.push(target._id);
      await room.save();

      // Real-time: let the invited user know via their personal socket room
      req.app.get("io")?.to(`user:${target._id.toString()}`).emit("room:invited", {
        room: room.toPublicJSON(room.members.length),
        invitedBy: req.user.username,
      });

      res.json({ message: `${target.username} added to the room` });
    } catch (err) {
      console.error("Invite to room error:", err);
      res.status(500).json({ error: "Failed to invite user" });
    }
  }
);


router.get("/:id/members", requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate(
      "members",
      "username avatarColor status"
    );
    if (!room) return res.status(404).json({ error: "Room not found" });

    const members = room.members.map((m) => ({
      id: m._id,
      username: m.username,
      avatarColor: m.avatarColor,
      online: m.status === "online",
      role: room.owner.equals(m._id)
        ? "admin"
        : room.admins.some((a) => a.equals(m._id))
        ? "mod"
        : "member",
    }));

    res.json({ members });
  } catch (err) {
    console.error("Get members error:", err);
    res.status(500).json({ error: "Failed to load members" });
  }
});

// ── GET /api/rooms/:id/messages?before=<messageId>&limit=50 ────────
// Paginated message history, newest-first input but returned oldest-first
router.get("/:id/messages", requireAuth, async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    const query = { room: req.params.id, deletedAt: null };

    if (before) {
      const beforeMsg = await Message.findById(before);
      if (beforeMsg) query.createdAt = { $lt: beforeMsg.createdAt };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 50, 100))
      .populate("author", "username avatarColor")
      .populate("replyTo", "text author");

    res.json({ messages: messages.reverse().map((m) => m.toPublicJSON()) });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// ── POST /api/rooms/:id/messages ────────────────────────────────────
// Send a message to a room (also emitted via socket for real-time delivery)
router.post(
  "/:id/messages",
  requireAuth,
  [
    body("type").optional().isIn(["text", "voice", "file", "image"]),
    body("text").optional().isLength({ max: 4000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const room = await Room.findById(req.params.id);
      if (!room) return res.status(404).json({ error: "Room not found" });

      const {
        type = "text",
        text,
        replyTo,
        voiceUrl,
        duration,
        fileUrl,
        fileName,
        fileSize,
      } = req.body;

      if (type === "text" && (!text || !text.trim())) {
        return res.status(400).json({ error: "Message text cannot be empty" });
      }

      const message = await Message.create({
        room: room._id,
        author: req.user._id,
        type,
        text: text?.trim(),
        replyTo: replyTo || null,
        voiceUrl,
        duration,
        fileUrl,
        fileName,
        fileSize,
      });

      await message.populate("author", "username avatarColor");
      if (message.replyTo) await message.populate("replyTo", "text author");

      const payload = message.toPublicJSON();

      // Real-time: broadcast to everyone in the room via Socket.IO
      req.app.get("io")?.to(`room:${room._id}`).emit("message:new", payload);

      res.status(201).json({ message: payload });
    } catch (err) {
      console.error("Send message error:", err);
      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

// ── POST /api/rooms/:id/messages/:msgId/react ───────────────────────
// Toggle a reaction (emoji) on a message for the current user
router.post("/:id/messages/:msgId/react", requireAuth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: "emoji is required" });

    const message = await Message.findById(req.params.msgId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const current = message.reactions.get(emoji) || [];
    const userId = req.user._id;
    const idx = current.findIndex((id) => id.equals(userId));

    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      current.push(userId);
    }

    if (current.length === 0) {
      message.reactions.delete(emoji);
    } else {
      message.reactions.set(emoji, current);
    }

    await message.save();
    const payload = message.toPublicJSON();

    req.app.get("io")?.to(`room:${message.room}`).emit("message:reaction", {
      messageId: message._id,
      reactions: payload.reactions,
    });

    res.json({ reactions: payload.reactions });
  } catch (err) {
    console.error("React to message error:", err);
    res.status(500).json({ error: "Failed to react to message" });
  }
});

module.exports = router;
