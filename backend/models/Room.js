const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 32,
      match: [/^[a-z0-9-]+$/, "Room name can only contain lowercase letters, numbers, and hyphens"],
    },
    displayName: { type: String, trim: true, maxlength: 40 }, // optional pretty name
    description: { type: String, default: "", maxlength: 200 },
    tag: { type: String, default: "General", maxlength: 20 },
    color: { type: String, default: "#00e5ff" }, // hex accent color for UI

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    isPrivate: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false }, // global pin (featured room)

    // Short code that lets anyone join via link, even private rooms.
    // Generated lazily on first request via /invite-code.
    inviteCode: { type: String, default: null, index: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

roomSchema.index({ name: 1 }, { unique: true });

roomSchema.methods.toPublicJSON = function (onlineCount = 0) {
  return {
    id: this._id,
    name: this.name,
    displayName: this.displayName || this.name,
    description: this.description,
    tag: this.tag,
    color: this.color,
    memberCount: this.members?.length || 0,
    onlineCount,
    isPrivate: this.isPrivate,
    pinned: this.pinned,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Room", roomSchema);
