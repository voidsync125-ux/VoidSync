const express = require("express");
const { body, validationResult } = require("express-validator");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/dms ─────────────────────────────────────────────────────
// List all DM conversations for the current user, with the other
// participant's info and a last-message preview (WhatsApp-style list)
router.get("/", requireAuth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate("participants", "username avatarColor status")
      .populate("lastMessage.author", "username")
      .sort({ updatedAt: -1 });

    const result = conversations.map((c) => {
      const other = c.participants.find((p) => !p._id.equals(req.user._id));
      return {
        id: c._id,
        user: other
          ? {
              id: other._id,
              username: other.username,
              avatarColor: other.avatarColor,
              online: other.status === "online",
            }
          : null,
        lastMessage: c.lastMessage?.text
          ? {
              text: c.lastMessage.text,
              type: c.lastMessage.type,
              fromMe: c.lastMessage.author?._id?.equals(req.user._id),
              createdAt: c.lastMessage.createdAt,
            }
          : null,
        updatedAt: c.updatedAt,
      };
    });

    res.json({ conversations: result });
  } catch (err) {
    console.error("List DMs error:", err);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// ── POST /api/dms/start ──────────────────────────────────────────────
// Find or create a conversation with another user by their id or username
router.post("/start", requireAuth, async (req, res) => {
  try {
    const { userId, username } = req.body;

    let target;
    if (userId) target = await User.findById(userId);
    else if (username) target = await User.findOne({ username });

    if (!target) return res.status(404).json({ error: "User not found" });
    if (target._id.equals(req.user._id)) {
      return res.status(400).json({ error: "Cannot start a conversation with yourself" });
    }

    // Respect "allow DMs from anyone" preference unless they're friends
    const areFriends = req.user.friends.some((f) => f.equals(target._id));
    if (!areFriends && !target.preferences?.allowDmsFromAnyone) {
      return res.status(403).json({ error: `${target.username} only accepts DMs from friends` });
    }

    const convo = await Conversation.findOrCreateBetween(req.user._id, target._id);

    res.json({
      conversation: {
        id: convo._id,
        user: {
          id: target._id,
          username: target.username,
          avatarColor: target.avatarColor,
          online: target.status === "online",
        },
      },
    });
  } catch (err) {
    console.error("Start DM error:", err);
    res.status(500).json({ error: "Failed to start conversation" });
  }
});

// ── GET /api/dms/:id/messages?before=<messageId>&limit=50 ───────────
router.get("/:id/messages", requireAuth, async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    if (!convo.participants.some((p) => p.equals(req.user._id))) {
      return res.status(403).json({ error: "Not a participant in this conversation" });
    }

    const { before, limit = 50 } = req.query;
    const query = { conversation: convo._id, deletedAt: null };

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
    console.error("Get DM messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// ── POST /api/dms/:id/messages ───────────────────────────────────────
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
      const convo = await Conversation.findById(req.params.id);
      if (!convo) return res.status(404).json({ error: "Conversation not found" });
      if (!convo.participants.some((p) => p.equals(req.user._id))) {
        return res.status(403).json({ error: "Not a participant in this conversation" });
      }

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
        conversation: convo._id,
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

      // Update denormalized last-message preview
      convo.lastMessage = {
        text: type === "text" ? text?.trim() : type === "voice" ? "Voice message" : "Sent a file",
        type,
        author: req.user._id,
        createdAt: message.createdAt,
      };
      await convo.save();

      await message.populate("author", "username avatarColor");
      if (message.replyTo) await message.populate("replyTo", "text author");

      const payload = message.toPublicJSON();

      // Real-time: send to both participants' personal socket rooms
      const io = req.app.get("io");
      convo.participants.forEach((p) => {
        io?.to(`user:${p.toString()}`).emit("dm:new", { conversationId: convo._id, message: payload });
      });

      res.status(201).json({ message: payload });
    } catch (err) {
      console.error("Send DM error:", err);
      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

// ── POST /api/dms/:id/messages/:msgId/react ─────────────────────────
router.post("/:id/messages/:msgId/react", requireAuth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: "emoji is required" });

    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    if (!convo.participants.some((p) => p.equals(req.user._id))) {
      return res.status(403).json({ error: "Not a participant in this conversation" });
    }

    const message = await Message.findById(req.params.msgId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const current = message.reactions.get(emoji) || [];
    const userId = req.user._id;
    const idx = current.findIndex((id) => id.equals(userId));

    if (idx > -1) current.splice(idx, 1);
    else current.push(userId);

    if (current.length === 0) message.reactions.delete(emoji);
    else message.reactions.set(emoji, current);

    await message.save();
    const payload = message.toPublicJSON();

    const io = req.app.get("io");
    convo.participants.forEach((p) => {
      io?.to(`user:${p.toString()}`).emit("dm:reaction", {
        conversationId: convo._id,
        messageId: message._id,
        reactions: payload.reactions,
      });
    });

    res.json({ reactions: payload.reactions });
  } catch (err) {
    console.error("React to DM error:", err);
    res.status(500).json({ error: "Failed to react to message" });
  }
});

module.exports = router;
