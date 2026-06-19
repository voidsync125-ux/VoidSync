const express = require("express");
const { body, validationResult } = require("express-validator");
const GameScore = require("../models/GameScore");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const VALID_GAMES = ["memory", "sequence", "nebula", "wordwarp"];

// Games where a LOWER score is better (e.g. fewer moves)
const LOWER_IS_BETTER = new Set(["memory"]);

// ── POST /api/arcade/scores ──────────────────────────────────────────
// Submit a score for a completed game session
router.post(
  "/scores",
  requireAuth,
  [
    body("game").isIn(VALID_GAMES).withMessage("Invalid game"),
    body("score").isNumeric().withMessage("score must be a number"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const { game, score, meta = {} } = req.body;

      const entry = await GameScore.create({
        user: req.user._id,
        game,
        score,
        meta,
      });

      // Compute this user's personal best for this game
      const sortDir = LOWER_IS_BETTER.has(game) ? 1 : -1;
      const best = await GameScore.findOne({ user: req.user._id, game }).sort({ score: sortDir });

      res.status(201).json({
        entry: { id: entry._id, game: entry.game, score: entry.score, createdAt: entry.createdAt },
        personalBest: best?.score ?? score,
        isNewBest: best?._id?.equals(entry._id) || false,
      });
    } catch (err) {
      console.error("Submit score error:", err);
      res.status(500).json({ error: "Failed to submit score" });
    }
  }
);

// ── GET /api/arcade/leaderboard/:game?scope=global|friends&limit=10 ─
// Top scores for a given game. scope=friends restricts to the user's
// friends + themselves (used for the social leaderboard).
router.get("/leaderboard/:game", requireAuth, async (req, res) => {
  try {
    const { game } = req.params;
    if (!VALID_GAMES.includes(game)) {
      return res.status(400).json({ error: "Invalid game" });
    }

    const { scope = "global", limit = 10 } = req.query;
    const sortDir = LOWER_IS_BETTER.has(game) ? 1 : -1;

    let userFilter = {};
    if (scope === "friends") {
      const ids = [...req.user.friends, req.user._id];
      userFilter = { user: { $in: ids } };
    }

    // Aggregate to get each user's BEST score for this game
    const results = await GameScore.aggregate([
      { $match: { game, ...userFilter } },
      {
        $group: {
          _id: "$user",
          bestScore: { $first: "$score" }, // overwritten below after sort
          score: { $push: "$score" },
        },
      },
    ]);

    // The aggregation above isn't quite right for "best" without a pre-sort,
    // so do it the straightforward way: fetch all, reduce in JS. Score
    // volumes per game are small enough for this to be fine.
    const all = await GameScore.find({ game, ...userFilter })
      .populate("user", "username avatarColor")
      .sort({ score: sortDir });

    const bestByUser = new Map();
    for (const entry of all) {
      if (!entry.user) continue;
      const uid = entry.user._id.toString();
      if (!bestByUser.has(uid)) {
        bestByUser.set(uid, {
          user: { id: entry.user._id, username: entry.user.username, avatarColor: entry.user.avatarColor },
          score: entry.score,
          achievedAt: entry.createdAt,
        });
      }
    }

    const leaderboard = Array.from(bestByUser.values())
      .sort((a, b) => (sortDir === 1 ? a.score - b.score : b.score - a.score))
      .slice(0, Math.min(parseInt(limit, 10) || 10, 50))
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    res.json({ game, scope, leaderboard });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// ── GET /api/arcade/me ────────────────────────────────────────────────
// Current user's personal best across all games
router.get("/me", requireAuth, async (req, res) => {
  try {
    const bests = {};
    for (const game of VALID_GAMES) {
      const sortDir = LOWER_IS_BETTER.has(game) ? 1 : -1;
      const best = await GameScore.findOne({ user: req.user._id, game }).sort({ score: sortDir });
      const playCount = await GameScore.countDocuments({ user: req.user._id, game });
      bests[game] = { best: best?.score ?? null, playCount };
    }
    res.json({ bests });
  } catch (err) {
    console.error("Get personal bests error:", err);
    res.status(500).json({ error: "Failed to load personal bests" });
  }
});

module.exports = router;
