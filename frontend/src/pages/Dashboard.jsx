import { useEffect, useRef, useState, Component } from "react";
import * as THREE from "three";
import { api } from "../lib/api";

// ─── ERROR BOUNDARY ──────────────────────────────────────────────────
// Catches render crashes in any child view so the sidebar stays visible.
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err) { console.error("View crashed:", err); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:"2rem", textAlign:"center" }}>
          <div style={{ fontSize:"1.8rem", marginBottom:"0.8rem" }}>⚠</div>
          <p style={{ color:"#ff5f7e", fontFamily:"'Inter',sans-serif", fontSize:"0.85rem", marginBottom:"1rem" }}>
            Something went wrong loading this view.
          </p>
          <button onClick={()=>this.setState({ error:null })}
            style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(0,229,255,0.2)", color:"#f0f4ff", fontFamily:"'Courier New',monospace", fontSize:"0.72rem", letterSpacing:"0.08em", padding:"0.4rem 1rem", borderRadius:4, cursor:"pointer" }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── TOKENS ───────────────────────────────────────────────────────────
const C = {
  void: "#03010a", nebula: "#0d0120", ink: "#0a001e",
  cyan: "#00e5ff", magenta: "#ff2cf7", gold: "#ffd64a", green: "#00ff88", red: "#ff5f7e",
  white: "#f0f4ff", dim: "rgba(240,244,255,0.55)", dimmer: "rgba(240,244,255,0.3)",
  border: "rgba(0,229,255,0.13)", borderHover: "rgba(0,229,255,0.4)",
  panelBg: "rgba(10,0,30,0.72)", cardBg: "rgba(13,0,34,0.65)",
  sidebarBg: "rgba(5,0,16,0.9)", inputBg: "rgba(0,229,255,0.04)",
};
const font = {
  display: "'Arial Black','Impact','Franklin Gothic Heavy',sans-serif",
  body: "'Inter','Segoe UI',sans-serif",
  mono: "'Courier New',monospace",
};
const NAV_H = 0; // no top navbar on dashboard
const SIDEBAR_W = 240;
const SIDEBAR_W_COLLAPSED = 60;

// ─── RESPONSIVE ───────────────────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState({ isMobile: false, w: 1200 });
  useEffect(() => {
    const calc = () => setBp({ isMobile: window.innerWidth < 768, w: window.innerWidth });
    calc(); window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return bp;
}

// ─── CURRENT USER HOOK ─────────────────────────────────────────────
// Fetches the logged-in user once and shares it across Sidebar, Topbar,
// and StatsView via a tiny module-level cache (avoids 3 separate calls).
let userCache = null;
let userCacheListeners = [];

function useCurrentUser() {
  const [user, setUser] = useState(userCache);
  const [loading, setLoading] = useState(!userCache);

  useEffect(() => {
    if (userCache) { setUser(userCache); setLoading(false); return; }

    const listener = (u) => { setUser(u); setLoading(false); };
    userCacheListeners.push(listener);

    if (userCacheListeners.length === 1) {
      api.get("/api/auth/me")
        .then(({ user }) => {
          userCache = user;
          userCacheListeners.forEach(l => l(user));
          userCacheListeners = [];
        })
        .catch(() => {
          userCacheListeners.forEach(l => l(null));
          userCacheListeners = [];
        });
    }

    return () => { userCacheListeners = userCacheListeners.filter(l => l !== listener); };
  }, []);

  return { user, loading };
}

// ─── PENDING FRIEND REQUEST COUNT HOOK ────────────────────────────
// Shared across Sidebar + Topbar so the "Alerts" badge stays in sync.
// Simple polling every 30s keeps it fresh without needing sockets here.
function usePendingRequestCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = () => {
      api.get("/api/friends/requests")
        .then(({ requests }) => { if (!cancelled) setCount(requests.length); })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return count;
}

// ─── THREE.JS STARFIELD BACKGROUND ───────────────────────────────────
function StarfieldBg() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 100);
    camera.position.z = 3;

    // Static star layer
    const mkPts = (count, spread, size, opacity, color = 0xffffff) => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i*3]=(Math.random()-.5)*spread; pos[i*3+1]=(Math.random()-.5)*spread*0.6; pos[i*3+2]=(Math.random()-.5)*spread*.4;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true }));
      scene.add(p); return p;
    };
    const stars1 = mkPts(800, 30, 0.012, 0.35);
    const stars2 = mkPts(300, 20, 0.02, 0.2, 0x00e5ff);
    const stars3 = mkPts(150, 16, 0.022, 0.15, 0xff2cf7);

    // Slow nebula wisps — large transparent spheres
    const wispMat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.025, side: THREE.BackSide });
    [[-4,2,-8],[4,-2,-10],[0,3,-12],[-5,-3,-9]].forEach(([x,y,z],i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(3+i, 8, 8), wispMat(i%2===0?0x00e5ff:0x7b2fff));
      m.position.set(x,y,z); scene.add(m);
    });

    const onResize = () => { const w=el.clientWidth,h=el.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);
    let raf; const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick); const t = clock.getElapsedTime();
      stars1.rotation.y = t * 0.008; stars1.rotation.x = t * 0.003;
      stars2.rotation.y = -t * 0.012;
      stars3.rotation.y = t * 0.006; stars3.rotation.z = t * 0.004;
      renderer.render(scene, camera);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); renderer.dispose(); if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
  }, []);
  return <div ref={ref} style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }} />;
}

// ─── SMALL HELPERS ───────────────────────────────────────────────────
const Badge = ({ n, color = C.cyan }) => n > 0 ? (
  <span style={{ minWidth:18,height:18,borderRadius:9,background:color,color:"#000",fontSize:"0.6rem",fontWeight:700,fontFamily:font.mono,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 4px" }}>{n}</span>
) : null;

const Avatar = ({ name, size = 36, online = false, color = C.cyan }) => (
  <div style={{ position:"relative", flexShrink:0 }}>
    <div style={{ width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${color},${C.magenta})`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font.display,fontSize:size*0.38,fontWeight:900,color:"#000" }}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
    {online !== undefined && <span style={{ position:"absolute",bottom:0,right:0,width:size*0.28,height:size*0.28,borderRadius:"50%",background:online?C.green:"rgba(255,255,255,0.2)",border:`2px solid ${C.void}` }} />}
  </div>
);

const Card = ({ children, style = {}, hover = true }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>hover&&setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:C.cardBg,border:`1px solid ${hov?C.borderHover:C.border}`,borderRadius:6,transition:"all 0.22s",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",...style }}>
      {children}
    </div>
  );
};

// ─── LOADING / ERROR STATES ───────────────────────────────────────────
const LoadingState = ({ label = "Loading…" }) => (
  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.8rem",padding:"3rem 1rem" }}>
    <div style={{ width:32,height:32,border:`2px solid ${C.cyan}`,borderTopColor:"transparent",borderRadius:"50%",animation:"vsspin 0.8s linear infinite" }} />
    <style>{`@keyframes vsspin{to{transform:rotate(360deg)}}`}</style>
    <span style={{ fontSize:"0.78rem",color:C.dim,fontFamily:font.mono,letterSpacing:"0.06em" }}>{label}</span>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.8rem",padding:"3rem 1rem",textAlign:"center" }}>
    <span style={{ fontSize:"1.8rem" }}>⚠</span>
    <span style={{ fontSize:"0.85rem",color:C.red,fontFamily:font.body,maxWidth:360 }}>{message}</span>
    {onRetry && (
      <button onClick={onRetry} style={{ background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.dim,fontFamily:font.mono,fontSize:"0.72rem",letterSpacing:"0.08em",padding:"0.4rem 1rem",borderRadius:4,cursor:"pointer" }}>
        Retry
      </button>
    )}
  </div>
);

const StatPill = ({ label, value, color = C.cyan }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:"0.2rem",padding:"0.9rem 1.1rem",background:"rgba(0,229,255,0.04)",border:`1px solid ${C.border}`,borderRadius:5 }}>
    <span style={{ fontSize:"0.58rem",letterSpacing:"0.2em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase" }}>{label}</span>
    <span style={{ fontSize:"1.5rem",fontWeight:900,fontFamily:font.display,color,letterSpacing:"-0.02em" }}>{value}</span>
  </div>
);

// ─── MINI SPARKLINE ───────────────────────────────────────────────────
function Sparkline({ data, color = C.cyan, height = 48 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v,i) => {
    const x = (i/(data.length-1))*100;
    const y = height - ((v-min)/(max-min||1))*(height-4)-2;
    return `${x},${y}`;
  }).join(" ");
  const fill = data.map((v,i) => { const x=(i/(data.length-1))*100; const y=height-((v-min)/(max-min||1))*(height-4)-2; return `${x},${y}`; });
  const area = `${fill[0].split(",")[0]},${height} ${fill.join(" ")} ${fill[fill.length-1].split(",")[0]},${height}`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <defs><linearGradient id={`sg${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={area} fill={`url(#sg${color.replace("#","")})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── TOGGLE ───────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div onClick={()=>onChange(!value)} style={{ width:40,height:22,borderRadius:11,background:value?`linear-gradient(135deg,${C.cyan},${C.magenta})`:"rgba(255,255,255,0.12)",cursor:"pointer",position:"relative",transition:"background 0.25s",flexShrink:0 }}>
      <div style={{ position:"absolute",top:3,left:value?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.22s",boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }} />
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"rooms",         icon:"⬡", label:"Rooms"        },
  { id:"friends",       icon:"◎", label:"Friends"      },
  { id:"chat",          icon:"💬", label:"Messages"     },
  { id:"games",         icon:"♦", label:"Void Arcade"  },
  { id:"stats",         icon:"▲", label:"Stats"        },
  { id:"notifications", icon:"◈", label:"Alerts"       },
  { id:"settings",      icon:"⚙", label:"Settings"     },
];

function Sidebar({ active, setActive, collapsed, setCollapsed, isMobile, open, onClose }) {
  const { user } = useCurrentUser();
  const pendingCount = usePendingRequestCount();
  // Mobile: fixed full-height drawer that slides in/out with overlay
  // Desktop: sticky collapsible sidebar
  return (
    <>
      {isMobile && open && (
        <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:39,background:"rgba(0,0,0,0.55)" }} />
      )}
      <aside style={{
        width: isMobile ? 250 : (collapsed?SIDEBAR_W_COLLAPSED:SIDEBAR_W),
        flexShrink:0, height:"100vh",
        position: isMobile ? "fixed" : "sticky",
        top:0, left:0,
        background:C.sidebarBg, borderRight:`1px solid ${C.border}`,
        backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
        display:"flex", flexDirection:"column",
        transition: isMobile ? "transform 0.26s cubic-bezier(.4,0,.2,1)" : "width 0.25s",
        transform: isMobile ? (open?"translateX(0)":"translateX(-100%)") : "none",
        overflow:"hidden", zIndex:40 }}>

        {/* Logo */}
        <div style={{ padding:"1.2rem 0.9rem", display:"flex", alignItems:"center", gap:"0.6rem",
          borderBottom:`1px solid ${C.border}`, flexShrink:0, minHeight:64 }}>
          <div style={{ width:30,height:30,borderRadius:"50%",flexShrink:0,
            background:`radial-gradient(circle at 35% 35%,#fff,${C.cyan})`,
            boxShadow:`0 0 10px ${C.cyan}` }} />
          {(!collapsed || isMobile) && (
            <span style={{ fontFamily:font.display,fontSize:"1.1rem",fontWeight:900,whiteSpace:"nowrap",
              background:`linear-gradient(135deg,#fff 30%,${C.cyan} 70%,${C.magenta})`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>VoidSync</span>
          )}
          {isMobile ? (
            <button onClick={onClose} style={{ marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"1rem",padding:4,flexShrink:0,lineHeight:1 }}>✕</button>
          ) : (
            <button onClick={()=>setCollapsed(c=>!c)} style={{ marginLeft:"auto",background:"none",border:"none",
              cursor:"pointer",color:C.dimmer,fontSize:"0.85rem",padding:4,flexShrink:0,
              display:"flex",alignItems:"center",transition:"color 0.2s" }}
              onMouseEnter={e=>e.currentTarget.style.color=C.white}
              onMouseLeave={e=>e.currentTarget.style.color=C.dimmer}>
              {collapsed?"▶":"◀"}
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex:1,padding:"0.6rem 0.5rem",display:"flex",flexDirection:"column",gap:"0.2rem",overflowY:"auto" }}>
          {NAV_ITEMS.map(({ id, icon, label }) => {
            const isActive = active === id;
            const showLabel = !collapsed || isMobile;
            const badge = id === "notifications" ? pendingCount : 0;
            return (
              <button key={id} onClick={()=>{ setActive(id); if(isMobile) onClose(); }} style={{
                display:"flex",alignItems:"center",gap:"0.75rem",
                padding: showLabel?"0.7rem 0.85rem":"0.7rem",
                borderRadius:5,border:"none",cursor:"pointer",
                width:"100%",textAlign:"left",transition:"all 0.18s",position:"relative",
                background: isActive?`linear-gradient(135deg,rgba(0,229,255,0.15),rgba(255,44,247,0.08))`:"transparent",
                borderLeft: isActive?`2px solid ${C.cyan}`:"2px solid transparent",
                justifyContent: showLabel?"flex-start":"center",
              }}
              onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background="rgba(0,229,255,0.06)"; }}
              onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background="transparent"; }}>
                <span style={{ fontSize:"1rem",flexShrink:0,filter:isActive?`drop-shadow(0 0 6px ${C.cyan})`:"none" }}>{icon}</span>
                {showLabel && <>
                  <span style={{ fontFamily:font.body,fontSize:"0.84rem",color:isActive?C.white:C.dim,fontWeight:isActive?600:400,flex:1,whiteSpace:"nowrap" }}>{label}</span>
                  {badge>0 && <Badge n={badge} color={id==="notifications"?C.magenta:C.cyan} />}
                </>}
                {!showLabel && badge>0 && (
                  <span style={{ position:"absolute",top:6,right:6,width:8,height:8,borderRadius:"50%",background:id==="notifications"?C.magenta:C.cyan }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div style={{ padding:"0.9rem",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:"0.7rem",flexShrink:0 }}>
          <Avatar name={user?.username || "?"} size={34} online={user?.status==="online"} color={user?.avatarColor || C.cyan} />
          {(!collapsed || isMobile) && (
            <div style={{ flex:1,overflow:"hidden" }}>
              <div style={{ fontSize:"0.82rem",fontWeight:600,color:C.white,fontFamily:font.body,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{user?.username || "Loading…"}</div>
              <div style={{ fontSize:"0.65rem",color:user?.status==="online"?C.green:C.dimmer,fontFamily:font.mono,letterSpacing:"0.06em",textTransform:"capitalize" }}>● {user?.status || "—"}</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── TOPBAR ───────────────────────────────────────────────────────────
function Topbar({ active, isMobile, onMenuClick, setActive }) {
  const { user } = useCurrentUser();
  const pendingCount = usePendingRequestCount();
  const titles = { rooms:"Void Rooms", friends:"Friends", chat:"Messages", games:"Void Arcade", stats:"My Stats", notifications:"Notifications", settings:"Settings" };
  return (
    <header style={{ height:64,display:"flex",alignItems:"center",gap:"1rem",
      padding:"0 1.5rem",borderBottom:`1px solid ${C.border}`,
      background:"rgba(5,0,16,0.6)",backdropFilter:"blur(12px)",flexShrink:0 }}>
      {isMobile && (
        <button onClick={onMenuClick} style={{ background:"none",border:"none",cursor:"pointer",color:C.dim,fontSize:"1.2rem",padding:"0.2rem",lineHeight:1,flexShrink:0 }}>☰</button>
      )}
      <h1 style={{ fontFamily:font.display,fontSize:"1.1rem",fontWeight:900,color:C.white,
        margin:0,letterSpacing:"0.02em",whiteSpace:"nowrap" }}>
        {titles[active]}
      </h1>
      <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:"0.7rem" }}>
        {!isMobile && <Avatar name={user?.username || "?"} size={32} online={user?.status==="online"} color={user?.avatarColor || C.cyan}/>}
        <div style={{ position:"relative" }}>
          <button onClick={()=>setActive?.("notifications")} style={{ background:"none",border:"none",cursor:"pointer",color:C.dim,fontSize:"1.1rem",padding:4 }}>◈</button>
          <Badge n={pendingCount} color={C.magenta} />
        </div>
      </div>
    </header>
  );
}

// ─── VIEW: ROOMS ──────────────────────────────────────────────────────
function RoomsView({ onOpenRoom }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const FALLBACK_COLORS = [C.cyan, C.magenta, C.gold, "#7b2fff", C.green, "#ff9f2f"];

  const loadRooms = () => {
    setLoading(true);
    api.get("/api/rooms")
      .then(({ rooms }) => setRooms(rooms))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRooms(); }, []);

  const handleJoin = async (room) => {
    setJoiningId(room.id);
    try {
      await api.post(`/api/rooms/${room.id}/join`);
      onOpenRoom?.(room.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return <div style={{ padding:"1.5rem" }}><LoadingState label="Loading rooms…"/></div>;
  }
  if (error) {
    return <div style={{ padding:"1.5rem" }}><ErrorState message={error} onRetry={loadRooms}/></div>;
  }

  const pinned = rooms.filter(r=>r.pinned);
  const rest = rooms.filter(r=>!r.pinned);

  const RoomCard = ({ r, i }) => {
    const color = r.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
    const isJoining = joiningId === r.id;
    return (
      <Card style={{ padding:"1.2rem 1.4rem",display:"flex",flexDirection:"column",gap:"0.65rem" }}>
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"0.5rem" }}>
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.25rem" }}>
              <span style={{ width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",boxShadow:`0 0 6px ${color}` }} />
              <span style={{ fontFamily:font.display,fontSize:"0.9rem",fontWeight:900,color:C.white }}>{r.displayName}</span>
              {r.pinned && <span style={{ fontSize:"0.55rem",letterSpacing:"0.12em",color:C.gold,fontFamily:font.mono,background:"rgba(255,214,74,0.12)",border:`1px solid rgba(255,214,74,0.3)`,borderRadius:2,padding:"1px 5px" }}>PINNED</span>}
            </div>
            <p style={{ margin:0,fontSize:"0.78rem",color:C.dim,fontFamily:font.body,lineHeight:1.5 }}>{r.description || "No description yet."}</p>
          </div>
          <span style={{ fontSize:"0.62rem",color,fontFamily:font.mono,letterSpacing:"0.1em",background:`rgba(0,0,0,0.3)`,border:`1px solid ${color}33`,borderRadius:3,padding:"2px 7px",flexShrink:0 }}>{r.tag}</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",gap:"1rem" }}>
            <span style={{ fontSize:"0.7rem",color:C.dimmer,fontFamily:font.mono }}><span style={{ color:C.green }}>●</span> {r.onlineCount} online</span>
            <span style={{ fontSize:"0.7rem",color:C.dimmer,fontFamily:font.mono }}>◎ {r.memberCount} members</span>
          </div>
          <button
            onClick={()=> r.isMember ? onOpenRoom?.(r.id) : handleJoin(r)}
            disabled={isJoining}
            style={{ background:`linear-gradient(135deg,${color}22,${color}11)`,border:`1px solid ${color}55`,
            color,fontFamily:font.display,fontSize:"0.68rem",fontWeight:900,
            letterSpacing:"0.1em",textTransform:"uppercase",padding:"0.35rem 0.9rem",
            borderRadius:3,cursor:isJoining?"default":"pointer",transition:"all 0.18s",opacity:isJoining?0.6:1 }}
            onMouseEnter={e=>{e.currentTarget.style.background=`${color}22`;}}
            onMouseLeave={e=>{e.currentTarget.style.background=`${color}11`;}}>
            {isJoining ? "Joining…" : r.isMember ? "Open →" : "Join →"}
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ padding:"1.5rem",display:"flex",flexDirection:"column",gap:"1.8rem" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end" }}>
        <button onClick={()=>setShowCreateModal(true)} style={{
          display:"flex",alignItems:"center",gap:"0.5rem",
          background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",
          fontFamily:font.display,fontSize:"0.75rem",fontWeight:900,letterSpacing:"0.1em",
          textTransform:"uppercase",padding:"0.55rem 1.2rem",borderRadius:4,cursor:"pointer",
          boxShadow:`0 0 16px rgba(0,229,255,0.3)`,transition:"transform 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.03)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
          ＋ Create Room
        </button>
      </div>

      {rooms.length === 0 && (
        <div style={{ textAlign:"center",padding:"3rem 1rem",color:C.dim,fontFamily:font.body }}>
          No rooms yet. Be the first to create one! 🌌
        </div>
      )}
      {pinned.length > 0 && (
        <div>
          <SectionLabel>📌 Pinned Rooms</SectionLabel>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"1rem" }}>
            {pinned.map((r,i)=><RoomCard key={r.id} r={r} i={i}/>)}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          <SectionLabel>🌌 All Rooms</SectionLabel>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"1rem" }}>
            {rest.map((r,i)=><RoomCard key={r.id} r={r} i={i}/>)}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateRoomModal
          onClose={()=>setShowCreateModal(false)}
          onCreated={()=>{ setShowCreateModal(false); loadRooms(); }}
        />
      )}
    </div>
  );
}

// ─── CREATE ROOM MODAL ────────────────────────────────────────────────
const ROOM_COLORS = [
  { hex: C.cyan, label:"Cyan" },
  { hex: C.magenta, label:"Magenta" },
  { hex: C.gold, label:"Gold" },
  { hex: "#7b2fff", label:"Violet" },
  { hex: C.green, label:"Green" },
  { hex: "#ff9f2f", label:"Orange" },
];
const ROOM_TAGS = ["General","Tech","Creative","Gaming","Deep","Events","Music","Study"];

function CreateRoomModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("General");
  const [color, setColor] = useState(C.cyan);
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleCreate = async () => {
    setError(null);
    if (slug.length < 2) {
      setError("Room name must be at least 2 characters (letters, numbers, hyphens).");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/rooms", {
        name: slug,
        displayName: name.trim(),
        description: description.trim(),
        tag,
        color,
        isPrivate,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%",maxWidth:440,background:C.sidebarBg,border:`1px solid ${C.border}`,borderRadius:8,padding:"1.6rem",boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.2rem" }}>
          <h3 style={{ fontFamily:font.display,fontSize:"1.15rem",fontWeight:900,color:C.white,margin:0,
            background:`linear-gradient(135deg,#fff,${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>
            ✦ Create a Room
          </h3>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"1.1rem",padding:4,lineHeight:1 }}>✕</button>
        </div>

        <div style={{ marginBottom:"1rem" }}>
          <label style={{ display:"block",fontSize:"0.62rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.4rem" }}>Room Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Cosmic Café" autoFocus
            style={{ width:"100%",boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:3,color:C.white,fontSize:"0.87rem",fontFamily:font.body,padding:"0.65rem 0.9rem",outline:"none" }} />
          {name.trim() && <div style={{ fontSize:"0.65rem",color:C.dimmer,fontFamily:font.mono,marginTop:"0.3rem" }}>#{slug || "…"}</div>}
        </div>

        <div style={{ marginBottom:"1rem" }}>
          <label style={{ display:"block",fontSize:"0.62rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.4rem" }}>Description</label>
          <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="What's this room about?"
            style={{ width:"100%",boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:3,color:C.white,fontSize:"0.87rem",fontFamily:font.body,padding:"0.65rem 0.9rem",outline:"none" }} />
        </div>

        <div style={{ marginBottom:"1rem" }}>
          <label style={{ display:"block",fontSize:"0.62rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.4rem" }}>Tag</label>
          <div style={{ display:"flex",gap:"0.4rem",flexWrap:"wrap" }}>
            {ROOM_TAGS.map(t=>(
              <button key={t} onClick={()=>setTag(t)} style={{ padding:"0.32rem 0.7rem",borderRadius:3,border:`1px solid ${tag===t?C.cyan:C.border}`,background:tag===t?"rgba(0,229,255,0.12)":"transparent",color:tag===t?C.cyan:C.dimmer,fontSize:"0.7rem",fontFamily:font.mono,cursor:"pointer",letterSpacing:"0.05em",transition:"all 0.15s" }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:"1.2rem" }}>
          <label style={{ display:"block",fontSize:"0.62rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.4rem" }}>Accent Color</label>
          <div style={{ display:"flex",gap:"0.5rem" }}>
            {ROOM_COLORS.map(c=>(
              <button key={c.hex} onClick={()=>setColor(c.hex)} title={c.label} style={{ width:30,height:30,borderRadius:"50%",background:c.hex,border:color===c.hex?`2px solid #fff`:"2px solid transparent",cursor:"pointer",boxShadow:color===c.hex?`0 0 10px ${c.hex}`:"none",transition:"all 0.15s" }} />
            ))}
          </div>
        </div>

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.4rem",padding:"0.7rem 0",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:"0.82rem",color:C.white,fontFamily:font.body,fontWeight:500 }}>Private Room</div>
            <div style={{ fontSize:"0.68rem",color:C.dimmer,fontFamily:font.body,marginTop:"0.1rem" }}>Only visible to members you invite</div>
          </div>
          <Toggle value={isPrivate} onChange={setIsPrivate}/>
        </div>

        {error && <div style={{ marginBottom:"0.8rem",fontSize:"0.75rem",color:C.red,fontFamily:font.body }}>{error}</div>}

        <div style={{ display:"flex",gap:"0.6rem" }}>
          <button onClick={onClose} style={{ flex:1,padding:"0.65rem",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.dim,fontFamily:font.body,fontSize:"0.85rem",borderRadius:4,cursor:"pointer" }}>Cancel</button>
          <button onClick={handleCreate} disabled={busy} style={{ flex:1,padding:"0.65rem",background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontFamily:font.display,fontWeight:900,fontSize:"0.78rem",letterSpacing:"0.08em",textTransform:"uppercase",borderRadius:4,cursor:"pointer",opacity:busy?0.6:1 }}>
            {busy ? "Creating…" : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FRIEND ROW (outside FriendsView to avoid hooks-order violation) ──
function FriendRow({ f, dmBusyId, onDm }) {
  if (!f?.id || !f?.username) return null;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:"0.9rem",padding:"0.75rem 1rem",borderRadius:5,transition:"background 0.18s" }}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(0,229,255,0.05)"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <Avatar name={f.username} size={38} online={f.online} color={f.avatarColor||C.cyan}/>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:"0.86rem",fontWeight:600,color:C.white,fontFamily:font.body }}>{f.username}</div>
        <div style={{ fontSize:"0.7rem",color:f.online?C.green:C.dimmer,fontFamily:font.mono,letterSpacing:"0.04em" }}>
          {f.online ? "● Online" : "○ Offline"}
        </div>
      </div>
      <button onClick={()=>onDm(f)} disabled={dmBusyId===f.id}
        style={{ background:"none",border:`1px solid ${C.border}`,color:C.dim,fontSize:"0.7rem",fontFamily:font.mono,
          padding:"0.3rem 0.7rem",borderRadius:3,cursor:"pointer",letterSpacing:"0.08em",
          transition:"all 0.18s",opacity:dmBusyId===f.id?0.5:1 }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.cyan;e.currentTarget.style.color=C.cyan;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
        {dmBusyId===f.id?"…":"DM"}
      </button>
    </div>
  );
}

// ─── VIEW: FRIENDS ────────────────────────────────────────────────────
function FriendsView({ onOpenDm }) {
  // ── ALL hooks must be at the top, unconditionally ──────────────────
  const [friends,     setFriends]     = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [busyId,      setBusyId]      = useState(null);
  const [dmBusyId,    setDmBusyId]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [addStatus,   setAddStatus]   = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/api/friends"), api.get("/api/friends/requests")])
      .then(([f, r]) => { setFriends(f.friends || []); setRequests(r.requests || []); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Load suggestions on mount (non-blocking, fails silently)
    api.get("/api/friends/suggestions?limit=12")
      .then(({ suggestions }) => setSuggestions(suggestions || []))
      .catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api.get(`/api/friends/search?q=${encodeURIComponent(search.trim())}`)
        .then(({ users }) => setResults(users || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Handlers ────────────────────────────────────────────────────────
  const openDm = async (f) => {
    setDmBusyId(f.id);
    try {
      const { conversation } = await api.post("/api/dms/start", { userId: f.id });
      onOpenDm?.(conversation.id);
    } catch (err) { alert(err.message); }
    finally { setDmBusyId(null); }
  };

  const sendRequest = async (username) => {
    setBusyId(username);
    try {
      const res = await api.post("/api/friends/requests", { username });
      setAddStatus({ username, message: res.message || "Request sent" });
      setResults(r => r.map(u => u.username===username ? { ...u, requested:true } : u));
      // Remove from suggestions once request is sent
      setSuggestions(s => s.filter(u => u.username !== username));
    } catch (err) { setAddStatus({ username, message: err.message }); }
    finally { setBusyId(null); }
  };

  const accept = async (id) => {
    setBusyId(id);
    try { await api.post(`/api/friends/requests/${id}/accept`); load(); }
    catch (err) { alert(err.message); }
    finally { setBusyId(null); }
  };

  const decline = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/api/friends/requests/${id}/decline`);
      setRequests(r => r.filter(req => req.id !== id));
    } catch (err) { alert(err.message); }
    finally { setBusyId(null); }
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding:"1.5rem" }}><LoadingState label="Loading friends…"/></div>;
  if (error)   return <div style={{ padding:"1.5rem" }}><ErrorState message={error} onRetry={load}/></div>;

  const online  = friends.filter(f => f?.online);
  const offline = friends.filter(f => f && !f.online);

  return (
    <div style={{ padding:"1.5rem", display:"flex", flexDirection:"column", gap:"1.5rem" }}>

      {/* ── People you may know ───────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div>
          <SectionLabel>✦ People You May Know</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"0.8rem" }}>
            {suggestions.filter(u=>u?.id&&u?.username).map(u => (
              <Card key={u.id} style={{ padding:"1rem", display:"flex", flexDirection:"column", alignItems:"center", gap:"0.6rem", textAlign:"center" }}>
                <Avatar name={u.username} size={46} online={u.online} color={u.avatarColor || C.cyan}/>
                <div>
                  <div style={{ fontSize:"0.86rem", fontWeight:600, color:C.white, fontFamily:font.body }}>{u.username}</div>
                  {u.mutualFriends > 0 && (
                    <div style={{ fontSize:"0.68rem", color:C.dimmer, fontFamily:font.mono, marginTop:"0.15rem" }}>
                      {u.mutualFriends} mutual friend{u.mutualFriends>1?"s":""}
                    </div>
                  )}
                </div>
                {u.requested ? (
                  <span style={{ fontSize:"0.68rem", color:C.dimmer, fontFamily:font.mono }}>Request sent ✓</span>
                ) : (
                  <button onClick={()=>sendRequest(u.username)} disabled={busyId===u.username}
                    style={{ width:"100%", padding:"0.42rem 0", background:`linear-gradient(135deg,${C.cyan}22,${C.magenta}11)`,
                      border:`1px solid ${C.cyan}55`, color:C.cyan, fontFamily:font.display, fontWeight:900,
                      fontSize:"0.68rem", letterSpacing:"0.08em", textTransform:"uppercase",
                      borderRadius:4, cursor:"pointer", transition:"all 0.18s",
                      opacity:busyId===u.username?0.6:1 }}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${C.cyan}28`;}}
                    onMouseLeave={e=>{e.currentTarget.style.background=`linear-gradient(135deg,${C.cyan}22,${C.magenta}11)`;}}>
                    {busyId===u.username ? "…" : "Add Friend"}
                  </button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Main friends + requests + search grid ─────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:"1.5rem", alignItems:"start" }}>
      {/* Friends list */}
      <Card style={{ padding:"1rem 0.5rem" }}>
        {friends.length === 0 ? (
          <div style={{ padding:"1rem",textAlign:"center",color:C.dim,fontFamily:font.body,fontSize:"0.85rem" }}>
            No friends yet. Search below to add some! ✦
          </div>
        ) : (
          <>
            {online.length > 0 && (
              <>
                <SectionLabel style={{ padding:"0 0.8rem" }}>🟢 Online — {online.length}</SectionLabel>
                {online.map(f=><FriendRow key={f.id} f={f} dmBusyId={dmBusyId} onDm={openDm}/>)}
              </>
            )}
            {offline.length > 0 && (
              <>
                <div style={{ height:"0.5rem" }}/>
                <SectionLabel style={{ padding:"0 0.8rem" }}>⚫ Offline — {offline.length}</SectionLabel>
                {offline.map(f=><FriendRow key={f.id} f={f} dmBusyId={dmBusyId} onDm={openDm}/>)}
              </>
            )}
          </>
        )}
      </Card>

      {/* Requests + Add Friend */}
      <Card style={{ padding:"1.2rem 1rem" }}>
        <SectionLabel>📨 Pending Requests — {requests.length}</SectionLabel>
        {requests.length === 0 && (
          <div style={{ padding:"0.6rem 0",color:C.dimmer,fontFamily:font.body,fontSize:"0.8rem" }}>No pending requests.</div>
        )}
        {requests.filter(r=>r?.id&&r?.from?.username).map(r=>(
          <div key={r.id} style={{ display:"flex",alignItems:"center",gap:"0.8rem",padding:"0.6rem 0",borderBottom:`1px solid ${C.border}` }}>
            <Avatar name={r.from.username} size={36} color={r.from.avatarColor||C.gold}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"0.85rem",fontWeight:600,color:C.white,fontFamily:font.body }}>{r.from.username}</div>
              <div style={{ fontSize:"0.68rem",color:C.dimmer,fontFamily:font.mono }}>{r.mutualFriends} mutual friends</div>
            </div>
            <div style={{ display:"flex",gap:"0.4rem" }}>
              <button onClick={()=>accept(r.id)} disabled={busyId===r.id}
                style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontWeight:700,fontSize:"0.7rem",padding:"0.32rem 0.7rem",borderRadius:3,cursor:"pointer",opacity:busyId===r.id?0.6:1 }}>✓</button>
              <button onClick={()=>decline(r.id)} disabled={busyId===r.id}
                style={{ background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.dim,fontSize:"0.7rem",padding:"0.32rem 0.7rem",borderRadius:3,cursor:"pointer",opacity:busyId===r.id?0.6:1 }}>✕</button>
            </div>
          </div>
        ))}

        {/* Add Friend */}
        <div style={{ marginTop:"1.2rem" }}>
          <SectionLabel>➕ Add Friend</SectionLabel>
          <input value={search} onChange={e=>{ setSearch(e.target.value); setAddStatus(null); }}
            placeholder="Search by username…"
            style={{ width:"100%",boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,
              borderRadius:4,color:C.white,fontSize:"0.82rem",fontFamily:font.body,
              padding:"0.55rem 0.8rem",outline:"none",marginBottom:"0.6rem" }}/>
          {searching && <div style={{ fontSize:"0.75rem",color:C.dimmer,fontFamily:font.mono,padding:"0.4rem 0" }}>Searching…</div>}
          {results.filter(u=>u?.id&&u?.username).map(u=>(
            <div key={u.id} style={{ display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.5rem 0.4rem",borderRadius:4 }}>
              <Avatar name={u.username} size={30} online={u.online} color={u.avatarColor||C.cyan}/>
              <span style={{ flex:1,fontSize:"0.82rem",color:C.white,fontFamily:font.body }}>{u.username}</span>
              {u.isFriend ? (
                <span style={{ fontSize:"0.65rem",color:C.green,fontFamily:font.mono }}>Friends ✓</span>
              ) : u.requested ? (
                <span style={{ fontSize:"0.65rem",color:C.dimmer,fontFamily:font.mono }}>Sent ✓</span>
              ) : (
                <button onClick={()=>sendRequest(u.username)} disabled={busyId===u.username}
                  style={{ background:"transparent",border:`1px solid ${C.cyan}`,color:C.cyan,fontSize:"0.68rem",
                    fontFamily:font.mono,padding:"0.28rem 0.7rem",borderRadius:3,cursor:"pointer",
                    letterSpacing:"0.06em",opacity:busyId===u.username?0.6:1 }}>
                  {busyId===u.username?"…":"Add"}
                </button>
              )}
            </div>
          ))}
          {addStatus && (
            <div style={{ marginTop:"0.5rem",fontSize:"0.72rem",fontFamily:font.body,color:C.dim }}>
              {addStatus.message}
            </div>
          )}
        </div>
      </Card>
      </div> {/* end inner grid */}
    </div>
  );
}

// ─── VIEW: STATS ──────────────────────────────────────────────────────
const weekData   = [42,38,61,55,80,73,90];
const msgData    = [120,98,145,132,175,160,210];
const weekLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function StatsView() {
  const { user } = useCurrentUser();
  const [arcadeBests, setArcadeBests] = useState(null);
  const [roomCount, setRoomCount] = useState(null);

  useEffect(() => {
    api.get("/api/arcade/me").then(({ bests }) => setArcadeBests(bests)).catch(()=>{});
    api.get("/api/rooms").then(({ rooms }) => {
      // Rooms the current user is a member of would need a /me filter;
      // as a stand-in, count pinned + joined-looking rooms from the list.
      setRoomCount(rooms.length);
    }).catch(()=>{});
  }, []);

  const totalArcadePlays = arcadeBests
    ? Object.values(arcadeBests).reduce((sum, g) => sum + (g.playCount || 0), 0)
    : null;

  return (
    <div style={{ padding:"1.5rem",display:"flex",flexDirection:"column",gap:"1.5rem" }}>
      {/* Top stat pills - real data from the backend */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:"1rem" }}>
        <StatPill label="Friends"       value={user?.friendCount ?? "—"} color={C.green} />
        <StatPill label="Rooms Visible" value={roomCount ?? "—"} color={C.magenta} />
        <StatPill label="Arcade Plays"  value={totalArcadePlays ?? "—"} color={C.cyan} />
        <StatPill label="Member Since"  value={user?.createdAt ? new Date(user.createdAt).getFullYear() : "—"} color={C.gold} />
      </div>

      {/* Arcade personal bests */}
      <Card style={{ padding:"1.2rem 1.4rem" }} hover={false}>
        <div style={{ fontSize:"0.62rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.8rem" }}>🕹 Arcade Personal Bests</div>
        {arcadeBests ? (
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"0.8rem" }}>
            {[
              ["memory","Memory Matrix",C.cyan],
              ["sequence","Sequence Recall",C.magenta],
              ["nebula","Number Nebula",C.gold],
              ["wordwarp","Word Warp",C.green],
            ].map(([key,label,color])=>(
              <div key={key} style={{ padding:"0.8rem",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:5 }}>
                <div style={{ fontSize:"0.6rem",color:C.dimmer,fontFamily:font.mono,letterSpacing:"0.1em",marginBottom:"0.3rem" }}>{label.toUpperCase()}</div>
                <div style={{ fontSize:"1.3rem",fontWeight:900,fontFamily:font.display,color }}>{arcadeBests[key]?.best ?? "—"}</div>
                <div style={{ fontSize:"0.62rem",color:C.dimmer,fontFamily:font.mono }}>{arcadeBests[key]?.playCount ?? 0} plays</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize:"0.78rem",color:C.dimmer,fontFamily:font.body }}>Play some games in the Void Arcade to see your stats here!</div>
        )}
      </Card>

      {/* Activity charts - illustrative preview, not yet backed by analytics endpoints */}
      <div>
        <div style={{ fontSize:"0.6rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.8rem" }}>
          📊 Activity Trends <span style={{ color:C.gold }}>(preview — sample data)</span>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"1.2rem" }}>
          <Card style={{ padding:"1.2rem 1.4rem" }} hover={false}>
            <div style={{ fontSize:"0.62rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.3rem" }}>Activity — This Week</div>
            <div style={{ fontSize:"1.3rem",fontWeight:900,fontFamily:font.display,color:C.cyan,marginBottom:"0.8rem" }}>+23% <span style={{ fontSize:"0.7rem",color:C.dim,fontWeight:400 }}>vs last week</span></div>
            <Sparkline data={weekData} color={C.cyan} height={56}/>
            <div style={{ display:"flex",justifyContent:"space-between",marginTop:"0.4rem" }}>
              {weekLabels.map(l=><span key={l} style={{ fontSize:"0.58rem",color:C.dimmer,fontFamily:font.mono }}>{l}</span>)}
            </div>
          </Card>
          <Card style={{ padding:"1.2rem 1.4rem" }} hover={false}>
            <div style={{ fontSize:"0.62rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.3rem" }}>Messages Sent</div>
            <div style={{ fontSize:"1.3rem",fontWeight:900,fontFamily:font.display,color:C.magenta,marginBottom:"0.8rem" }}>210 <span style={{ fontSize:"0.7rem",color:C.dim,fontWeight:400 }}>today</span></div>
            <Sparkline data={msgData} color={C.magenta} height={56}/>
            <div style={{ display:"flex",justifyContent:"space-between",marginTop:"0.4rem" }}>
              {weekLabels.map(l=><span key={l} style={{ fontSize:"0.58rem",color:C.dimmer,fontFamily:font.mono }}>{l}</span>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── VIEW: NOTIFICATIONS ──────────────────────────────────────────────
function NotificationsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [dismissed, setDismissed] = useState([]); // ids hidden after accept/decline

  const load = () => {
    setLoading(true);
    api.get("/api/friends/requests")
      .then(({ requests }) => setRequests(requests))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const accept = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/api/friends/requests/${id}/accept`);
      setDismissed(d => [...d, id]);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/api/friends/requests/${id}/decline`);
      setDismissed(d => [...d, id]);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div style={{ padding:"1.5rem" }}><LoadingState label="Loading notifications…"/></div>;
  if (error) return <div style={{ padding:"1.5rem" }}><ErrorState message={error} onRetry={load}/></div>;

  const visible = requests.filter(r => !dismissed.includes(r.id));

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{ padding:"1.5rem",maxWidth:680 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.2rem" }}>
        <span style={{ fontSize:"0.68rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase" }}>{visible.length} pending</span>
      </div>

      {visible.length === 0 ? (
        <Card hover={false} style={{ padding:"3rem 1rem",textAlign:"center" }}>
          <span style={{ fontSize:"1.8rem" }}>✦</span>
          <p style={{ marginTop:"0.8rem",fontSize:"0.85rem",color:C.dim,fontFamily:font.body }}>
            You're all caught up. New friend requests will appear here.
          </p>
        </Card>
      ) : (
        <Card hover={false} style={{ overflow:"hidden" }}>
          {visible.map((r,i) => (
            <div key={r.id} style={{ display:"flex",alignItems:"center",gap:"0.9rem",padding:"0.95rem 1.2rem",
              borderBottom: i<visible.length-1?`1px solid ${C.border}`:"none",
              background:"rgba(0,229,255,0.035)" }}>
              <Avatar name={r.from.username} size={36} color={r.from.avatarColor || C.cyan}/>
              <div style={{ flex:1 }}>
                <p style={{ margin:0,fontSize:"0.83rem",color:C.white,fontFamily:font.body,lineHeight:1.5 }}>
                  <strong>{r.from.username}</strong> sent you a friend request
                  {r.mutualFriends > 0 && <span style={{ color:C.dim }}> · {r.mutualFriends} mutual friend{r.mutualFriends>1?"s":""}</span>}
                </p>
                <span style={{ fontSize:"0.65rem",color:C.green,fontFamily:font.mono,letterSpacing:"0.06em" }}>{timeAgo(r.createdAt)}</span>
              </div>
              <div style={{ display:"flex",gap:"0.4rem",flexShrink:0 }}>
                <button onClick={()=>accept(r.id)} disabled={busyId===r.id} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontWeight:700,fontSize:"0.72rem",padding:"0.35rem 0.8rem",borderRadius:3,cursor:"pointer",opacity:busyId===r.id?0.6:1 }}>Accept</button>
                <button onClick={()=>decline(r.id)} disabled={busyId===r.id} style={{ background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.dim,fontSize:"0.72rem",padding:"0.35rem 0.8rem",borderRadius:3,cursor:"pointer",opacity:busyId===r.id?0.6:1 }}>Decline</button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── VIEW: SETTINGS ───────────────────────────────────────────────────
function SettingsView() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editable profile fields
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("online");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // Preferences
  const [notif, setNotif]   = useState(true);
  const [sounds, setSounds] = useState(false);
  const [compact,setCompact]= useState(false);
  const [dmAll, setDmAll]   = useState(false);

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/api/auth/me")
      .then(({ user }) => {
        setUser(user);
        setBio(user.bio || "");
        setLocation(user.location || "");
        setStatus(user.status || "online");
        setNotif(user.preferences?.pushNotifications ?? true);
        setSounds(user.preferences?.soundEffects ?? false);
        setCompact(user.preferences?.compactMode ?? false);
        setDmAll(user.preferences?.allowDmsFromAnyone ?? false);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveProfile = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      await api.patch("/api/users/me", { bio, location });
      if (status !== user.status) await api.patch("/api/users/me/status", { status });
      setSaveMsg("Saved ✓");
    } catch (err) {
      setSaveMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = async (key, value, setter) => {
    setter(value); // optimistic
    try {
      await api.patch("/api/users/me/preferences", { [key]: value });
    } catch (err) {
      setter(!value); // revert on failure
      alert(err.message);
    }
  };

  const changePassword = async () => {
    setPwBusy(true); setPwMsg(null);
    try {
      await api.patch("/api/users/me/password", { currentPassword: currentPw, newPassword: newPw });
      setPwMsg("Password updated ✓");
      setCurrentPw(""); setNewPw("");
      setTimeout(()=>setShowPwForm(false), 1200);
    } catch (err) {
      setPwMsg(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirm("This will permanently delete your account. Are you sure?")) return;
    try {
      await api.delete("/api/users/me");
      localStorage.removeItem("voidsync_token");
      localStorage.removeItem("voidsync_user");
      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const Field = ({ label, value, onChange, type="text" }) => (
    <div style={{ marginBottom:"1.1rem" }}>
      <label style={{ display:"block",fontSize:"0.65rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.4rem" }}>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        style={{ width:"100%",boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:3,color:C.white,fontSize:"0.87rem",fontFamily:font.body,padding:"0.65rem 0.9rem",outline:"none" }} />
    </div>
  );

  const ToggleRow = ({ label, desc, value, onChange }) => (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 0",borderBottom:`1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize:"0.85rem",color:C.white,fontFamily:font.body,fontWeight:500 }}>{label}</div>
        {desc && <div style={{ fontSize:"0.7rem",color:C.dimmer,fontFamily:font.body,marginTop:"0.15rem" }}>{desc}</div>}
      </div>
      <Toggle value={value} onChange={onChange}/>
    </div>
  );

  if (loading) return <div style={{ padding:"1.5rem" }}><LoadingState label="Loading settings…"/></div>;
  if (error) return <div style={{ padding:"1.5rem" }}><ErrorState message={error} onRetry={load}/></div>;

  return (
    <div style={{ padding:"1.5rem",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:"1.5rem",alignItems:"start" }}>
      {/* Profile */}
      <Card style={{ padding:"1.4rem" }} hover={false}>
        <SectionLabel>👤 Profile</SectionLabel>
        <div style={{ display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.4rem",padding:"1rem",background:"rgba(0,229,255,0.04)",borderRadius:5,border:`1px solid ${C.border}` }}>
          <Avatar name={user.username} size={52} online={status==="online"} color={user.avatarColor || C.cyan}/>
          <div>
            <div style={{ fontSize:"1rem",fontWeight:700,color:C.white,fontFamily:font.body }}>{user.username}</div>
            <div style={{ fontSize:"0.72rem",color:C.dimmer,fontFamily:font.mono }}>{user.email}</div>
          </div>
        </div>
        <Field label="Bio" value={bio} onChange={setBio}/>
        <Field label="Location" value={location} onChange={setLocation}/>
        <div style={{ marginBottom:"1rem" }}>
          <label style={{ display:"block",fontSize:"0.65rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.4rem" }}>Status</label>
          <div style={{ display:"flex",gap:"0.5rem" }}>
            {[["online",C.green],["idle",C.gold],["dnd",C.red],["invisible",C.dimmer]].map(([s,col])=>(
              <button key={s} onClick={()=>setStatus(s)} style={{ flex:1,padding:"0.45rem 0",borderRadius:3,border:`1px solid ${status===s?col:C.border}`,background:status===s?`${col}22`:"transparent",color:status===s?col:C.dimmer,fontSize:"0.68rem",fontFamily:font.mono,cursor:"pointer",letterSpacing:"0.06em",textTransform:"capitalize",transition:"all 0.18s" }}>{s}</button>
            ))}
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving} style={{ width:"100%",padding:"0.7rem",background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontFamily:font.display,fontSize:"0.82rem",fontWeight:900,letterSpacing:"0.1em",textTransform:"uppercase",borderRadius:3,cursor:"pointer",opacity:saving?0.6:1 }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saveMsg && <div style={{ marginTop:"0.6rem",fontSize:"0.75rem",color:saveMsg.includes("✓")?C.green:C.red,fontFamily:font.mono,textAlign:"center" }}>{saveMsg}</div>}
      </Card>

      {/* Preferences */}
      <Card style={{ padding:"1.4rem" }} hover={false}>
        <SectionLabel>⚙ Preferences</SectionLabel>
        <ToggleRow label="Push Notifications" desc="Mentions, DMs, and room alerts" value={notif} onChange={(v)=>updatePreference("pushNotifications", v, setNotif)}/>
        <ToggleRow label="Sound Effects" desc="Message & notification sounds" value={sounds} onChange={(v)=>updatePreference("soundEffects", v, setSounds)}/>
        <ToggleRow label="Compact Mode" desc="Denser message layout" value={compact} onChange={(v)=>updatePreference("compactMode", v, setCompact)}/>
        <ToggleRow label="Allow DMs from Anyone" desc="Not just friends" value={dmAll} onChange={(v)=>updatePreference("allowDmsFromAnyone", v, setDmAll)}/>

        <div style={{ marginTop:"1.4rem" }}>
          <SectionLabel>🔐 Danger Zone</SectionLabel>
          <div style={{ display:"flex",flexDirection:"column",gap:"0.6rem" }}>
            {!showPwForm ? (
              <button onClick={()=>setShowPwForm(true)} style={{ padding:"0.6rem",background:"rgba(255,95,126,0.07)",border:`1px solid rgba(255,95,126,0.3)`,color:C.red,fontFamily:font.body,fontSize:"0.82rem",borderRadius:3,cursor:"pointer",transition:"all 0.18s" }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,95,126,0.14)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,95,126,0.07)";}}>
                Change Password
              </button>
            ) : (
              <div style={{ padding:"0.8rem",background:"rgba(255,95,126,0.05)",border:`1px solid rgba(255,95,126,0.2)`,borderRadius:5 }}>
                <input type="password" placeholder="Current password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)}
                  style={{ width:"100%",boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:3,color:C.white,fontSize:"0.82rem",fontFamily:font.body,padding:"0.55rem 0.8rem",outline:"none",marginBottom:"0.5rem" }}/>
                <input type="password" placeholder="New password (min 6 chars)" value={newPw} onChange={e=>setNewPw(e.target.value)}
                  style={{ width:"100%",boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:3,color:C.white,fontSize:"0.82rem",fontFamily:font.body,padding:"0.55rem 0.8rem",outline:"none",marginBottom:"0.6rem" }}/>
                <div style={{ display:"flex",gap:"0.5rem" }}>
                  <button onClick={changePassword} disabled={pwBusy} style={{ flex:1,padding:"0.55rem",background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontWeight:700,fontSize:"0.78rem",borderRadius:3,cursor:"pointer",opacity:pwBusy?0.6:1 }}>
                    {pwBusy ? "…" : "Update"}
                  </button>
                  <button onClick={()=>{ setShowPwForm(false); setPwMsg(null); setCurrentPw(""); setNewPw(""); }} style={{ flex:1,padding:"0.55rem",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.dim,fontSize:"0.78rem",borderRadius:3,cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
                {pwMsg && <div style={{ marginTop:"0.5rem",fontSize:"0.72rem",color:pwMsg.includes("✓")?C.green:C.red,fontFamily:font.mono }}>{pwMsg}</div>}
              </div>
            )}
            <button onClick={deleteAccount} style={{ padding:"0.6rem",background:"rgba(255,95,126,0.07)",border:`1px solid rgba(255,95,126,0.3)`,color:C.red,fontFamily:font.body,fontSize:"0.82rem",borderRadius:3,cursor:"pointer" }}>
              Delete Account
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// VOID ARCADE — Mind Games
// ════════════════════════════════════════════════════════════════════

// ── 1. MEMORY MATRIX ───────────────────────────────────────────────
const MEM_SYMBOLS = ["⬡","✦","◈","▲","◎","⚡","🌌","🚀"];
// ─── ARCADE SCORE HOOK ─────────────────────────────────────────────
// Fetches the player's personal best for a game on mount, and exposes
// a submit() function to post new scores to the backend.
function useArcadeScore(game) {
  const [best, setBest] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get("/api/arcade/me")
      .then(({ bests }) => setBest(bests[game]?.best ?? null))
      .catch(() => {}) // arcade is non-critical; fail silently
      .finally(() => setLoaded(true));
  }, [game]);

  const submit = async (score, meta = {}) => {
    try {
      const res = await api.post("/api/arcade/scores", { game, score, meta });
      setBest(res.personalBest);
      return res;
    } catch {
      return null; // non-critical
    }
  };

  return { best, setBest, submit, loaded };
}

function MemoryMatrix({ onExit }) {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const { best, submit } = useArcadeScore("memory");

  const shuffle = () => {
    const deck = [...MEM_SYMBOLS, ...MEM_SYMBOLS]
      .map((s,i)=>({ id:i, symbol:s }))
      .sort(()=>Math.random()-0.5);
    setCards(deck); setFlipped([]); setMatched([]); setMoves(0); setWon(false);
  };
  useEffect(()=>{ shuffle(); }, []);

  const handleFlip = (idx) => {
    if (flipped.length===2 || flipped.includes(idx) || matched.includes(idx)) return;
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length===2) {
      setMoves(m=>m+1);
      const [a,b] = next;
      if (cards[a].symbol === cards[b].symbol) {
        setTimeout(()=>{ setMatched(m=>[...m,a,b]); setFlipped([]); }, 400);
      } else {
        setTimeout(()=>setFlipped([]), 700);
      }
    }
  };

  useEffect(() => {
    if (cards.length && matched.length === cards.length) {
      setWon(true);
      submit(moves); // lower is better for "memory" - backend handles ranking
    }
  }, [matched]);

  return (
    <GameShell title="Memory Matrix" subtitle="Match the cosmic pairs" onExit={onExit} accent={C.cyan}
      stats={[{label:"Moves",value:moves},{label:"Best",value:best??"—"}]} onReset={shuffle} won={won}>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.6rem",maxWidth:360,margin:"0 auto" }}>
        {cards.map((c,i)=>{
          const isFlipped = flipped.includes(i) || matched.includes(i);
          const isMatched = matched.includes(i);
          return (
            <button key={c.id} onClick={()=>handleFlip(i)} style={{
              aspectRatio:"1", borderRadius:8, cursor:"pointer", border:`1px solid ${isMatched?C.green:C.border}`,
              background: isFlipped ? (isMatched?"rgba(0,255,136,0.12)":"rgba(0,229,255,0.12)") : "rgba(255,255,255,0.04)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"1.6rem", transition:"all 0.25s", transform:isFlipped?"scale(1)":"scale(0.96)",
              color: isFlipped?C.white:"transparent",
            }}>{isFlipped?c.symbol:"?"}</button>
          );
        })}
      </div>
    </GameShell>
  );
}

// ── 2. SEQUENCE RECALL (Simon Says) ────────────────────────────────
const SEQ_COLORS = [
  { id:0, color:C.cyan,    label:"Cyan"    },
  { id:1, color:C.magenta, label:"Magenta" },
  { id:2, color:C.gold,    label:"Gold"    },
  { id:3, color:C.purple,  label:"Violet"  },
];
function SequenceRecall({ onExit }) {
  const [sequence, setSequence] = useState([]);
  const [playerSeq, setPlayerSeq] = useState([]);
  const [active, setActive] = useState(null);
  const [status, setStatus] = useState("ready"); // ready | showing | input | lost
  const { best, submit } = useArcadeScore("sequence");

  const start = () => {
    const first = [Math.floor(Math.random()*4)];
    setSequence(first); setPlayerSeq([]); setStatus("showing");
  };
  const reset = () => { setSequence([]); setPlayerSeq([]); setStatus("ready"); };

  // Play the sequence
  useEffect(() => {
    if (status !== "showing" || sequence.length===0) return;
    let i = 0;
    const playStep = () => {
      if (i >= sequence.length) { setActive(null); setStatus("input"); return; }
      setActive(sequence[i]);
      setTimeout(()=>{ setActive(null); i++; setTimeout(playStep, 250); }, 450);
    };
    const t = setTimeout(playStep, 500);
    return ()=>clearTimeout(t);
  }, [status, sequence]);

  const handlePress = (id) => {
    if (status !== "input") return;
    setActive(id);
    setTimeout(()=>setActive(null), 200);
    const next = [...playerSeq, id];
    setPlayerSeq(next);
    const idx = next.length - 1;
    if (sequence[idx] !== id) {
      setStatus("lost");
      const score = sequence.length - 1;
      submit(score);
      return;
    }
    if (next.length === sequence.length) {
      setTimeout(()=>{
        setSequence(s=>[...s, Math.floor(Math.random()*4)]);
        setPlayerSeq([]); setStatus("showing");
      }, 600);
    }
  };

  return (
    <GameShell title="Sequence Recall" subtitle="Repeat the glowing pattern" onExit={onExit} accent={C.magenta}
      stats={[{label:"Round",value:Math.max(sequence.length-(status==="lost"?1:0),0)},{label:"Best",value:best??"—"}]}
      onReset={reset} lost={status==="lost"}>
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"1.2rem" }}>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"0.7rem",maxWidth:260 }}>
          {SEQ_COLORS.map(c=>(
            <button key={c.id} onClick={()=>handlePress(c.id)} disabled={status!=="input"} style={{
              width:110,height:110,borderRadius:10,cursor:status==="input"?"pointer":"default",
              border:`2px solid ${c.color}`,
              background: active===c.id ? c.color : `${c.color}1a`,
              boxShadow: active===c.id ? `0 0 24px ${c.color}` : "none",
              transition:"all 0.15s", fontFamily:font.mono, fontSize:"0.65rem", color:active===c.id?"#000":c.color, letterSpacing:"0.1em" }}>
              {c.label}
            </button>
          ))}
        </div>
        {status==="ready" && (
          <button onClick={start} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontFamily:font.display,fontWeight:900,fontSize:"0.8rem",letterSpacing:"0.1em",textTransform:"uppercase",padding:"0.7rem 2rem",borderRadius:4,cursor:"pointer" }}>Start</button>
        )}
        {status==="showing" && <span style={{ fontFamily:font.mono,fontSize:"0.75rem",color:C.dimmer,letterSpacing:"0.1em" }}>WATCH CLOSELY…</span>}
        {status==="input" && <span style={{ fontFamily:font.mono,fontSize:"0.75rem",color:C.cyan,letterSpacing:"0.1em" }}>YOUR TURN — {playerSeq.length}/{sequence.length}</span>}
        {status==="lost" && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:font.display,fontSize:"1.2rem",fontWeight:900,color:C.red,marginBottom:"0.6rem" }}>Sequence broken!</div>
            <button onClick={start} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontFamily:font.display,fontWeight:900,fontSize:"0.78rem",letterSpacing:"0.1em",textTransform:"uppercase",padding:"0.6rem 1.8rem",borderRadius:4,cursor:"pointer" }}>Try Again</button>
          </div>
        )}
      </div>
    </GameShell>
  );
}

// ── 3. NUMBER NEBULA (2048-style, simplified 4x4) ──────────────────
function NumberNebula({ onExit }) {
  const SIZE = 4;
  const emptyGrid = () => Array.from({length:SIZE*SIZE}, ()=>0);
  const [grid, setGrid] = useState(emptyGrid());
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const { best, submit } = useArcadeScore("nebula");

  const addRandom = (g) => {
    const empties = g.map((v,i)=>v===0?i:-1).filter(i=>i!==-1);
    if (!empties.length) return g;
    const idx = empties[Math.floor(Math.random()*empties.length)];
    const copy = [...g]; copy[idx] = Math.random()<0.9?2:4;
    return copy;
  };

  const init = () => {
    let g = emptyGrid(); g = addRandom(g); g = addRandom(g);
    setGrid(g); setScore(0); setOver(false);
  };
  useEffect(()=>{ init(); }, []);

  const move = (dir) => {
    if (over) return;
    let g = [...grid]; let moved = false; let gained = 0;
    const lines = [];
    for (let i=0;i<SIZE;i++) {
      let line = [];
      for (let j=0;j<SIZE;j++) {
        const idx = dir==="left"||dir==="right" ? i*SIZE+j : j*SIZE+i;
        line.push(g[idx]);
      }
      if (dir==="right"||dir==="down") line.reverse();
      // compress + merge
      let vals = line.filter(v=>v!==0);
      for (let k=0;k<vals.length-1;k++) {
        if (vals[k]===vals[k+1]) { vals[k]*=2; gained+=vals[k]; vals.splice(k+1,1); }
      }
      while (vals.length < SIZE) vals.push(0);
      if (dir==="right"||dir==="down") vals.reverse();
      lines.push(vals);
      for (let j=0;j<SIZE;j++) {
        const idx = dir==="left"||dir==="right" ? i*SIZE+j : j*SIZE+i;
        if (g[idx] !== vals[j]) moved = true;
        g[idx] = vals[j];
      }
    }
    if (moved) {
      g = addRandom(g);
      setGrid(g);
      const newScore = score + gained;
      setScore(newScore);
      // check game over
      const hasEmpty = g.some(v=>v===0);
      if (!hasEmpty) {
        // check merges possible
        let canMerge = false;
        for (let i=0;i<SIZE;i++) for(let j=0;j<SIZE;j++){
          const idx=i*SIZE+j;
          if (j<SIZE-1 && g[idx]===g[idx+1]) canMerge=true;
          if (i<SIZE-1 && g[idx]===g[idx+SIZE]) canMerge=true;
        }
        if (!canMerge) { setOver(true); submit(newScore); }
      }
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowLeft:"left", ArrowRight:"right", ArrowUp:"up", ArrowDown:"down" };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  }, [grid, over]);

  const tileColor = (v) => {
    const colors = { 2:C.cyan, 4:C.cyan, 8:C.magenta, 16:C.magenta, 32:C.gold, 64:C.gold, 128:C.purple, 256:C.purple, 512:C.green, 1024:C.green, 2048:"#fff" };
    return colors[v] || C.white;
  };

  return (
    <GameShell title="Number Nebula" subtitle="Merge stars to reach 2048" onExit={onExit} accent={C.gold}
      stats={[{label:"Score",value:score},{label:"Best",value:best??"—"}]} onReset={init} lost={over}>
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"1rem" }}>
        <div style={{ display:"grid",gridTemplateColumns:`repeat(${SIZE},1fr)`,gap:"0.5rem",
          background:"rgba(0,0,0,0.3)",padding:"0.6rem",borderRadius:8,maxWidth:320,border:`1px solid ${C.border}` }}>
          {grid.map((v,i)=>(
            <div key={i} style={{ width:64,height:64,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",
              background: v===0?"rgba(255,255,255,0.03)":`${tileColor(v)}1a`,
              border:`1px solid ${v===0?C.border:tileColor(v)+"55"}`,
              fontFamily:font.display,fontWeight:900,fontSize:v>=1000?"1rem":"1.3rem",
              color:v===0?"transparent":tileColor(v), transition:"all 0.15s" }}>{v||""}</div>
          ))}
        </div>
        {/* Mobile controls */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,44px)",gridTemplateRows:"repeat(2,44px)",gap:"0.4rem",justifyContent:"center" }}>
          <div/>
          <button onClick={()=>move("up")} style={arrowBtnStyle}>↑</button>
          <div/>
          <button onClick={()=>move("left")} style={arrowBtnStyle}>←</button>
          <button onClick={()=>move("down")} style={arrowBtnStyle}>↓</button>
          <button onClick={()=>move("right")} style={arrowBtnStyle}>→</button>
        </div>
        {over && <div style={{ fontFamily:font.display,fontSize:"1.1rem",fontWeight:900,color:C.red }}>No more moves!</div>}
        <span style={{ fontSize:"0.65rem",color:C.dimmer,fontFamily:font.mono,letterSpacing:"0.06em" }}>Use arrow keys or buttons</span>
      </div>
    </GameShell>
  );
}
const arrowBtnStyle = { background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.white,fontSize:"1rem",borderRadius:6,cursor:"pointer" };

// ── 4. WORD WARP ────────────────────────────────────────────────────
const WORD_BANK = [
  { word:"GALAXY",  hint:"A vast system of stars" },
  { word:"NEBULA",  hint:"A cloud of gas and dust in space" },
  { word:"COMET",   hint:"Icy body that grows a tail near the sun" },
  { word:"ORBIT",   hint:"Path around a celestial body" },
  { word:"VOID",    hint:"Completely empty space" },
  { word:"QUASAR",  hint:"Extremely bright galactic core" },
  { word:"PULSAR",  hint:"Rapidly rotating neutron star" },
  { word:"COSMOS",  hint:"The universe as an ordered system" },
];
function scramble(word) {
  let arr = word.split("");
  do { arr = arr.sort(()=>Math.random()-0.5); } while (arr.join("")===word);
  return arr.join("");
}
function WordWarp({ onExit }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [scrambled, setScrambled] = useState("");
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null
  const [timeLeft, setTimeLeft] = useState(20);
  const { best, submit: submitScore } = useArcadeScore("wordwarp");

  const newRound = (idx) => {
    setScrambled(scramble(WORD_BANK[idx].word));
    setGuess(""); setFeedback(null); setTimeLeft(20);
  };
  useEffect(()=>{ newRound(0); setScore(0); }, []);

  useEffect(() => {
    if (feedback) return;
    if (timeLeft<=0) { setFeedback("wrong"); return; }
    const t = setTimeout(()=>setTimeLeft(s=>s-1), 1000);
    return ()=>clearTimeout(t);
  }, [timeLeft, feedback]);

  const submitGuess = () => {
    if (feedback) return;
    if (guess.trim().toUpperCase() === WORD_BANK[roundIdx].word) {
      setFeedback("correct");
      const ns = score + 10 + timeLeft;
      setScore(ns);
      submitScore(ns);
    } else {
      setFeedback("wrong");
      submitScore(score);
    }
  };

  const next = () => {
    const ni = (roundIdx+1) % WORD_BANK.length;
    setRoundIdx(ni); newRound(ni);
  };
  const restart = () => { setRoundIdx(0); newRound(0); setScore(0); };

  return (
    <GameShell title="Word Warp" subtitle="Unscramble the cosmic word" onExit={onExit} accent={C.green}
      stats={[{label:"Score",value:score},{label:"Best",value:best??"—"}]} onReset={restart}>
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"1.1rem",maxWidth:380,margin:"0 auto" }}>
        {/* Timer bar */}
        <div style={{ width:"100%",height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${(timeLeft/20)*100}%`,background:timeLeft>6?C.green:C.red,transition:"width 1s linear" }}/>
        </div>

        <div style={{ fontFamily:font.display,fontSize:"2.2rem",fontWeight:900,letterSpacing:"0.3em",color:C.white,textAlign:"center" }}>
          {scrambled}
        </div>
        <div style={{ fontSize:"0.78rem",color:C.dimmer,fontFamily:font.body,textAlign:"center",fontStyle:"italic" }}>
          💡 {WORD_BANK[roundIdx].hint}
        </div>

        {feedback ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:font.display,fontSize:"1.1rem",fontWeight:900,
              color:feedback==="correct"?C.green:C.red,marginBottom:"0.5rem" }}>
              {feedback==="correct" ? `Correct! +${10+timeLeft} pts` : `The word was: ${WORD_BANK[roundIdx].word}`}
            </div>
            <button onClick={next} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontFamily:font.display,fontWeight:900,fontSize:"0.78rem",letterSpacing:"0.1em",textTransform:"uppercase",padding:"0.6rem 1.8rem",borderRadius:4,cursor:"pointer" }}>Next Word →</button>
          </div>
        ) : (
          <>
            <input value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitGuess()}
              placeholder="Type your answer..." autoFocus
              style={{ width:"100%",boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:5,
                color:C.white,fontFamily:font.mono,fontSize:"1rem",letterSpacing:"0.15em",textAlign:"center",
                padding:"0.65rem",outline:"none",textTransform:"uppercase" }}/>
            <button onClick={submitGuess} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontFamily:font.display,fontWeight:900,fontSize:"0.78rem",letterSpacing:"0.1em",textTransform:"uppercase",padding:"0.6rem 1.8rem",borderRadius:4,cursor:"pointer" }}>Submit</button>
          </>
        )}
      </div>
    </GameShell>
  );
}

// ── GAME SHELL — shared wrapper for all games ───────────────────────
function GameShell({ title, subtitle, accent, children, onExit, stats, onReset, won, lost }) {
  return (
    <div style={{ padding:"1.5rem", maxWidth:760, margin:"0 auto" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.2rem",flexWrap:"wrap",gap:"0.8rem" }}>
        <div>
          <button onClick={onExit} style={{ background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"0.75rem",fontFamily:font.mono,letterSpacing:"0.08em",padding:0,marginBottom:"0.4rem" }}
            onMouseEnter={e=>e.currentTarget.style.color=C.white}
            onMouseLeave={e=>e.currentTarget.style.color=C.dimmer}>← Back to Arcade</button>
          <h2 style={{ fontFamily:font.display,fontSize:"1.4rem",fontWeight:900,margin:0,color:C.white,
            background:`linear-gradient(135deg,#fff,${accent})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>{title}</h2>
          <p style={{ margin:"0.2rem 0 0",fontSize:"0.78rem",color:C.dim,fontFamily:font.body }}>{subtitle}</p>
        </div>
        <div style={{ display:"flex",gap:"0.6rem" }}>
          {stats.map(s=>(
            <div key={s.label} style={{ background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:5,padding:"0.5rem 0.9rem",textAlign:"center",minWidth:70 }}>
              <div style={{ fontFamily:font.display,fontWeight:900,fontSize:"1.1rem",color:accent }}>{s.value}</div>
              <div style={{ fontSize:"0.55rem",letterSpacing:"0.15em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase" }}>{s.label}</div>
            </div>
          ))}
          <button onClick={onReset} title="Restart" style={{ background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.dim,borderRadius:5,padding:"0.5rem 0.8rem",cursor:"pointer",fontSize:"0.9rem",transition:"all 0.18s" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=accent;e.currentTarget.style.color=accent;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>↻</button>
        </div>
      </div>

      {won && (
        <div style={{ textAlign:"center",padding:"0.8rem",marginBottom:"1.2rem",background:"rgba(0,255,136,0.08)",border:`1px solid rgba(0,255,136,0.3)`,borderRadius:6,color:C.green,fontFamily:font.display,fontWeight:900,fontSize:"1rem" }}>
          ✦ You won! ✦
        </div>
      )}

      <Card hover={false} style={{ padding:"1.6rem" }}>
        {children}
      </Card>
    </div>
  );
}

// ── ARCADE HUB ───────────────────────────────────────────────────────
const ARCADE_GAMES = [
  { id:"memory",   title:"Memory Matrix",  desc:"Flip and match cosmic symbol pairs. Train your visual recall.", icon:"⬡", color:C.cyan,    difficulty:"Easy"   },
  { id:"sequence", title:"Sequence Recall",desc:"Watch the pattern, then repeat it. How long can your streak go?", icon:"✦", color:C.magenta, difficulty:"Medium" },
  { id:"nebula",   title:"Number Nebula",  desc:"Merge matching numbers to reach 2048. Classic sliding puzzle.", icon:"◈", color:C.gold,    difficulty:"Hard"   },
  { id:"wordwarp", title:"Word Warp",      desc:"Unscramble cosmic vocabulary before the timer runs out.", icon:"▲", color:C.green,   difficulty:"Medium" },
];

function GamesView() {
  const [openGame, setOpenGame] = useState(null);

  if (openGame === "memory")   return <MemoryMatrix onExit={()=>setOpenGame(null)}/>;
  if (openGame === "sequence") return <SequenceRecall onExit={()=>setOpenGame(null)}/>;
  if (openGame === "nebula")   return <NumberNebula onExit={()=>setOpenGame(null)}/>;
  if (openGame === "wordwarp") return <WordWarp onExit={()=>setOpenGame(null)}/>;

  return (
    <div style={{ padding:"1.5rem" }}>
      <div style={{ marginBottom:"1.6rem" }}>
        <div style={{ fontSize:"0.6rem",letterSpacing:"0.25em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.4rem" }}>✦ Bored? Stretch your mind ✦</div>
        <h2 style={{ fontFamily:font.display,fontSize:"clamp(1.5rem,4vw,2rem)",fontWeight:900,color:C.white,margin:0 }}>
          Welcome to the <span style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>Void Arcade</span>
        </h2>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"1.2rem" }}>
        {ARCADE_GAMES.map(g=>(
          <Card key={g.id} style={{ padding:"1.4rem",cursor:"pointer" }}>
            <div onClick={()=>setOpenGame(g.id)}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.9rem" }}>
                <div style={{ width:46,height:46,borderRadius:8,background:`${g.color}15`,border:`1px solid ${g.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",color:g.color }}>{g.icon}</div>
                <span style={{ fontSize:"0.6rem",letterSpacing:"0.12em",color:g.color,fontFamily:font.mono,background:`${g.color}15`,border:`1px solid ${g.color}33`,borderRadius:3,padding:"2px 8px" }}>{g.difficulty.toUpperCase()}</span>
              </div>
              <h3 style={{ fontFamily:font.display,fontSize:"1.05rem",fontWeight:900,color:C.white,margin:"0 0 0.5rem" }}>{g.title}</h3>
              <p style={{ fontFamily:font.body,fontSize:"0.82rem",color:C.dim,lineHeight:1.6,margin:"0 0 1rem" }}>{g.desc}</p>
              <button style={{ width:"100%",padding:"0.55rem",background:`${g.color}15`,border:`1px solid ${g.color}44`,color:g.color,fontFamily:font.display,fontWeight:900,fontSize:"0.72rem",letterSpacing:"0.1em",textTransform:"uppercase",borderRadius:4,cursor:"pointer",transition:"background 0.18s" }}
                onMouseEnter={e=>e.currentTarget.style.background=`${g.color}28`}
                onMouseLeave={e=>e.currentTarget.style.background=`${g.color}15`}>Play Now</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── SECTION LABEL HELPER ─────────────────────────────────────────────
function SectionLabel({ children, style = {} }) {
  return (
    <div style={{ fontSize:"0.62rem",letterSpacing:"0.22em",color:C.dimmer,fontFamily:font.mono,
      textTransform:"uppercase",marginBottom:"0.85rem",...style }}>
      {children}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────
export default function Dashboard({ onOpenRoom, onOpenDm, onOpenChat }) {
  const { isMobile } = useBreakpoint();
  const [active, setActive] = useState("rooms");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Intercept "chat" nav item — navigate to Chat page instead of a view
  const handleSetActive = (id) => {
    if (id === "chat") { onOpenChat?.(); return; }
    setActive(id);
  };

  const views = {
    rooms: <RoomsView onOpenRoom={onOpenRoom}/>,
    friends: <FriendsView onOpenDm={onOpenDm}/>,
    games: <GamesView/>,
    stats: <StatsView/>,
    notifications: <NotificationsView/>,
    settings: <SettingsView/>,
  };

  return (
    <div style={{ display:"flex",height:"100vh",overflow:"hidden",background:C.void,color:C.white,fontFamily:font.body,position:"relative" }}>

      {/* Starfield background */}
      <StarfieldBg/>

      {/* Sidebar — desktop sticky, mobile slide-out drawer */}
      <Sidebar active={active} setActive={handleSetActive} collapsed={collapsed} setCollapsed={setCollapsed}
        isMobile={isMobile} open={isMobile?mobileNavOpen:true} onClose={()=>setMobileNavOpen(false)}/>

      {/* Main panel */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden",position:"relative",zIndex:10 }}>
        <Topbar active={active} isMobile={isMobile} onMenuClick={()=>setMobileNavOpen(true)} setActive={handleSetActive}/>
        <main style={{ flex:1,overflowY:"auto" }}>
          <ErrorBoundary key={active}>
            {views[active]}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
