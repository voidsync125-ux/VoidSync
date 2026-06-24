const express = require("express");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/friends ─────────────────────────────────────────────────
// List the current user's friends, split by online/offline (as the
// Friends dashboard view expects)
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "friends",
      "username avatarColor status lastSeen"
    );

    const friends = user.friends.map((f) => ({
      id: f._id,
      username: f.username,
      avatarColor: f.avatarColor,
      online: f.status === "online",
      status: f.status,
    }));

    res.json({ friends });
  } catch (err) {
    console.error("List friends error:", err);
    res.status(500).json({ error: "Failed to load friends" });
  }
});

// ── GET /api/friends/requests ────────────────────────────────────────
// Pending friend requests sent TO the current user
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ to: req.user._id, status: "pending" })
      .populate("from", "username avatarColor")
      .sort({ createdAt: -1 });

    const result = await Promise.all(
      requests.map(async (r) => {
        // Mutual friends count
        const sender = await User.findById(r.from._id).select("friends");
        const mutual = sender.friends.filter((fid) =>
          req.user.friends.some((myFid) => myFid.equals(fid))
        ).length;

        return {
          id: r._id,
          from: {
            id: r.from._id,
            username: r.from.username,
            avatarColor: r.from.avatarColor,
          },
          mutualFriends: mutual,
          createdAt: r.createdAt,
        };
      })
    );

    res.json({ requests: result });
  } catch (err) {
    console.error("List friend requests error:", err);
    res.status(500).json({ error: "Failed to load friend requests" });
  }
});

// ── POST /api/friends/requests ───────────────────────────────────────
// Send a friend request by username
router.post("/requests", requireAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "username is required" });

    const target = await User.findOne({ username });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target._id.equals(req.user._id)) {
      return res.status(400).json({ error: "You can't send yourself a friend request" });
    }

    if (req.user.friends.some((f) => f.equals(target._id))) {
      return res.status(409).json({ error: "You're already friends" });
    }

    // Check for existing request in either direction
    const existing = await FriendRequest.findOne({
      $or: [
        { from: req.user._id, to: target._id },
        { from: target._id, to: req.user._id },
      ],
      status: "pending",
    });

    if (existing) {
      if (existing.from.equals(req.user._id)) {
        return res.status(409).json({ error: "Friend request already sent" });
      }
      // The target already sent us a request -> auto-accept it
      existing.status = "accepted";
      await existing.save();
      req.user.friends.push(target._id);
      target.friends.push(req.user._id);
      await req.user.save();
      await target.save();
      return res.json({ message: "Friend request accepted (you had a pending request from them)" });
    }

    await FriendRequest.create({ from: req.user._id, to: target._id });
    res.status(201).json({ message: "Friend request sent" });
  } catch (err) {
    console.error("Send friend request error:", err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// ── POST /api/friends/requests/:id/accept ────────────────────────────
router.post("/requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (!request.to.equals(req.user._id)) {
      return res.status(403).json({ error: "Not authorized to accept this request" });
    }
    if (request.status !== "pending") {
      return res.status(409).json({ error: "Request already resolved" });
    }

    request.status = "accepted";
    await request.save();

    const sender = await User.findById(request.from);
    if (!req.user.friends.some((f) => f.equals(sender._id))) {
      req.user.friends.push(sender._id);
      await req.user.save();
    }
    if (!sender.friends.some((f) => f.equals(req.user._id))) {
      sender.friends.push(req.user._id);
      await sender.save();
    }

    res.json({ message: "Friend request accepted" });
  } catch (err) {
    console.error("Accept friend request error:", err);
    res.status(500).json({ error: "Failed to accept friend request" });
  }
});

// ── POST /api/friends/requests/:id/decline ───────────────────────────
router.post("/requests/:id/decline", requireAuth, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (!request.to.equals(req.user._id)) {
      return res.status(403).json({ error: "Not authorized to decline this request" });
    }

    request.status = "declined";
    await request.save();

    res.json({ message: "Friend request declined" });
  } catch (err) {
    console.error("Decline friend request error:", err);
    res.status(500).json({ error: "Failed to decline friend request" });
  }
});

// ── DELETE /api/friends/:userId ──────────────────────────────────────
// Remove a friend (unfriend, both directions)
router.delete("/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const other = await User.findById(userId);
    if (!other) return res.status(404).json({ error: "User not found" });

    req.user.friends = req.user.friends.filter((f) => !f.equals(other._id));
    other.friends = other.friends.filter((f) => !f.equals(req.user._id));

    await req.user.save();
    await other.save();

    res.json({ message: "Friend removed" });
  } catch (err) {
    console.error("Remove friend error:", err);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// ── GET /api/friends/search?q=<query> ────────────────────────────────
// Search users by username (for "Add Friend")
router.get("/search", requireAuth, async (req, res) => {
  try {
    const { q = "" } = req.query;
    if (!q.trim()) return res.json({ users: [] });

    const users = await User.find({
      username: { $regex: q.trim(), $options: "i" },
      _id: { $ne: req.user._id },
    })
      .select("username avatarColor status")
      .limit(10);

    res.json({
      users: users.map((u) => ({
        id: u._id,
        username: u.username,
        avatarColor: u.avatarColor,
        online: u.status === "online",
        isFriend: req.user.friends.some((f) => f.equals(u._id)),
      })),
    });
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
});

// ── GET /api/friends/suggestions?limit=12 ───────────────────────────
// Returns users who are NOT already friends with the current user,
// sorted by mutual friend count (most mutuals first) — shown as
// "People you may know" on the Friends page before the user searches.
router.get("/suggestions", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 30);

    // Get ids to exclude: self + existing friends + users we've already
    // sent a pending request to (so we don't re-suggest them)
    const FriendRequestModel = require("../models/FriendRequest");
    const sentRequests = await FriendRequestModel.find({
      from: req.user._id,
      status: "pending",
    }).select("to");
    const sentToIds = sentRequests.map((r) => r.to);

    const excludeIds = [
      req.user._id,
      ...req.user.friends,
      ...sentToIds,
    ];

    // Fetch a pool of candidates (not in excludeIds)
    const candidates = await User.find({
      _id: { $nin: excludeIds },
    })
      .select("username avatarColor status friends")
      .limit(60); // fetch more than needed so we can sort by mutuals

    // Count mutual friends for each candidate
    const myFriendSet = new Set(req.user.friends.map((f) => f.toString()));

    const withMutuals = candidates.map((u) => {
      const mutuals = (u.friends || []).filter((fid) =>
        myFriendSet.has(fid.toString())
      ).length;
      return {
        id: u._id,
        username: u.username,
        avatarColor: u.avatarColor,
        online: u.status === "online",
        mutualFriends: mutuals,
        requested: false,
      };
    });

    // Sort by mutual count descending, then shuffle within same-mutual
    // groups so repeat visits feel fresh
    withMutuals.sort((a, b) => {
      if (b.mutualFriends !== a.mutualFriends) return b.mutualFriends - a.mutualFriends;
      return Math.random() - 0.5;
    });

    res.json({ suggestions: withMutuals.slice(0, limit) });
  } catch (err) {
    console.error("Friend suggestions error:", err);
    res.status(500).json({ error: "Failed to load suggestions" });
  }
});

module.exports = router;
