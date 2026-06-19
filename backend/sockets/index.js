const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Tracks how many sockets each user currently has open (a user can have
// multiple tabs/devices). Only flips status to "offline" when the count
// reaches zero.
const userSocketCounts = new Map();

function initSocket(io) {
  // ── Authenticate every socket connection via JWT ───────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.user;
    console.log(`✦ Socket connected: ${user.username} (${socket.id})`);

    // Personal room for DMs / notifications targeted at this user
    socket.join(`user:${user._id}`);

    // Mark user online (only if this is their first active connection)
    const count = (userSocketCounts.get(user._id.toString()) || 0) + 1;
    userSocketCounts.set(user._id.toString(), count);

    if (count === 1 && user.status !== "invisible") {
      user.status = "online";
      await user.save();
      broadcastPresence(io, user, "online");
    }

    // ── Join a room's channel (for real-time messages) ────────────────
    socket.on("room:join", (roomId) => {
      socket.join(`room:${roomId}`);
    });

    socket.on("room:leave", (roomId) => {
      socket.leave(`room:${roomId}`);
    });

    // ── Typing indicators ──────────────────────────────────────────────
    // payload: { roomId } or { conversationId }
    socket.on("typing:start", (payload) => {
      const channel = payload.roomId ? `room:${payload.roomId}` : `user:${payload.recipientId}`;
      socket.to(channel).emit("typing:start", {
        userId: user._id,
        username: user.username,
        roomId: payload.roomId,
        conversationId: payload.conversationId,
      });
    });

    socket.on("typing:stop", (payload) => {
      const channel = payload.roomId ? `room:${payload.roomId}` : `user:${payload.recipientId}`;
      socket.to(channel).emit("typing:stop", {
        userId: user._id,
        roomId: payload.roomId,
        conversationId: payload.conversationId,
      });
    });

    // ── Voice channel presence (lightweight - no actual audio relay) ──
    socket.on("voice:join", (channelId) => {
      socket.join(`voice:${channelId}`);
      io.to(`voice:${channelId}`).emit("voice:user-joined", {
        userId: user._id,
        username: user.username,
        channelId,
      });
    });

    socket.on("voice:leave", (channelId) => {
      socket.leave(`voice:${channelId}`);
      io.to(`voice:${channelId}`).emit("voice:user-left", {
        userId: user._id,
        channelId,
      });
    });

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`✕ Socket disconnected: ${user.username} (${socket.id})`);

      const remaining = (userSocketCounts.get(user._id.toString()) || 1) - 1;
      if (remaining <= 0) {
        userSocketCounts.delete(user._id.toString());
        const freshUser = await User.findById(user._id);
        if (freshUser && freshUser.status !== "invisible") {
          freshUser.status = "offline";
          freshUser.lastSeen = new Date();
          await freshUser.save();
          broadcastPresence(io, freshUser, "offline");
        }
      } else {
        userSocketCounts.set(user._id.toString(), remaining);
      }
    });
  });
}

// Notify all of a user's friends that their presence changed
async function broadcastPresence(io, user, status) {
  user.friends.forEach((friendId) => {
    io.to(`user:${friendId.toString()}`).emit("presence:update", {
      userId: user._id,
      status,
    });
  });
}

module.exports = initSocket;
