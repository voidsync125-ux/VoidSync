const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 24,
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    passwordHash: {
      type: String,
      required: true,
    },

    // Profile
    bio: { type: String, default: "", maxlength: 280 },
    avatarColor: { type: String, default: "#00e5ff" }, // hex color for avatar gradient
    location: { type: String, default: "The Void", maxlength: 60 },
    badges: [{ type: String }], // e.g. ["Early Traveller", "Founder"]

    // Presence
    status: {
      type: String,
      enum: ["online", "idle", "dnd", "invisible", "offline"],
      default: "offline",
    },
    lastSeen: { type: Date, default: Date.now },

    // Social graph
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Preferences (from Settings page)
    preferences: {
      pushNotifications: { type: Boolean, default: true },
      soundEffects: { type: Boolean, default: false },
      compactMode: { type: Boolean, default: false },
      allowDmsFromAnyone: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Compare plaintext password to stored hash
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Strip sensitive fields when sending to client
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    bio: this.bio,
    avatarColor: this.avatarColor,
    location: this.location,
    badges: this.badges,
    status: this.status,
    lastSeen: this.lastSeen,
    friendCount: this.friends?.length || 0,
    preferences: this.preferences,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
