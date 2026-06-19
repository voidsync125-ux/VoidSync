const mongoose = require("mongoose");

// Friend requests are tracked separately from User.friends.
// Once accepted, both users get added to each other's `friends` array
// and the request is marked accepted (kept for history) or removed.
const friendRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model("FriendRequest", friendRequestSchema);
