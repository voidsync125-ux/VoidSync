const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    // Always exactly 2 participants for a DM
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],

    // Denormalized for quick "last message preview" in DM list
    lastMessage: {
      text: { type: String, default: "" },
      type: { type: String, default: "text" },
      author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Ensure we never create duplicate conversations between the same 2 users
conversationSchema.index({ participants: 1 });

// Static helper: find or create a conversation between two users
conversationSchema.statics.findOrCreateBetween = async function (userIdA, userIdB) {
  const participants = [userIdA, userIdB].sort();
  let convo = await this.findOne({
    participants: { $all: participants, $size: 2 },
  });
  if (!convo) {
    convo = await this.create({ participants });
  }
  return convo;
};

module.exports = mongoose.model("Conversation", conversationSchema);
