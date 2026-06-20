const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // Exactly one of `room` or `conversation` should be set.
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", default: null },

    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: ["text", "voice", "file", "image"],
      default: "text",
    },

    // type: "text"
    text: { type: String, maxlength: 4000 },

    // type: "voice"
    voiceUrl: { type: String }, // URL to stored audio file
    duration: { type: Number }, // seconds

    // type: "file" / "image"
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number }, // bytes

    // Reply threading - references another message
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },

    // Reactions: map of emoji -> array of user ids who reacted
    reactions: {
      type: Map,
      of: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: {},
    },

    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null }, // soft delete
  },
  { timestamps: true }
);

// Either room or conversation must be set, never both
messageSchema.pre("validate", function (next) {
  if (!this.room && !this.conversation) {
    return next(new Error("Message must belong to a room or a conversation"));
  }
  if (this.room && this.conversation) {
    return next(new Error("Message cannot belong to both a room and a conversation"));
  }
  next();
});

messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });

messageSchema.methods.toPublicJSON = function () {
  // Convert Map<string, ObjectId[]> -> { emoji: [userId, ...] }
  const reactions = {};
  if (this.reactions) {
    for (const [emoji, userIds] of this.reactions.entries()) {
      if (userIds && userIds.length) reactions[emoji] = userIds.map((id) => id.toString());
    }
  }

  return {
    id: this._id,
    room: this.room,
    conversation: this.conversation,
    author: this.author, // populate before sending for username/color
    type: this.type,
    text: this.deletedAt ? null : this.text,
    // Frontend expects:
    // - msg.type === "voice" and msg.fileUrl for <audio src>
    // - msg.type in ["file","image"] and msg.fileUrl for downloads/images
    // Backend stores voice audio in voiceUrl, so normalize it to fileUrl.
    // (Keeps voiceUrl too for backward compatibility.)
    voiceUrl: this.voiceUrl,
    duration: this.duration,
    fileUrl: this.type === "voice" ? this.voiceUrl : this.fileUrl,
    fileName: this.fileName,
    fileSize: this.fileSize,
    // replyTo is populated as an object; frontend expects replyTo.author.username + replyTo.text
    replyTo: this.replyTo,
    reactions,
    edited: !!this.editedAt,
    deleted: !!this.deletedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Message", messageSchema);
