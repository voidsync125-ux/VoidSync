import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export default function Chat({ initialTarget, onBack }) {
  const [target, setTarget] = useState(initialTarget);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    setTarget(initialTarget);
  }, [initialTarget]);

  const header = useMemo(() => {
    if (!target) return "Chat";
    if (target.type === "dm") return `DM — ${target.id}`;
    if (target.type === "room") return `Room — ${target.id}`;
    return "Chat";
  }, [target]);

  useEffect(() => {
    if (!target) return;
    setLoading(true);
    setError(null);

    // Minimal, build-safe implementation.
    // If backend endpoints differ, adjust these paths.
    const fetchMessages = async () => {
      try {
        const path = target.type === "dm"
          ? `/api/dms/${target.id}/messages`
          : `/api/rooms/${target.id}/messages`;

        const data = await api.get(path);
        setMessages(data.messages || []);
      } catch (e) {
        // Keep UI usable even if endpoints aren't ready
        setError(e?.message || "Couldn't load messages.");
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [target]);

  const send = async () => {
    const body = text.trim();
    if (!body || !target) return;

    setText("");
    const optimistic = {
      id: `tmp-${Date.now()}`,
      body,
      sender: { username: "You" },
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const payload = { type: "text", text: body };
      if (target.type === "dm") {
        await api.post(`/api/dms/${target.id}/messages`, payload);
      } else {
        await api.post(`/api/rooms/${target.id}/messages`, payload);
      }


      // Re-fetch to get authoritative messages
      const path = target.type === "dm"
        ? `/api/dms/${target.id}/messages`
        : `/api/rooms/${target.id}/messages`;
      const data = await api.get(path);
      setMessages(data.messages || []);
    } catch (e) {
      setError(e?.message || "Couldn't send message.");
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "#03010a",
        color: "#f0f4ff",
        fontFamily: "'Inter','Segoe UI',sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          borderBottom: "1px solid rgba(0,229,255,0.13)",
          background: "rgba(5,0,16,0.6)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(240,244,255,0.55)",
            fontFamily: "'Courier New',monospace",
            fontSize: 12,
            letterSpacing: "0.08em",
          }}
        >
          ← Back
        </button>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{header}</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "rgba(240,244,255,0.55)" }}>
          {loading ? "Loading…" : target ? "" : "Select a room to begin"}
        </div>
      </header>

      <main style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 920, width: "100%", margin: "0 auto" }}>
        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 8,
              border: "1px solid rgba(255,95,126,0.35)",
              background: "rgba(255,95,126,0.06)",
              color: "#ff5f7e",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {messages.length === 0 && !loading ? (
          <div style={{ color: "rgba(240,244,255,0.55)", textAlign: "center", paddingTop: 32 }}>
            No messages yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.sender?.username === "You" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: 680,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background:
                      m.sender?.username === "You"
                        ? "linear-gradient(135deg,rgba(0,229,255,0.22),rgba(255,44,247,0.12))"
                        : "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(0,229,255,0.13)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(240,244,255,0.7)", fontFamily: "'Courier New',monospace" }}>
                    {m.sender?.username || "Unknown"}
                  </div>
                  <div style={{ fontSize: 14, marginTop: 4, whiteSpace: "pre-wrap" }}>{m.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer style={{ padding: 16, borderTop: "1px solid rgba(0,229,255,0.13)", background: "rgba(0,0,0,0.15)" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", gap: 10 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={target ? "Type a message…" : "Choose a room first"}
            disabled={!target}
            style={{
              flex: 1,
              borderRadius: 8,
              border: "1px solid rgba(0,229,255,0.18)",
              background: "rgba(0,229,255,0.04)",
              color: "#f0f4ff",
              padding: "12px 14px",
              outline: "none",
              fontFamily: "'Inter','Segoe UI',sans-serif",
            }}
          />
          <button
            onClick={send}
            disabled={!target || !text.trim()}
            style={{
              width: 120,
              borderRadius: 8,
              border: "none",
              cursor: !target || !text.trim() ? "not-allowed" : "pointer",
              fontFamily: "'Arial Black','Impact','Franklin Gothic Heavy',sans-serif",
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "12px 10px",
              background:
                !target || !text.trim()
                  ? "rgba(255,255,255,0.06)"
                  : "linear-gradient(135deg,rgba(0,229,255,0.9),rgba(255,44,247,0.7))",
              color: !target || !text.trim() ? "rgba(240,244,255,0.55)" : "#030109",
            }}
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}

