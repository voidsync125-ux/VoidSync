const mongoose = require("mongoose");

const gameScoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    game: {
      type: String,
      required: true,
      enum: ["memory", "sequence", "nebula", "wordwarp"],
    },
    score: { type: Number, required: true },

    // For "sequence" this is the round reached, for "memory" the move count
    // (lower is better) - we store raw and compare per-game on the frontend.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

gameScoreSchema.index({ game: 1, score: -1 });
gameScoreSchema.index({ user: 1, game: 1 });

module.exports = mongoose.model("GameScore", gameScoreSchema);
