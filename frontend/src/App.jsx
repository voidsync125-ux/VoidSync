import { useState, useEffect, useRef } from "react";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import SolarLoader from "./pages/SolarLoader";
import { api } from "./lib/api";

// Pages that require auth — reloading on these should restore session
const AUTH_PAGES = ["dashboard", "chat"];

function App() {
  const [bootGate, setBootGate] = useState(false); // true after SolarLoader word forming
  const [page, setPage] = useState(null); // null = still booting
  const pendingNextPageRef = useRef(null);
  const pendingNavAppliedRef = useRef(false);
  const [chatTarget, setChatTarget] = useState(null);
  const [joinStatus, setJoinStatus] = useState(null);
  const [joinMessage, setJoinMessage] = useState("");

  const navigate = (newPage, target = null) => {
    if (target) {
      setChatTarget(target);
      localStorage.setItem("voidsync_chat_target", JSON.stringify(target));
    } else {
      localStorage.removeItem("voidsync_chat_target");
    }
    setPage(newPage);
  };

  // ── Invite code handler (declared before boot effect) ─────────────
  const handleInviteCode = (code) => {
    setJoinStatus("joining");
    api.post(`/api/rooms/join-by-code/${code}`)
      .then(() => {
        setJoinStatus("ok");
        setJoinMessage("Joined! Redirecting to chat…");
        window.history.replaceState({}, "", "/");
        setTimeout(() => { setJoinStatus(null); navigate("chat"); }, 1200);
      })
      .catch((err) => {
        setJoinStatus("error");
        setJoinMessage(err.message || "Couldn't join that room.");
        window.history.replaceState({}, "", "/");
      });
  };

  const goToChat = (type, id) => navigate("chat", { type, id });


  // ── Boot sequence ──────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("voidsync_token");
    const savedPage = localStorage.getItem("voidsync_page") || "landing";
    const savedChatTarget = localStorage.getItem("voidsync_chat_target");

    // Handle invite link regardless of auth state
    const inviteMatch = window.location.pathname.match(/^\/join\/([a-zA-Z0-9]+)$/);

    // For non-token case, we also gate navigation behind SolarLoader completion.
    const nextWithoutAuth = inviteMatch ? "auth" : "landing";

    if (!token) {
      pendingNextPageRef.current = nextWithoutAuth;
      return;
    }

    api.get("/api/auth/me")
      .then(() => {
        if (inviteMatch) {
          handleInviteCode(inviteMatch[1]);
          return;
        }

        if (savedPage === "chat" && savedChatTarget) {
          try { setChatTarget(JSON.parse(savedChatTarget)); } catch {}
        }

        pendingNextPageRef.current = AUTH_PAGES.includes(savedPage) ? savedPage : "dashboard";
      })
      .catch(() => {
        localStorage.removeItem("voidsync_token");
        localStorage.removeItem("voidsync_user");
        localStorage.removeItem("voidsync_page");
        localStorage.removeItem("voidsync_chat_target");
        pendingNextPageRef.current = "landing";
      });
  }, []);

  // Apply gated navigation once SolarLoader signals completion.
  useEffect(() => {
    if (!bootGate) return;
    if (pendingNavAppliedRef.current) return;
    if (!pendingNextPageRef.current) return;
    pendingNavAppliedRef.current = true;
    setPage(pendingNextPageRef.current);
  }, [bootGate]);

  // ── Persist page to localStorage on every change ───────────────────
  useEffect(() => {
    if (!page) return;
    localStorage.setItem("voidsync_page", page);
  }, [page]);

  // ── Still booting ──────────────────────────────────────────────────
  if (!page) {
    return (
      <SolarLoader
        message="Syncing with the Void…"
        onWordFormed={() => {
          setBootGate(true);
        }}
      />
    );
  }


  // ── Invite link status screen ──────────────────────────────────────
  if (joinStatus) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#03010a", color:"#f0f4ff", fontFamily:"'Inter','Segoe UI',sans-serif", textAlign:"center", padding:"1rem" }}>
        <div>
          <div style={{ fontSize:"2rem", marginBottom:"1rem" }}>
            {joinStatus==="joining" ? "✦" : joinStatus==="ok" ? "✓" : "✕"}
          </div>
          <p style={{ fontSize:"0.95rem", color:joinStatus==="error" ? "#ff5f7e" : "#f0f4ff" }}>
            {joinStatus==="joining" ? "Joining room…" : joinMessage}
          </p>
          {joinStatus==="error" && (
            <button onClick={() => { setJoinStatus(null); navigate("dashboard"); }}
              style={{ marginTop:"1rem", background:"linear-gradient(135deg,#00e5ff,#ff2cf7)", border:"none", color:"#000", fontWeight:700, padding:"0.6rem 1.4rem", borderRadius:4, cursor:"pointer" }}>
              Continue to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Pages ──────────────────────────────────────────────────────────
  if (page === "auth") {
    return (
      <Auth
        onBack={() => navigate("landing")}
        onAuthSuccess={(user) => {
          console.log("Logged in:", user);
          navigate("dashboard");
        }}
      />
    );
  }

  if (page === "dashboard") {
    return (
      <Dashboard
        onOpenRoom={(roomId) => goToChat("room", roomId)}
        onOpenDm={(conversationId) => goToChat("dm", conversationId)}
        onOpenChat={() => navigate("chat")}
      />
    );
  }

  if (page === "chat") {
    return (
      <Chat
        initialTarget={chatTarget}
        onBack={() => navigate("dashboard")}
      />
    );
  }

  return <Landing onLaunch={() => navigate("auth")} />;
}

export default App;
