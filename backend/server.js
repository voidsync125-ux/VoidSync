require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const initSocket = require("./sockets");

function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("✕ Missing required env vars:", missing.join(", "));
    process.exit(1);
  }
}

// Validate critical env vars early so Render shows a clear startup error
requireEnv(["MONGO_URI", "JWT_SECRET"]);

// Ensure frontend origin is allowed by CORS (needed for deployed frontend)
// Render backend: https://voidsync-rnvm.onrender.com
// Frontend (Vercel): https://voidsync.vercel.app
if (!process.env.CLIENT_URL) {
  process.env.CLIENT_URL = "https://voidsync.vercel.app";
}

// Allow the dev host too (helps prevent accidental preflight failures
// during local testing with the same backend build). Also allow Vercel
// preview domains if you use them.
const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "https://voidsync.vercel.app",
]);

// Routes
const authRoutes   = require("./routes/auth");
const roomRoutes   = require("./routes/rooms");
const dmRoutes     = require("./routes/dms");
const friendRoutes = require("./routes/friends");
const arcadeRoutes = require("./routes/arcade");
const userRoutes   = require("./routes/users");
const uploadRoutes = require("./routes/upload");

const app = express();
const server = http.createServer(app);

// ── CORS ────────────────────────────────────────────────────────────
// Use dynamic origin validation to avoid hard-coding localhost.
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, cb) => {
      // No origin header means same-origin or curl; allow.
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());


// ── Socket.IO ───────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  },
});
app.set("io", io); // so routes can emit events via req.app.get("io")
initSocket(io);

// ── Routes ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "✦ VoidSync API is running" });
});

app.use("/api/auth",   authRoutes);
app.use("/api/rooms",  roomRoutes);
app.use("/api/dms",    dmRoutes);
app.use("/api/friends",friendRoutes);
app.use("/api/arcade", arcadeRoutes);
app.use("/api/users",  userRoutes);
app.use("/api/upload", uploadRoutes);

// ── 404 handler ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Start listening only once (Render EADDRINUSE happens when we bind twice).
// Start after DB connects so routes relying on DB don't fail early.
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`✦ VoidSync server running on port ${PORT}`);
  });
});
