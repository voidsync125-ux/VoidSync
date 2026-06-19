import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";

// ─── TOKENS ───────────────────────────────────────────────────────────
const C = {
  void: "#03010a", nebula: "#0d0120",
  cyan: "#00e5ff", magenta: "#ff2cf7", gold: "#ffd64a", green: "#00ff88",
  red: "#ff5f7e", orange: "#ff9f2f", purple: "#7b2fff",
  white: "#f0f4ff", dim: "rgba(240,244,255,0.55)", dimmer: "rgba(240,244,255,0.28)",
  border: "rgba(0,229,255,0.13)", borderHover: "rgba(0,229,255,0.42)",
  sidebarBg: "rgba(4,0,13,0.94)", inputBg: "rgba(0,229,255,0.05)",
  msgBg: "rgba(0,229,255,0.07)", msgOwnBg: "rgba(255,44,247,0.1)",
  cardBg: "rgba(10,0,26,0.7)",
};
const font = {
  display: "'Arial Black','Impact','Franklin Gothic Heavy',sans-serif",
  body: "'Inter','Segoe UI',sans-serif",
  mono: "'Courier New',monospace",
};

// ─── RESPONSIVE ───────────────────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState({ isMobile: false, isTablet: false, w: 1200 });
  useEffect(() => {
    const calc = () => { const w = window.innerWidth; setBp({ isMobile: w < 640, isTablet: w >= 640 && w < 1024, w }); };
    calc(); window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return bp;
}

// ─── LIQUID NEON LAVA LAMP BACKGROUND ────────────────────────────────
// Large metaball-style blobs of molten neon slowly drifting and merging,
// exactly like a lava lamp but in cyan / magenta / purple / gold.
// Mouse warps the nearest blob toward the cursor.
function LiquidBg() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 50);
    camera.position.z = 6;

    // ── Lava blobs — large glowing spheres that drift organically ──
    const BLOB_DEFS = [
      { x: 0,    y: 0,    r: 1.55, hue: 0.52, spd: 0.22, ax: 0.7,  ay: 0.5  }, // cyan core
      { x:-1.8,  y: 1.2,  r: 1.2,  hue: 0.83, spd: 0.17, ax: 0.5,  ay: 0.8  }, // magenta
      { x: 1.9,  y:-1.1,  r: 1.1,  hue: 0.72, spd: 0.28, ax: 0.9,  ay: 0.4  }, // violet
      { x: 0.6,  y: 2.0,  r: 0.9,  hue: 0.13, spd: 0.20, ax: 0.4,  ay: 0.9  }, // gold
      { x:-2.2,  y:-1.5,  r: 1.0,  hue: 0.52, spd: 0.15, ax: 0.6,  ay: 0.6  }, // cyan 2
      { x: 2.5,  y: 1.8,  r: 0.85, hue: 0.83, spd: 0.32, ax: 0.8,  ay: 0.3  }, // magenta 2
    ];

    const blobs = BLOB_DEFS.map(d => {
      // Each blob = two nested meshes: inner solid + outer glow shell
      const col = new THREE.Color().setHSL(d.hue, 1.0, 0.52);
      const colGlow = new THREE.Color().setHSL(d.hue, 1.0, 0.38);

      const inner = new THREE.Mesh(
        new THREE.SphereGeometry(d.r, 36, 36),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 })
      );
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(d.r * 1.55, 24, 24),
        new THREE.MeshBasicMaterial({ color: colGlow, transparent: true, opacity: 0.13, side: THREE.BackSide })
      );
      const group = new THREE.Group();
      group.add(inner, glow);
      group.position.set(d.x, d.y, -1);
      scene.add(group);

      return { group, inner, glow, ...d, ox: d.x, oy: d.y, col, colGlow, t0: Math.random() * Math.PI * 2 };
    });

    // ── Rising shimmer sparks ──────────────────────────────────────
    const SPARKS = 220;
    const spkPos = new Float32Array(SPARKS * 3);
    const spkSpd = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i++) {
      spkPos[i*3]   = (Math.random() - 0.5) * 9;
      spkPos[i*3+1] = (Math.random() - 0.5) * 7;
      spkPos[i*3+2] = 0.5 + Math.random() * 1.5;
      spkSpd[i]     = 0.005 + Math.random() * 0.015;
    }
    const spkGeo = new THREE.BufferGeometry();
    spkGeo.setAttribute("position", new THREE.BufferAttribute(spkPos, 3));
    const spkMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.35, sizeAttenuation: true });
    scene.add(new THREE.Points(spkGeo, spkMat));

    // ── Mouse tracking ────────────────────────────────────────────
    let mx = 0, my = 0;
    const onMouse = (e) => {
      const r = el.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width  - 0.5) * 5;
      my = -((e.clientY - r.top)  / r.height - 0.5) * 3.5;
    };
    window.addEventListener("mousemove", onMouse);

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let raf; const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      blobs.forEach((b, i) => {
        // Lava-lamp drift: slow Lissajous paths with different frequencies per axis
        const driftX = b.ox + Math.sin(t * b.spd * b.ax + b.t0) * 1.8 + Math.sin(t * b.spd * 0.4 + b.t0 * 1.3) * 0.8;
        const driftY = b.oy + Math.cos(t * b.spd * b.ay + b.t0 * 0.7) * 1.5 + Math.cos(t * b.spd * 0.6 + b.t0) * 0.6;

        // Closest blob follows mouse gently
        const pull = i === 0 ? 0.06 : 0.015;
        const tx = driftX + (mx - driftX) * pull;
        const ty = driftY + (my - driftY) * pull;

        b.group.position.x += (tx - b.group.position.x) * 0.03;
        b.group.position.y += (ty - b.group.position.y) * 0.03;

        // Breathe size — organic pulsing
        const breathe = 1 + Math.sin(t * b.spd * 1.8 + b.t0) * 0.12;
        b.group.scale.setScalar(breathe);

        // Hue shift over time — colors morph slowly like molten glass
        const hue = (b.hue + t * 0.018) % 1;
        b.inner.material.color.setHSL(hue, 1.0, 0.52);
        b.glow.material.color.setHSL(hue, 1.0, 0.35);

        // Opacity pulse — blobs seem to glow hotter then cool
        b.inner.material.opacity = 0.42 + Math.sin(t * b.spd * 2.2 + b.t0) * 0.15;
        b.glow.material.opacity  = 0.08 + Math.sin(t * b.spd * 1.5 + b.t0 * 1.2) * 0.06;
      });

      // Rise sparks, loop at top
      const sa = spkGeo.attributes.position.array;
      for (let i = 0; i < SPARKS; i++) {
        sa[i*3+1] += spkSpd[i];
        if (sa[i*3+1] > 4) sa[i*3+1] = -4;
        sa[i*3] += Math.sin(t * 0.4 + i * 0.7) * 0.001;
      }
      spkGeo.attributes.position.needsUpdate = true;
      spkMat.opacity = 0.22 + Math.sin(t * 0.5) * 0.1;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }} />;
}

// ─── HELPERS ────────────────────────────────────────────────────────
// Deterministic color assignment per user (since the backend doesn't
// store per-user "theme colors" - we derive one from their id/username
// so each person has a consistent color across the UI).
const USER_COLORS = [C.cyan, C.magenta, C.gold, C.green, C.purple, C.orange];
function colorForUser(idOrName = "") {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) hash = (hash * 31 + idOrName.charCodeAt(i)) >>> 0;
  return USER_COLORS[hash % USER_COLORS.length];
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month:"short", day:"numeric" });
}

// Maps a backend message object to the shape MessageBubble expects
function mapMessage(m, currentUserId) {
  const authorId = m.author?._id || m.author?.id || m.author;
  const authorName = m.author?.username || "Unknown";
  const isSelf = String(authorId) === String(currentUserId);
  return {
    id: m.id || m._id,
    author: authorName,
    authorId,
    color: colorForUser(authorName),
    time: formatTime(m.createdAt),
    text: m.text,
    type: m.type || "text",
    duration: m.duration,
    fileUrl: m.fileUrl || null,
    fileName: m.fileName,
    fileSize: m.fileSize,
    reactions: m.reactions || {},
    replyTo: m.replyTo ? `${m.replyTo.author?.username || ""}: ${(m.replyTo.text||"").slice(0,40)}` : null,
    self: isSelf,
  };
}

const REACTIONS_SET = ["✦","⚡","🔥","💜","👾","🚀"];

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────
const Avatar = ({ name, size=32, color=C.cyan, online, self }) => (
  <div style={{ position:"relative",flexShrink:0 }}>
    <div style={{ width:size,height:size,borderRadius:"50%",
      background:self?`linear-gradient(135deg,${C.magenta},${C.cyan})`:`linear-gradient(135deg,${color},${color}88)`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontFamily:font.display,fontSize:size*.38,fontWeight:900,color:"#000",
      boxShadow:self?`0 0 8px ${C.magenta}44`:`0 0 6px ${color}33` }}>
      {name?.[0]?.toUpperCase()}
    </div>
    {online !== undefined && <span style={{ position:"absolute",bottom:0,right:0,width:size*.28,height:size*.28,borderRadius:"50%",background:online?C.green:"rgba(255,255,255,0.18)",border:`2px solid ${C.void}` }} />}
  </div>
);

// ─── LEFT SIDEBAR ─────────────────────────────────────────────────────
function LeftSidebar({ active, setActive, open, onClose, rooms, dms, currentUser, presence, isFixed }) {
  const { isMobile, isTablet } = useBreakpoint();
  const showSidebarFixed = isFixed ?? (!isMobile && !isTablet);
  const [roomsOpen, setRoomsOpen] = useState(true);
  const [dmsOpen, setDmsOpen]     = useState(true);

  const SectionBtn = ({ label, isOpen, onToggle }) => (
    <button onClick={onToggle} style={{ width:"100%",display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.5rem 0.9rem 0.3rem",background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"0.6rem",fontFamily:font.mono,letterSpacing:"0.18em",textTransform:"uppercase" }}>
      <span style={{ fontSize:"0.45rem" }}>{isOpen?"▼":"▶"}</span>{label}
    </button>
  );

  const Item = ({ id, label, sub, unread, dotColor, avatar, online, isDm }) => {
    const activeKey = isDm ? `dm:${id}` : id;
    const isActive = active === activeKey;
    const hasUnread = unread > 0;
    return (
      <button onClick={()=>{ setActive(activeKey); if(!showSidebarFixed) onClose(); }} style={{
        width:"100%",display:"flex",alignItems:"center",gap:"0.65rem",
        padding:"0.45rem 0.9rem",background:isActive?"rgba(0,229,255,0.1)":"none",
        border:"none",borderLeft:isActive?`2px solid ${C.cyan}`:"2px solid transparent",
        cursor:"pointer",transition:"all 0.16s",borderRadius:"0 4px 4px 0",textAlign:"left" }}
        onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background="rgba(0,229,255,0.05)"; }}
        onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background="none"; }}>
        {avatar ? (
          <Avatar name={avatar} size={28} color={dotColor} online={online} />
        ) : (
          <span style={{ color:isActive?C.cyan:C.dimmer,fontFamily:font.mono,fontSize:"0.9rem",lineHeight:1,width:16,textAlign:"center" }}>#</span>
        )}
        <div style={{ flex:1,overflow:"hidden" }}>
          <div style={{ fontSize:"0.82rem",color:isActive?C.white:hasUnread?C.white:C.dim,
            fontFamily:font.body,fontWeight:isActive||hasUnread?700:400,
            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{label}</div>
          {sub && <div style={{ fontSize:"0.65rem",color:hasUnread?C.dim:C.dimmer,fontFamily:font.body,
            fontWeight:hasUnread?500:400,
            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{sub}</div>}
        </div>
        {hasUnread && <span style={{ minWidth:16,height:16,borderRadius:8,background:C.magenta,color:"#000",fontSize:"0.58rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",flexShrink:0 }}>{unread}</span>}
      </button>
    );
  };

  return (
    <>
      {/* Overlay only for mobile drawer - NEVER on desktop fixed sidebar */}
      {!showSidebarFixed && open && (
        <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:29,background:"rgba(0,0,0,0.5)" }} />
      )}
      <aside style={{ width:240,flexShrink:0,height:"100vh",position:"fixed",left:0,top:0,
        background:C.sidebarBg,borderRight:`1px solid ${C.border}`,
        backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",
        display:"flex",flexDirection:"column",zIndex:30,
        transform:open?"translateX(0)":"translateX(-100%)",
        pointerEvents: open ? "auto" : "none",
        transition:"transform 0.26s cubic-bezier(.4,0,.2,1)" }}>

        {/* Logo strip */}
        <div style={{ height:56,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1rem",borderBottom:`1px solid ${C.border}`,flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:"0.5rem" }}>
            <div style={{ width:24,height:24,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,#fff,${C.cyan})`,boxShadow:`0 0 8px ${C.cyan}` }} />
            <span style={{ fontFamily:font.display,fontSize:"1rem",fontWeight:900,background:`linear-gradient(135deg,#fff,${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>VoidSync</span>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"1rem",padding:4,lineHeight:1 }}>✕</button>
        </div>

        {/* Nav */}
        <div style={{ flex:1,overflowY:"auto",padding:"0.5rem 0" }}>
          <SectionBtn label="Rooms" isOpen={roomsOpen} onToggle={()=>setRoomsOpen(o=>!o)} />
          {roomsOpen && rooms.length === 0 && (
            <div style={{ padding:"0.5rem 1.4rem",fontSize:"0.72rem",color:C.dimmer,fontFamily:font.body }}>
              No rooms yet — join one from the Dashboard.
            </div>
          )}
          {roomsOpen && rooms.map(r=>(
            <Item key={r.id} id={r.id} label={r.displayName || r.name} unread={0} dotColor={r.color || colorForUser(r.name)} />
          ))}

          <div style={{ height:"0.4rem" }} />
          <SectionBtn label="Direct Messages" isOpen={dmsOpen} onToggle={()=>setDmsOpen(o=>!o)} />
          {dmsOpen && dms.length === 0 && (
            <div style={{ padding:"0.5rem 1.4rem",fontSize:"0.72rem",color:C.dimmer,fontFamily:font.body }}>
              No conversations yet — add friends to start chatting.
            </div>
          )}
          {dmsOpen && dms.map(d=>{
            const online = presence[d.user?.id] ?? d.user?.online;
            const isActiveDm = active === `dm:${d.id}`;
            const hasUnread = !isActiveDm && d.lastMessage && !d.lastMessage.fromMe;
            return (
              <Item key={d.id} id={d.id} isDm={true}
                label={d.user?.username || "Unknown"}
                sub={d.lastMessage
                  ? (d.lastMessage.type==="text" ? d.lastMessage.text
                    : d.lastMessage.type==="voice" ? "🎙 Voice message"
                    : "📎 File")
                  : "No messages yet"}
                unread={hasUnread ? 1 : 0}
                dotColor={colorForUser(d.user?.username || "")}
                avatar={d.user?.username || "?"}
                online={online} />
            );
          })}
        </div>

        {/* User strip */}
        <div style={{ padding:"0.65rem 0.9rem",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:"0.6rem",flexShrink:0 }}>
          <Avatar name={currentUser?.username || "?"} size={30} color={C.magenta} online={true} self />
          <div style={{ flex:1,overflow:"hidden" }}>
            <div style={{ fontSize:"0.78rem",fontWeight:600,color:C.white,fontFamily:font.body,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{currentUser?.username || "Loading…"}</div>
            <div style={{ fontSize:"0.6rem",color:C.green,fontFamily:font.mono }}>● {currentUser?.status || "Online"}</div>
          </div>
          <button style={{ background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"0.9rem",padding:2,transition:"color 0.2s" }}
            onMouseEnter={e=>e.currentTarget.style.color=C.white}
            onMouseLeave={e=>e.currentTarget.style.color=C.dimmer}>⚙</button>
        </div>
      </aside>
    </>
  );
}

// ─── MEMBERS PANEL ────────────────────────────────────────────────────
function MembersPanel({ members, open, onClose, currentUser }) {
  const online  = members.filter(m=>m.online);
  const offline = members.filter(m=>!m.online);
  const RoleTag = ({ role }) => {
    const cfg = { admin:{ label:"ADMIN",color:C.gold }, mod:{ label:"MOD",color:C.cyan } };
    const c = cfg[role]; if (!c) return null;
    return <span style={{ fontSize:"0.5rem",letterSpacing:"0.12em",color:c.color,fontFamily:font.mono,background:`${c.color}18`,border:`1px solid ${c.color}44`,borderRadius:2,padding:"1px 5px" }}>{c.label}</span>;
  };
  const Row = ({ m }) => {
    const isSelf = currentUser && String(m.id) === String(currentUser.id);
    return (
      <div style={{ display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.48rem 1rem",transition:"background 0.16s",cursor:"pointer",borderRadius:4 }}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(0,229,255,0.05)"}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <Avatar name={m.username} size={30} color={m.avatarColor || colorForUser(m.username)} online={m.online} self={isSelf} />
        <div style={{ flex:1,overflow:"hidden" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"0.3rem" }}>
            <span style={{ fontSize:"0.78rem",fontWeight:600,color:isSelf?C.magenta:C.white,fontFamily:font.body,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{m.username}{isSelf?" (you)":""}</span>
            <RoleTag role={m.role}/>
          </div>
          <div style={{ fontSize:"0.62rem",color:m.online?C.green:C.dimmer,fontFamily:font.body }}>{m.online?"Online":"Offline"}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {open && <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:29,background:"rgba(0,0,0,0.35)" }} />}
      <aside style={{ width:220,height:"100vh",position:"fixed",right:0,top:0,
        background:C.sidebarBg,borderLeft:`1px solid ${C.border}`,
        backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",
        display:"flex",flexDirection:"column",zIndex:30,
        transform:open?"translateX(0)":"translateX(110%)",
        transition:"transform 0.26s cubic-bezier(.4,0,.2,1)",
        pointerEvents: open ? "auto" : "none" }}>
        <div style={{ height:56,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1rem",borderBottom:`1px solid ${C.border}`,flexShrink:0 }}>
          <span style={{ fontSize:"0.6rem",letterSpacing:"0.18em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase" }}>Members — {members.length}</span>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"1rem",padding:4,lineHeight:1 }}>✕</button>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:"0.4rem 0" }}>
          {online.length>0 && <>
            <div style={{ padding:"0.3rem 1rem 0.3rem",fontSize:"0.58rem",letterSpacing:"0.16em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase" }}>🟢 Online — {online.length}</div>
            {online.map(m=><Row key={m.id} m={m}/>)}
          </>}
          {offline.length>0 && <>
            <div style={{ padding:"0.7rem 1rem 0.3rem",fontSize:"0.58rem",letterSpacing:"0.16em",color:C.dimmer,fontFamily:font.mono,textTransform:"uppercase" }}>⚫ Offline — {offline.length}</div>
            {offline.map(m=><Row key={m.id} m={m}/>)}
          </>}
        </div>
      </aside>
    </>
  );
}

// ─── BLANK STATE ──────────────────────────────────────────────────────
function BlankState({ onPick, rooms, dms }) {
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"1.5rem",padding:"2rem",textAlign:"center" }}>
      <div style={{ width:72,height:72,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,#fff,${C.cyan})`,boxShadow:`0 0 32px ${C.cyan}44, 0 0 64px ${C.cyan}22`,animation:"pulse 2.5s ease-in-out infinite" }} />
      <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 32px ${C.cyan}44,0 0 64px ${C.cyan}22}50%{box-shadow:0 0 48px ${C.cyan}88,0 0 96px ${C.magenta}33}}`}</style>
      <div>
        <h2 style={{ fontFamily:font.display,fontSize:"clamp(1.4rem,4vw,2rem)",fontWeight:900,color:C.white,margin:"0 0 0.5rem",background:`linear-gradient(135deg,#fff,${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>
          Where do you want to go?
        </h2>
        <p style={{ fontFamily:font.body,fontSize:"0.9rem",color:C.dim,lineHeight:1.6,maxWidth:380,margin:"0 auto" }}>
          Pick a room to join the conversation, or open a direct message to chat with a friend.
        </p>
      </div>
      {(rooms.length > 0 || dms.length > 0) ? (
        <div style={{ display:"flex",gap:"0.8rem",flexWrap:"wrap",justifyContent:"center" }}>
          {rooms.slice(0,3).map(r=>{
            const color = r.color || colorForUser(r.name);
            return (
              <button key={r.id} onClick={()=>onPick(r.id)} style={{ display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.55rem 1.1rem",background:`${color}11`,border:`1px solid ${color}44`,borderRadius:20,cursor:"pointer",color,fontFamily:font.mono,fontSize:"0.72rem",letterSpacing:"0.08em",transition:"all 0.18s" }}
                onMouseEnter={e=>{e.currentTarget.style.background=`${color}22`;e.currentTarget.style.borderColor=color;}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${color}11`;e.currentTarget.style.borderColor=`${color}44`;}}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:color,display:"inline-block" }} />#{r.displayName || r.name}
              </button>
            );
          })}
          {dms.slice(0,2).map(d=>{
            const color = colorForUser(d.user.username);
            return (
              <button key={d.id} onClick={()=>onPick(`dm:${d.id}`)} style={{ display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.55rem 1.1rem",background:`${color}11`,border:`1px solid ${color}44`,borderRadius:20,cursor:"pointer",color,fontFamily:font.mono,fontSize:"0.72rem",letterSpacing:"0.08em",transition:"all 0.18s" }}
                onMouseEnter={e=>{e.currentTarget.style.background=`${color}22`;e.currentTarget.style.borderColor=color;}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${color}11`;e.currentTarget.style.borderColor=`${color}44`;}}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:d.user.online?C.green:"rgba(255,255,255,0.2)",display:"inline-block" }} />{d.user.username}
              </button>
            );
          })}
        </div>
      ) : (
        <p style={{ fontFamily:font.mono,fontSize:"0.75rem",color:C.dimmer,letterSpacing:"0.06em" }}>
          No rooms or conversations yet — join a room or add a friend from the Dashboard.
        </p>
      )}
    </div>
  );
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────
// ─── VOICE MESSAGE PLAYER ──────────────────────────────────────────────
function VoiceBubble({ url, duration, isSelf }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [curTime, setCurTime] = useState(0);
  const [err, setErr] = useState(false);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); }
    else { audio.play().catch(()=>setErr(true)); }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setProgress(0); setCurTime(0); };
    const onTime = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
        setCurTime(audio.currentTime);
      }
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTime);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTime);
    };
  }, [url]);

  const fmt = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;

  if (!url) {
    return <span style={{ fontSize:"0.75rem", color:C.red, fontFamily:font.body }}>Voice note failed to upload</span>;
  }

  return (
    <div style={{ display:"flex",alignItems:"center",gap:"0.6rem",minWidth:190 }}>
      <audio ref={audioRef} src={url} preload="metadata" onError={()=>setErr(true)} style={{ display:"none" }}/>
      <button onClick={toggle} disabled={err} style={{ width:30,height:30,borderRadius:"50%",flexShrink:0,background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",cursor:err?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",opacity:err?0.4:1 }}>
        {playing ? "❚❚" : "▶"}
      </button>
      <div style={{ flex:1,height:4,background:"rgba(255,255,255,0.12)",borderRadius:2,overflow:"hidden",cursor:"pointer" }}
        onClick={(e)=>{
          const audio = audioRef.current;
          if (!audio?.duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          audio.currentTime = pct * audio.duration;
        }}>
        <div style={{ height:"100%",width:`${progress*100}%`,background:isSelf?C.magenta:C.cyan,transition:"width 0.1s linear" }}/>
      </div>
      <span style={{ fontSize:"0.65rem",color:C.dimmer,fontFamily:font.mono,flexShrink:0,minWidth:32,textAlign:"right" }}>
        {err ? "⚠" : playing||curTime>0 ? fmt(curTime) : fmt(duration||0)}
      </span>
    </div>
  );
}

function MessageBubble({ msg, onReact, onReply, prevAuthor, currentUserId }) {
  const [hover, setHover] = useState(false);
  const isSelf = !!msg.self;
  const showHeader = prevAuthor !== msg.author;

  return (
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ display:"flex",flexDirection:"column",alignItems:isSelf?"flex-end":"flex-start",padding:"0.12rem 1.2rem",position:"relative" }}>

      {msg.replyTo && (
        <div style={{ display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.12rem",padding:"0.25rem 0.6rem",background:"rgba(0,229,255,0.06)",borderRadius:3,borderLeft:`2px solid ${C.cyan}`,maxWidth:"70%" }}>
          <span style={{ fontSize:"0.68rem",color:C.dim,fontFamily:font.body,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>↩ {msg.replyTo}</span>
        </div>
      )}

      <div style={{ display:"flex",alignItems:"flex-end",gap:"0.55rem",flexDirection:isSelf?"row-reverse":"row",maxWidth:"76%" }}>
        {showHeader ? <Avatar name={msg.author} size={30} color={msg.color} self={isSelf}/> : <div style={{ width:30,flexShrink:0 }}/>}
        <div>
          {showHeader && (
            <div style={{ display:"flex",alignItems:"baseline",gap:"0.45rem",marginBottom:"0.18rem",flexDirection:isSelf?"row-reverse":"row" }}>
              <span style={{ fontSize:"0.76rem",fontWeight:700,color:isSelf?C.magenta:msg.color,fontFamily:font.body }}>{msg.author}</span>
              <span style={{ fontSize:"0.6rem",color:C.dimmer,fontFamily:font.mono }}>{msg.time}</span>
            </div>
          )}
          <div style={{
            background: isSelf ? "rgba(255,44,247,0.18)" : "rgba(6,0,20,0.62)",
            backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)",
            border:`1px solid ${isSelf?"rgba(255,44,247,0.32)":"rgba(0,229,255,0.18)"}`,
            borderRadius:isSelf?"14px 4px 14px 14px":"4px 14px 14px 14px",
            padding: msg.type==="voice" ? "0.5rem 0.85rem" : msg.type==="file" ? "0.6rem 0.85rem" : "0.62rem 0.95rem",
            boxShadow: isSelf
              ? "0 4px 20px rgba(255,44,247,0.15), inset 0 1px 0 rgba(255,255,255,0.06)"
              : "0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}>
            {msg.type === "voice" ? (
              <VoiceBubble url={msg.fileUrl} duration={msg.duration} isSelf={isSelf}/>
            ) : msg.type === "image" ? (
              msg.fileUrl ? (
                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display:"block" }}>
                  <img src={msg.fileUrl} alt={msg.fileName||"image"} loading="lazy"
                    style={{ maxWidth:240, maxHeight:240, borderRadius:6, display:"block", border:`1px solid ${C.border}` }}/>
                </a>
              ) : (
                <span style={{ fontSize:"0.75rem", color:C.red, fontFamily:font.body }}>Image failed to load</span>
              )
            ) : msg.type === "file" ? (
              msg.fileUrl ? (
                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" download={msg.fileName}
                  style={{ display:"flex",alignItems:"center",gap:"0.7rem",minWidth:170,textDecoration:"none" }}>
                  <div style={{ width:34,height:34,borderRadius:6,background:"rgba(0,229,255,0.12)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem",flexShrink:0 }}>📄</div>
                  <div style={{ flex:1,overflow:"hidden" }}>
                    <div style={{ fontSize:"0.78rem",color:C.white,fontFamily:font.body,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{msg.fileName}</div>
                    <div style={{ fontSize:"0.62rem",color:C.dimmer,fontFamily:font.mono }}>{((msg.fileSize||0)/1024).toFixed(1)} KB</div>
                  </div>
                  <span style={{ fontSize:"0.85rem",color:C.cyan,flexShrink:0 }}>⬇</span>
                </a>
              ) : (
                <span style={{ fontSize:"0.75rem", color:C.red, fontFamily:font.body }}>File failed to upload</span>
              )
            ) : (
              <p style={{ margin:0,fontSize:"0.87rem",color:C.white,fontFamily:font.body,lineHeight:1.55,whiteSpace:"pre-wrap",wordBreak:"break-word" }}>{msg.text}</p>
            )}
          </div>
          {Object.keys(msg.reactions).length>0 && (
            <div style={{ display:"flex",flexWrap:"wrap",gap:"0.28rem",marginTop:"0.3rem",justifyContent:isSelf?"flex-end":"flex-start" }}>
              {Object.entries(msg.reactions).map(([emoji,users])=>{
                const userIds = users.map(u=>String(u));
                const reacted = userIds.includes(String(currentUserId));
                return (
                  <button key={emoji} onClick={()=>onReact(msg.id,emoji)} style={{ display:"flex",alignItems:"center",gap:"0.26rem",padding:"0.16rem 0.5rem",borderRadius:10,cursor:"pointer",background:reacted?"rgba(0,229,255,0.18)":"rgba(255,255,255,0.06)",border:`1px solid ${reacted?C.cyan:"rgba(255,255,255,0.1)"}`,transition:"all 0.16s",fontSize:"0.75rem" }}>
                    <span>{emoji}</span><span style={{ fontSize:"0.62rem",color:C.dim,fontFamily:font.mono }}>{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {hover && (
        <div style={{ position:"absolute",top:-20,right:isSelf?"1.2rem":"auto",left:isSelf?"auto":"3.6rem",display:"flex",gap:"0.22rem",background:C.sidebarBg,border:`1px solid ${C.border}`,borderRadius:6,padding:"0.2rem 0.35rem",zIndex:10,boxShadow:"0 4px 16px rgba(0,0,0,0.5)" }}>
          {REACTIONS_SET.map(r=>(
            <button key={r} onClick={()=>onReact(msg.id,r)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:"0.82rem",padding:"0 2px",lineHeight:1,transition:"transform 0.12s" }}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.4)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>{r}</button>
          ))}
          <div style={{ width:1,background:C.border,margin:"0 2px" }}/>
          <button onClick={()=>onReply(msg)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:"0.72rem",color:C.dim,fontFamily:font.mono,padding:"0 4px",letterSpacing:"0.05em" }}
            onMouseEnter={e=>e.currentTarget.style.color=C.white}
            onMouseLeave={e=>e.currentTarget.style.color=C.dim}>↩</button>
        </div>
      )}
    </div>
  );
}

// ─── TYPING INDICATOR ─────────────────────────────────────────────────
function TypingIndicator({ name }) {
  return (
    <div style={{ padding:"0.25rem 1.2rem 0.4rem",display:"flex",alignItems:"center",gap:"0.5rem" }}>
      <div style={{ display:"flex",gap:"3px",alignItems:"center" }}>
        {[0,1,2].map(i=><span key={i} style={{ width:5,height:5,borderRadius:"50%",background:C.cyan,display:"inline-block",animation:`tdot 1.1s ease-in-out ${i*0.18}s infinite`,opacity:0.7 }}/>)}
      </div>
      <span style={{ fontSize:"0.7rem",color:C.dimmer,fontFamily:font.body }}>{name} is typing…</span>
      <style>{`@keyframes tdot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

// ─── MESSAGE INPUT ────────────────────────────────────────────────────
function MessageInput({ channelLabel, onSend, replyTo, clearReply, isMobile, onTyping }) {
  const [text, setText]         = useState("");
  const [emoji, setEmoji]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const ref        = useRef(null);
  const fileRef    = useRef(null);
  const mediaRef   = useRef(null); // MediaRecorder instance
  const chunksRef  = useRef([]);
  const timerRef   = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://voidsync-rnvm.onrender.com";

  const send = () => {
    if (!text.trim()) return;
    onSend({ type:"text", text: text.trim() });
    setText(""); clearReply(); setEmoji(false);
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault(); send();
    }
  };

  // ── Upload a file to /api/upload then send as message ──────────────
  const uploadAndSend = async (file) => {
    setUploading(true); setUploadErr(null);
    try {
      const token = localStorage.getItem("voidsync_token");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onSend({ type: data.type, fileUrl: data.url, fileName: data.fileName, fileSize: data.fileSize });
    } catch (err) {
      setUploadErr(err.message);
      setTimeout(() => setUploadErr(null), 4000);
    } finally {
      setUploading(false);
    }
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadAndSend(file);
    e.target.value = "";
  };

  // ── Voice recording ────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        uploadAndSend(file);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setRecordSecs(0);
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch {
      setUploadErr("Microphone access denied");
      setTimeout(() => setUploadErr(null), 3000);
    }
  };

  const stopRecording = (send_ = true) => {
    clearInterval(timerRef.current);
    setRecording(false); setRecordSecs(0);
    if (!send_) { chunksRef.current = []; mediaRef.current?.stream?.getTracks().forEach(t=>t.stop()); return; }
    mediaRef.current?.stop();
  };

  const fmtSecs = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{ padding:"0.7rem 1rem 0.9rem",flexShrink:0,position:"relative" }}>
      {/* Hidden file input */}
      <input ref={fileRef} type="file" onChange={handleFilePick} style={{ display:"none" }}
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" />

      {replyTo && (
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.35rem 0.75rem",marginBottom:"0.35rem",background:"rgba(0,229,255,0.07)",border:`1px solid rgba(0,229,255,0.2)`,borderRadius:4,borderLeft:`3px solid ${C.cyan}` }}>
          <span style={{ fontSize:"0.7rem",color:C.dim,fontFamily:font.body }}><span style={{ color:C.cyan }}>↩ {replyTo.author}:</span> {replyTo.text?.slice(0,55)}{(replyTo.text?.length||0)>55?"…":""}</span>
          <button onClick={clearReply} style={{ background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"0.8rem",padding:0,lineHeight:1 }}>✕</button>
        </div>
      )}

      {uploadErr && (
        <div style={{ padding:"0.3rem 0.75rem",marginBottom:"0.35rem",background:"rgba(255,95,126,0.1)",border:`1px solid rgba(255,95,126,0.3)`,borderRadius:4,fontSize:"0.72rem",color:C.red,fontFamily:font.body }}>
          {uploadErr}
        </div>
      )}

      {recording ? (
        // ── Recording UI ────────────────────────────────────────────
        <div style={{ display:"flex",alignItems:"center",gap:"0.7rem",background:"rgba(255,44,247,0.08)",border:`1px solid rgba(255,44,247,0.35)`,borderRadius:8,padding:"0.55rem 0.9rem" }}>
          <span style={{ width:10,height:10,borderRadius:"50%",background:C.magenta,display:"inline-block",animation:"recpulse 1s ease-in-out infinite",flexShrink:0 }}/>
          <style>{`@keyframes recpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.8)}}`}</style>
          <span style={{ fontFamily:font.mono,fontSize:"0.85rem",color:C.white,letterSpacing:"0.05em" }}>{fmtSecs(recordSecs)}</span>
          <span style={{ flex:1,fontSize:"0.78rem",color:C.dim,fontFamily:font.body }}>Recording voice note…</span>
          <button onClick={()=>stopRecording(false)} style={{ background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.dim,fontFamily:font.mono,fontSize:"0.7rem",padding:"0.35rem 0.8rem",borderRadius:4,cursor:"pointer" }}>Cancel</button>
          <button onClick={()=>stopRecording(true)} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontWeight:700,fontFamily:font.mono,fontSize:"0.7rem",padding:"0.35rem 0.9rem",borderRadius:4,cursor:"pointer" }}>
            {uploading ? "Uploading…" : "Send ▶"}
          </button>
        </div>
      ) : (
        // ── Normal input UI ─────────────────────────────────────────
        <div style={{ display:"flex",alignItems:"flex-end",gap:"0.4rem",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:8,padding:"0.45rem 0.55rem" }}>
          <button onClick={()=>setEmoji(o=>!o)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:"1.05rem",padding:"0.18rem",lineHeight:1,flexShrink:0,opacity:emoji?1:0.45,transition:"opacity 0.2s" }}>✦</button>

          <textarea ref={ref} value={text} onChange={e=>{ setText(e.target.value); onTyping?.(); }} onKeyDown={onKey}
            placeholder={uploading ? "Uploading…" : `Message ${channelLabel}`} rows={1} disabled={uploading}
            style={{ flex:1,background:"none",border:"none",outline:"none",color:C.white,fontFamily:font.body,fontSize:"0.87rem",resize:"none",lineHeight:1.5,padding:"0.12rem 0",maxHeight:110,overflowY:"auto",scrollbarWidth:"none",opacity:uploading?0.5:1 }}/>

          {/* File attach */}
          <button onClick={()=>fileRef.current?.click()} disabled={uploading} title="Attach file"
            style={{ background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"1rem",padding:"0.18rem",lineHeight:1,flexShrink:0,transition:"color 0.2s",opacity:uploading?0.4:1 }}
            onMouseEnter={e=>e.currentTarget.style.color=C.cyan}
            onMouseLeave={e=>e.currentTarget.style.color=C.dimmer}>⊕</button>

          {/* Voice note OR send */}
          {text.trim() ? (
            <button onClick={send} disabled={uploading} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",cursor:"pointer",width:30,height:30,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:"0.8rem",transition:"all 0.18s",boxShadow:`0 0 10px rgba(0,229,255,0.3)`,opacity:uploading?0.5:1 }}>▶</button>
          ) : (
            <button onMouseDown={startRecording} title="Hold to record voice note" disabled={uploading}
              style={{ background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,cursor:"pointer",width:30,height:30,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:C.dim,fontSize:"0.85rem",transition:"all 0.18s",opacity:uploading?0.4:1 }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.magenta;e.currentTarget.style.color=C.magenta;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>🎙</button>
          )}
        </div>
      )}

      {emoji && (
        <div style={{ position:"absolute",bottom:"calc(100% + 0.25rem)",left:"1rem",background:C.sidebarBg,border:`1px solid ${C.border}`,borderRadius:8,padding:"0.55rem",display:"flex",gap:"0.35rem",flexWrap:"wrap",maxWidth:190,zIndex:20,boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
          {["✦","⚡","🔥","💜","👾","🚀","🌌","⬡","◎","◈","▲","✕"].map(e=>(
            <button key={e} onClick={()=>{ setText(t=>t+e); setEmoji(false); ref.current?.focus(); }} style={{ background:"none",border:"none",cursor:"pointer",fontSize:"1.05rem",padding:"0.2rem",borderRadius:4,transition:"background 0.14s" }}
              onMouseEnter={e2=>e2.currentTarget.style.background="rgba(0,229,255,0.12)"}
              onMouseLeave={e2=>e2.currentTarget.style.background="none"}>{e}</button>
          ))}
        </div>
      )}

      {!isMobile && (
        <div style={{ marginTop:"0.3rem",fontSize:"0.6rem",color:C.dimmer,fontFamily:font.mono,letterSpacing:"0.05em",paddingLeft:"0.3rem" }}>
          Enter to send · Shift+Enter for new line · ⊕ attach file · 🎙 hold for voice note
        </div>
      )}
    </div>
  );
}

// ─── INVITE MODAL ─────────────────────────────────────────────────────
function InviteModal({ roomId, roomLabel, onClose }) {
  const [tab, setTab] = useState("link"); // "link" | "username"
  const [inviteCode, setInviteCode] = useState(null);
  const [loadingCode, setLoadingCode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);

  useEffect(() => {
    api.get(`/api/rooms/${roomId}/invite-code`)
      .then(({ inviteCode }) => setInviteCode(inviteCode))
      .catch(() => setInviteCode(null))
      .finally(() => setLoadingCode(false));
  }, [roomId]);

  const inviteLink = inviteCode ? `${window.location.origin}/join/${inviteCode}` : "";

  const copyLink = () => {
    navigator.clipboard?.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const { inviteCode } = await api.post(`/api/rooms/${roomId}/invite-code/regenerate`);
      setInviteCode(inviteCode);
    } catch (err) {
      alert(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const sendInvite = async () => {
    if (!username.trim()) return;
    setSending(true); setInviteMsg(null);
    try {
      const res = await api.post(`/api/rooms/${roomId}/invite`, { username: username.trim() });
      setInviteMsg({ ok: true, text: res.message });
      setUsername("");
    } catch (err) {
      setInviteMsg({ ok: false, text: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%",maxWidth:420,background:C.sidebarBg,border:`1px solid ${C.border}`,borderRadius:8,padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem" }}>
          <h3 style={{ fontFamily:font.display,fontSize:"1.1rem",fontWeight:900,margin:0,
            background:`linear-gradient(135deg,#fff,${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>
            ＋ Invite to {roomLabel}
          </h3>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:C.dimmer,fontSize:"1.1rem",padding:4,lineHeight:1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",gap:"0.4rem",marginBottom:"1.2rem" }}>
          {[["link","🔗 Invite Link"],["username","◎ By Username"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ flex:1,padding:"0.5rem",borderRadius:4,border:`1px solid ${tab===id?C.cyan:C.border}`,background:tab===id?"rgba(0,229,255,0.1)":"transparent",color:tab===id?C.cyan:C.dim,fontSize:"0.75rem",fontFamily:font.mono,cursor:"pointer",letterSpacing:"0.05em",transition:"all 0.15s" }}>{label}</button>
          ))}
        </div>

        {tab === "link" ? (
          <div>
            <p style={{ fontSize:"0.78rem",color:C.dim,fontFamily:font.body,lineHeight:1.6,marginTop:0,marginBottom:"1rem" }}>
              Anyone with this link can join the room — even if it's private.
            </p>
            {loadingCode ? (
              <div style={{ fontSize:"0.78rem",color:C.dimmer,fontFamily:font.mono,padding:"0.6rem 0" }}>Loading invite link…</div>
            ) : inviteCode ? (
              <>
                <div style={{ display:"flex",gap:"0.5rem",marginBottom:"0.8rem" }}>
                  <input readOnly value={inviteLink} onClick={e=>e.target.select()}
                    style={{ flex:1,boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:4,color:C.white,fontSize:"0.78rem",fontFamily:font.mono,padding:"0.6rem 0.8rem",outline:"none" }}/>
                  <button onClick={copyLink} style={{ background:copied?`linear-gradient(135deg,${C.cyan},${C.magenta})`:"rgba(255,255,255,0.06)",border:`1px solid ${copied?"transparent":C.border}`,color:copied?"#000":C.dim,fontFamily:font.display,fontWeight:900,fontSize:"0.7rem",letterSpacing:"0.06em",textTransform:"uppercase",padding:"0 1rem",borderRadius:4,cursor:"pointer",whiteSpace:"nowrap" }}>
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <button onClick={regenerate} disabled={regenerating} style={{ background:"none",border:"none",color:C.dimmer,fontSize:"0.7rem",fontFamily:font.mono,letterSpacing:"0.06em",cursor:"pointer",padding:0,opacity:regenerating?0.5:1 }}
                  onMouseEnter={e=>e.currentTarget.style.color=C.red}
                  onMouseLeave={e=>e.currentTarget.style.color=C.dimmer}>
                  {regenerating ? "Regenerating…" : "↻ Regenerate link (invalidates old one)"}
                </button>
              </>
            ) : (
              <div style={{ fontSize:"0.78rem",color:C.red,fontFamily:font.body }}>Couldn't load invite link.</div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize:"0.78rem",color:C.dim,fontFamily:font.body,lineHeight:1.6,marginTop:0,marginBottom:"1rem" }}>
              Add someone directly by their VoidSync username.
            </p>
            <div style={{ display:"flex",gap:"0.5rem" }}>
              <input value={username} onChange={e=>{ setUsername(e.target.value); setInviteMsg(null); }}
                onKeyDown={e=>e.key==="Enter"&&sendInvite()}
                placeholder="username"
                style={{ flex:1,boxSizing:"border-box",background:C.inputBg,border:`1px solid ${C.border}`,borderRadius:4,color:C.white,fontSize:"0.85rem",fontFamily:font.body,padding:"0.6rem 0.8rem",outline:"none" }}/>
              <button onClick={sendInvite} disabled={sending||!username.trim()} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontFamily:font.display,fontWeight:900,fontSize:"0.7rem",letterSpacing:"0.06em",textTransform:"uppercase",padding:"0 1.2rem",borderRadius:4,cursor:"pointer",opacity:(sending||!username.trim())?0.6:1,whiteSpace:"nowrap" }}>
                {sending ? "…" : "Invite"}
              </button>
            </div>
            {inviteMsg && (
              <div style={{ marginTop:"0.7rem",fontSize:"0.78rem",color:inviteMsg.ok?C.green:C.red,fontFamily:font.body }}>{inviteMsg.text}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────
export default function Chat({ initialTarget, onBack }) {
  const { isMobile, isTablet } = useBreakpoint();
  const [active, setActive] = useState(() => {
    if (!initialTarget) return null;
    return initialTarget.type === "dm" ? `dm:${initialTarget.id}` : initialTarget.id;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false); // CLOSED by default
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [replyTo, setReplyTo]         = useState(null);
  const [typingUser, setTypingUser]   = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [rooms, setRooms]             = useState([]);
  const [dms, setDms]                 = useState([]);
  const [presence, setPresence]       = useState({}); // userId -> boolean online
  const [members, setMembers]         = useState([]);
  const [messages, setMessages]       = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const bottomRef = useRef(null);
  const showSidebarFixed = !isMobile && !isTablet;
  const typingTimeoutRef = useRef(null);

  // Resolve active conversation metadata
  const isDm = typeof active === "string" && active.startsWith("dm:");
  const activeRoomId = !isDm ? active : null;
  const activeConvoId = isDm ? active.slice(3) : null;
  const activeRoom = rooms.find(r=>r.id===activeRoomId);
  const activeDm   = dms.find(d=>d.id===activeConvoId);
  const channelLabel = activeRoom ? `#${activeRoom.displayName || activeRoom.name}` : activeDm ? activeDm.user.username : "";

  // ── Initial load: current user, rooms, DMs ─────────────────────────
  useEffect(() => {
    api.get("/api/auth/me").then(({ user }) => setCurrentUser(user)).catch(()=>{});
    api.get("/api/rooms").then(({ rooms }) => setRooms(rooms)).catch(()=>{});
    api.get("/api/dms").then(({ conversations }) => setDms(conversations)).catch(()=>{});
  }, []);

  // Keep a ref to currentUser.id for use inside socket callbacks
  // (avoids stale-closure issues without re-binding listeners constantly)
  const currentUserIdRef = useRef(null);
  useEffect(() => { currentUserIdRef.current = currentUser?.id; }, [currentUser]);

  // ── Refs for active conversation (avoid stale closures in socket listeners) ──
  const activeRoomIdRef  = useRef(null);
  const activeConvoIdRef = useRef(null);
  useEffect(() => { activeRoomIdRef.current  = activeRoomId;  }, [activeRoomId]);
  useEffect(() => { activeConvoIdRef.current = activeConvoId; }, [activeConvoId]);

  // ── Socket.IO setup — register ONCE, use refs inside handlers ────────
  useEffect(() => {
    const socket = getSocket();

    const onPresence = ({ userId, status }) => {
      setPresence(prev => ({ ...prev, [userId]: status === "online" }));
      // Also update current user's own status dot
      if (String(userId) === String(currentUserIdRef.current)) {
        setCurrentUser(u => u ? { ...u, status } : u);
      }
    };

    const onMessageNew = (msg) => {
      const rid = activeRoomIdRef.current;
      if (!rid || String(msg.room) !== String(rid)) return;
      setMessages(prev => {
        const msgId = String(msg.id || msg._id);
        if (prev.some(m => String(m.id) === msgId)) return prev;
        return [...prev, mapMessage(msg, currentUserIdRef.current)];
      });
    };

    const onMessageReaction = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => String(m.id)===String(messageId) ? { ...m, reactions } : m));
    };

    const onDmNew = ({ conversationId, message }) => {
      const cid = activeConvoIdRef.current;
      if (cid && String(conversationId) === String(cid)) {
        setMessages(prev => {
          const msgId = String(message.id || message._id);
          if (prev.some(m => String(m.id) === msgId)) return prev;
          return [...prev, mapMessage(message, currentUserIdRef.current)];
        });
      }
      api.get("/api/dms").then(({ conversations }) => setDms(conversations)).catch(()=>{});
    };

    const onDmReaction = ({ conversationId, messageId, reactions }) => {
      if (String(conversationId) !== String(activeConvoIdRef.current)) return;
      setMessages(prev => prev.map(m => String(m.id)===String(messageId) ? { ...m, reactions } : m));
    };

    const onTypingStart = ({ userId, username, roomId, conversationId }) => {
      const matches = (roomId && String(roomId)===String(activeRoomIdRef.current))
                   || (conversationId && String(conversationId)===String(activeConvoIdRef.current));
      if (matches && String(userId) !== String(currentUserIdRef.current)) {
        setTypingUser(username);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(()=>setTypingUser(null), 4000);
      }
    };

    const onTypingStop = ({ roomId, conversationId }) => {
      const matches = (roomId && String(roomId)===String(activeRoomIdRef.current))
                   || (conversationId && String(conversationId)===String(activeConvoIdRef.current));
      if (matches) setTypingUser(null);
    };

    socket.on("presence:update",  onPresence);
    socket.on("message:new",      onMessageNew);
    socket.on("message:reaction", onMessageReaction);
    socket.on("dm:new",           onDmNew);
    socket.on("dm:reaction",      onDmReaction);
    socket.on("typing:start",     onTypingStart);
    socket.on("typing:stop",      onTypingStop);

    return () => {
      socket.off("presence:update",  onPresence);
      socket.off("message:new",      onMessageNew);
      socket.off("message:reaction", onMessageReaction);
      socket.off("dm:new",           onDmNew);
      socket.off("dm:reaction",      onDmReaction);
      socket.off("typing:start",     onTypingStart);
      socket.off("typing:stop",      onTypingStop);
    };
  }, []); // ← empty deps: register once, refs keep values current

  // ── Load messages + members when switching conversations ───────────
  useEffect(() => {
    if (!active) { setMessages([]); setMembers([]); return; }
    setLoadingMsgs(true);
    setTypingUser(null);

    const socket = getSocket();

    if (isDm) {
      api.get(`/api/dms/${activeConvoId}/messages`)
        .then(({ messages }) => setMessages(messages.map(m=>mapMessage(m, currentUser?.id))))
        .catch(()=>setMessages([]))
        .finally(()=>setLoadingMsgs(false));
      setMembers([]);
    } else {
      socket.emit("room:join", activeRoomId);
      Promise.all([
        api.get(`/api/rooms/${activeRoomId}/messages`),
        api.get(`/api/rooms/${activeRoomId}/members`),
      ])
        .then(([msgRes, memRes]) => {
          setMessages(msgRes.messages.map(m=>mapMessage(m, currentUser?.id)));
          setMembers(memRes.members);
        })
        .catch(()=>{ setMessages([]); setMembers([]); })
        .finally(()=>setLoadingMsgs(false));

      return () => { socket.emit("room:leave", activeRoomId); };
    }
  }, [active, currentUser?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages.length, active]);

  const handleSetActive = (id) => {
    setActive(id);
    setMembersOpen(false);
    setReplyTo(null);
  };

  // ── Send message ─────────────────────────────────────────────────
  const handleSend = useCallback(async (payload) => {
    const endpoint = isDm
      ? `/api/dms/${activeConvoId}/messages`
      : `/api/rooms/${activeRoomId}/messages`;
    try {
      const body = { type: payload.type };
      if (payload.type === "text") {
        body.text = payload.text;
        if (replyTo?.id) body.replyTo = replyTo.id;
      } else {
        body.fileUrl  = payload.fileUrl;
        body.fileName = payload.fileName;
        body.fileSize = payload.fileSize;
        if (payload.type === "voice") body.duration = payload.duration || 0;
      }
      // Don't add optimistically — the socket "message:new" / "dm:new" event
      // will deliver it back to us, which is the single source of truth.
      // This prevents double-rendering when StrictMode fires effects twice.
      await api.post(endpoint, body);
      if (isDm) api.get("/api/dms").then(({ conversations }) => setDms(conversations)).catch(()=>{});
      setReplyTo(null);
    } catch (err) {
      alert(err.message);
    }
  }, [active, isDm, activeRoomId, activeConvoId, replyTo]);

  // ── React to message ─────────────────────────────────────────────
  const handleReact = useCallback(async (msgId, emoji) => {
    const endpoint = isDm
      ? `/api/dms/${activeConvoId}/messages/${msgId}/react`
      : `/api/rooms/${activeRoomId}/messages/${msgId}/react`;
    try {
      const { reactions } = await api.post(endpoint, { emoji });
      setMessages(prev => prev.map(m => String(m.id)===String(msgId) ? { ...m, reactions } : m));
    } catch (err) {
      alert(err.message);
    }
  }, [active, isDm, activeRoomId, activeConvoId]);

  // ── Typing indicator emit ───────────────────────────────────────────
  const handleTyping = useCallback(() => {
    const socket = getSocket();
    if (isDm) {
      socket.emit("typing:start", { recipientId: activeDm?.user?.id, conversationId: activeConvoId });
    } else {
      socket.emit("typing:start", { roomId: activeRoomId });
    }
  }, [isDm, activeConvoId, activeRoomId, activeDm]);

  return (
    <div style={{ display:"flex",height:"100vh",overflow:"hidden",background:C.void,color:C.white,fontFamily:font.body,position:"relative" }}>
      <LiquidBg/>

      {/* Left sidebar */}
      <LeftSidebar active={active} setActive={handleSetActive} open={showSidebarFixed||sidebarOpen}
        onClose={()=>setSidebarOpen(false)} isFixed={showSidebarFixed}
        rooms={rooms} dms={dms} currentUser={currentUser} presence={presence}/>

      {/* Main */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",height:"100vh",position:"relative",zIndex:10,marginLeft:showSidebarFixed?240:0,transition:"margin 0.26s" }}>

        {/* Top bar */}
        <header style={{ height:56,display:"flex",alignItems:"center",gap:"0.7rem",padding:"0 1rem",borderBottom:`1px solid ${C.border}`,background:"rgba(4,0,13,0.8)",backdropFilter:"blur(12px)",flexShrink:0,zIndex:10 }}>
          {onBack && (
            <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:C.dim,fontSize:"0.85rem",fontFamily:font.mono,padding:"0.2rem 0.5rem",letterSpacing:"0.06em",transition:"color 0.2s",flexShrink:0 }}
              onMouseEnter={e=>e.currentTarget.style.color=C.white}
              onMouseLeave={e=>e.currentTarget.style.color=C.dim}>← Dashboard</button>
          )}
          {!showSidebarFixed && (
            <button onClick={()=>setSidebarOpen(true)} style={{ background:"none",border:"none",cursor:"pointer",color:C.dim,fontSize:"1.2rem",padding:"0.2rem",lineHeight:1 }}>☰</button>
          )}
          {active ? (
            <>
              <span style={{ fontFamily:font.mono,fontSize:"1rem",color:isDm?colorForUser(activeDm?.user?.username):C.cyan }}>{isDm?activeDm?.user?.username?.[0]:"#"}</span>
              <span style={{ fontFamily:font.display,fontSize:"0.92rem",fontWeight:900,color:C.white }}>{isDm?activeDm?.user?.username:(activeRoom?.displayName||activeRoom?.name)}</span>
              {!isMobile && activeRoom && <span style={{ fontSize:"0.72rem",color:C.dimmer,fontFamily:font.body }}>— {activeRoom.description || "No description"}</span>}
              <div style={{ marginLeft:"auto",display:"flex",gap:"0.4rem",alignItems:"center" }}>
                {!isDm && [
                  { icon:"◉",label:"Voice",color:C.green },
                  { icon:"▶",label:"Video",color:C.cyan  },
                ].map(({icon,label,color})=>(
                  <button key={label} onClick={()=>alert(`${label} channels aren't wired up to the backend yet — coming soon!`)} style={{ display:"flex",alignItems:"center",gap:"0.3rem",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.dim,fontFamily:font.mono,fontSize:"0.68rem",letterSpacing:"0.08em",padding:"0.28rem 0.6rem",borderRadius:4,cursor:"pointer",transition:"all 0.18s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.color=color;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
                    <span>{icon}</span>{!isMobile&&label}
                  </button>
                ))}
                {!isDm && (
                  <button onClick={()=>setShowInviteModal(true)} style={{ display:"flex",alignItems:"center",gap:"0.3rem",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.dim,fontFamily:font.mono,fontSize:"0.68rem",letterSpacing:"0.08em",padding:"0.28rem 0.6rem",borderRadius:4,cursor:"pointer",transition:"all 0.18s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.magenta;e.currentTarget.style.color=C.magenta;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
                    <span>＋</span>{!isMobile&&"Invite"}
                  </button>
                )}
                {!isDm && (
                  <button onClick={()=>setMembersOpen(o=>!o)} style={{ display:"flex",alignItems:"center",gap:"0.28rem",background:membersOpen?"rgba(0,229,255,0.1)":"rgba(255,255,255,0.05)",border:`1px solid ${membersOpen?C.cyan:C.border}`,color:membersOpen?C.cyan:C.dim,fontFamily:font.mono,fontSize:"0.68rem",letterSpacing:"0.08em",padding:"0.28rem 0.6rem",borderRadius:4,cursor:"pointer",transition:"all 0.18s" }}>
                    <span>◎</span>{!isMobile&&"Members"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{ display:"flex",alignItems:"center",gap:"0.5rem" }}>
              <div style={{ width:22,height:22,borderRadius:"50%",background:`radial-gradient(circle at 35% 35%,#fff,${C.cyan})`,boxShadow:`0 0 8px ${C.cyan}` }}/>
              <span style={{ fontFamily:font.display,fontSize:"0.95rem",fontWeight:900,background:`linear-gradient(135deg,#fff,${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>VoidSync</span>
            </div>
          )}
        </header>

        {/* Content */}
        {!active ? (
          <BlankState onPick={handleSetActive} rooms={rooms} dms={dms}/>
        ) : (
          <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>
            <div style={{ flex:1,overflowY:"auto",padding:"0.8rem 0",scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent`,minHeight:0 }}>
              {loadingMsgs ? (
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%" }}>
                  <div style={{ width:28,height:28,border:`2px solid ${C.cyan}`,borderTopColor:"transparent",borderRadius:"50%",animation:"chatspin 0.8s linear infinite" }}/>
                  <style>{`@keyframes chatspin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : messages.length===0 ? (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:"0.8rem",opacity:0.55 }}>
                  <span style={{ fontSize:"2rem" }}>{isDm?"💬":"⬡"}</span>
                  <span style={{ fontFamily:font.body,fontSize:"0.88rem",color:C.dim }}>{isDm?`Start a conversation with ${activeDm?.user?.username}`:`Be the first to say something in #${activeRoom?.displayName||activeRoom?.name}`}</span>
                </div>
              ) : (
                <>
                  <div style={{ display:"flex",alignItems:"center",gap:"0.8rem",padding:"0.4rem 1.2rem",marginBottom:"0.2rem" }}>
                    <div style={{ flex:1,height:1,background:C.border }}/><span style={{ fontSize:"0.6rem",color:C.dimmer,fontFamily:font.mono,letterSpacing:"0.1em",whiteSpace:"nowrap" }}>Start of conversation</span><div style={{ flex:1,height:1,background:C.border }}/>
                  </div>
                  {messages.map((msg,i)=>(
                    <MessageBubble key={msg.id} msg={msg} prevAuthor={i>0?messages[i-1].author:null} onReact={handleReact} onReply={setReplyTo} currentUserId={currentUser?.id}/>
                  ))}
                  {typingUser && <TypingIndicator name={typingUser}/>}
                </>
              )}
              <div ref={bottomRef}/>
            </div>
            <MessageInput channelLabel={channelLabel} onSend={handleSend} replyTo={replyTo} clearReply={()=>setReplyTo(null)} isMobile={isMobile} onTyping={handleTyping}/>
          </div>
        )}
      </div>

      {/* Members panel — closed by default, user-toggled */}
      {active && !isDm && <MembersPanel members={members} open={membersOpen} onClose={()=>setMembersOpen(false)} currentUser={currentUser}/>}

      {/* Invite modal */}
      {showInviteModal && activeRoomId && (
        <InviteModal roomId={activeRoomId} roomLabel={activeRoom?.displayName || activeRoom?.name} onClose={()=>setShowInviteModal(false)}/>
      )}
    </div>
  );
}
