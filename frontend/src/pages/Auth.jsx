import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────
const C = {
  void: "#03010a",
  nebula: "#0d0120",
  cyan: "#00e5ff",
  magenta: "#ff2cf7",
  gold: "#ffd64a",
  white: "#f0f4ff",
  dim: "rgba(240,244,255,0.55)",
  dimmer: "rgba(240,244,255,0.32)",
  border: "rgba(0,229,255,0.18)",
  borderHover: "rgba(0,229,255,0.55)",
  panelBg: "rgba(8,0,20,0.88)",
  inputBg: "rgba(0,229,255,0.02)",
  errorColor: "#ff5f7e",
};
const font = {
  display: "'Arial Black','Impact','Franklin Gothic Heavy',sans-serif",
  body: "'Inter','Segoe UI',sans-serif",
  mono: "'Courier New',monospace",
};

// ─── RESPONSIVE HOOK ──────────────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState({ isMobile: false, isDesktop: false, w: 1200 });
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setBp({ isMobile: w < 768, isDesktop: w >= 768, w });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return bp;
}

// ─── WORMHOLE THREE.JS ANIMATION ──────────────────────────────────────
// Concept: a deep spiralling vortex tunnel — rings of particles converging
// into a central singularity, with a slow chromatic twist. Completely
// different from the hero's interlocked torus rings.
function WormholeCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const W = container.clientWidth, H = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, W / H, 0.01, 200);
    camera.position.set(0, 0, 5);

    // ── Vortex tunnel rings ──────────────────────────────────────────
    // 60 rings, each a circle of points, spaced along Z from +12 → -2
    // They drift toward the camera (Z increases) and loop back.
    const RING_COUNT = 60;
    const PTS_PER_RING = 80;
    const allRings = [];

    for (let r = 0; r < RING_COUNT; r++) {
      const t = r / RING_COUNT; // 0..1
      const z = -12 + t * 16;  // spread from -12 to +4
      const radius = 0.3 + t * 2.8; // small at back, large at front

      const positions = new Float32Array(PTS_PER_RING * 3);
      for (let p = 0; p < PTS_PER_RING; p++) {
        const angle = (p / PTS_PER_RING) * Math.PI * 2;
        positions[p * 3]     = Math.cos(angle) * radius;
        positions[p * 3 + 1] = Math.sin(angle) * radius;
        positions[p * 3 + 2] = z;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      // Color: deep purple at back → cyan at mid → magenta at front
      const hue = 0.72 - t * 0.55; // purple → cyan-ish
      const col = new THREE.Color().setHSL(hue, 1.0, 0.55 + t * 0.15);

      const mat = new THREE.PointsMaterial({
        color: col,
        size: 0.025 + t * 0.018,
        transparent: true,
        opacity: 0.15 + t * 0.65,
        sizeAttenuation: true,
      });

      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      allRings.push({ pts, geo, positions: positions.slice(), baseZ: z, radius, t });
    }

    // ── Central singularity glow ─────────────────────────────────────
    const singGeo = new THREE.SphereGeometry(0.18, 32, 32);
    const singMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const singularity = new THREE.Mesh(singGeo, singMat);
    singularity.position.set(0, 0, -0.5);
    scene.add(singularity);

    // Halo ring around singularity
    const haloGeo = new THREE.RingGeometry(0.25, 0.38, 64);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(0, 0, -0.5);
    scene.add(halo);

    // ── Stardust background ──────────────────────────────────────────
    const starCount = 500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * 20;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      starPos[i * 3 + 2] = -10 + Math.random() * 8;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.012, transparent: true, opacity: 0.28 });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Lighting ─────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x080020, 3));
    const pLight = new THREE.PointLight(0x00e5ff, 6, 12);
    pLight.position.set(0, 0, 1);
    scene.add(pLight);

    // ── Mouse subtle tilt ────────────────────────────────────────────
    let mx = 0, my = 0;
    const onMouse = (e) => {
      const r = container.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = -((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    container.addEventListener("mousemove", onMouse);

    // ── Resize ───────────────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Animate ──────────────────────────────────────────────────────
    let raf;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      allRings.forEach(({ pts, geo, positions, baseZ, radius, t: rt }) => {
        const arr = geo.attributes.position.array;
        // Drift rings toward camera; loop when they pass z=+5
        const drift = (t * 1.1) % 16;
        const newZ = ((baseZ + drift + 12) % 16) - 12;
        const nt = (newZ + 12) / 16; // normalized 0..1 for this frame position
        const twist = t * 0.35 + rt * Math.PI * 2;

        for (let p = 0; p < PTS_PER_RING; p++) {
          const angle = (p / PTS_PER_RING) * Math.PI * 2 + twist;
          const r2 = 0.3 + nt * 2.8;
          arr[p * 3]     = Math.cos(angle) * r2;
          arr[p * 3 + 1] = Math.sin(angle) * r2;
          arr[p * 3 + 2] = newZ;
        }
        geo.attributes.position.needsUpdate = true;

        // Fade opacity by depth
        pts.material.opacity = Math.max(0, 0.08 + nt * 0.75);
        pts.material.size = 0.02 + nt * 0.022;

        // Color shift over time
        const hue = ((0.72 - nt * 0.55) + t * 0.04) % 1;
        pts.material.color.setHSL(hue, 1.0, 0.55 + nt * 0.15);
      });

      // Singularity pulse
      singMat.opacity = 0.7 + Math.sin(t * 3.5) * 0.3;
      haloMat.opacity = 0.2 + Math.abs(Math.sin(t * 2)) * 0.3;
      halo.rotation.z = t * 0.8;
      const s = 1 + Math.sin(t * 3.5) * 0.12;
      singularity.scale.setScalar(s);

      // Subtle camera tilt following mouse
      camera.position.x += (mx * 0.3 - camera.position.x) * 0.03;
      camera.position.y += (my * 0.2 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, -1);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={mountRef} style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      {/* Radial vignette to darken edges */}
      <div style={{ position:"absolute",inset:0,zIndex:1,pointerEvents:"none",
        background:"radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(3,1,10,0.75) 100%)" }} />
      {/* Halftone comic overlay */}
      <div style={{ position:"absolute",inset:0,zIndex:1,pointerEvents:"none",
        backgroundImage:"radial-gradient(circle,rgba(0,229,255,0.055) 1px,transparent 1px)",
        backgroundSize:"18px 18px", mixBlendMode:"screen" }} />
    </div>
  );
}

// ─── INPUT COMPONENT ──────────────────────────────────────────────────
function Input({ label, type = "text", value, onChange, placeholder, error, icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <label style={{ display:"block", fontSize:"0.68rem", letterSpacing:"0.18em",
        color: focused ? C.cyan : C.dimmer, fontFamily:font.mono,
        textTransform:"uppercase", marginBottom:"0.45rem",
        transition:"color 0.2s" }}>{label}</label>
      <div style={{ position:"relative" }}>
        {icon && (
          <span style={{ position:"absolute",left:"0.9rem",top:"50%",transform:"translateY(-50%)",
            fontSize:"0.9rem", opacity:0.5, zIndex:1 }}>{icon}</span>
        )}
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width:"100%", boxSizing:"border-box",
            background: focused ? "rgba(0,229,255,0.07)" : C.inputBg,
            border:`1px solid ${error ? C.errorColor : focused ? C.cyan : C.border}`,
            borderRadius:3, color:C.white,
            fontSize:"0.88rem", fontFamily:font.body,
            padding: icon ? "0.72rem 0.9rem 0.72rem 2.5rem" : "0.72rem 0.9rem",
            outline:"none", transition:"all 0.2s",
            boxShadow: focused ? `0 0 0 3px rgba(0,229,255,0.1)` : "none",
          }}
        />
      </div>
      {error && <div style={{ fontSize:"0.7rem",color:C.errorColor,marginTop:"0.3rem",fontFamily:font.body }}>{error}</div>}
    </div>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────
function Navbar({ onBack }) {
  return (
    <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:200,
      background:"rgba(3,1,10,0.97)", backdropFilter:"blur(14px)",
      borderBottom:`1px solid ${C.border}`, padding:"0 2rem", height:64,
      display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div style={{ display:"flex",alignItems:"center",gap:"0.55rem" }}>
        <div style={{ width:28,height:28,borderRadius:"50%",
          background:`radial-gradient(circle at 35% 35%,#fff,${C.cyan})`,
          boxShadow:`0 0 12px ${C.cyan}` }} />
        <span style={{ fontFamily:font.display,fontSize:"1.25rem",fontWeight:900,
          background:`linear-gradient(135deg,#fff 30%,${C.cyan} 70%,${C.magenta})`,
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>VoidSync</span>
        <span style={{ fontSize:"0.5rem",letterSpacing:"0.14em",color:C.gold,fontFamily:font.mono,
          border:`1px solid ${C.gold}`,padding:"1px 4px",borderRadius:2 }}>BETA</span>
      </div>
      <button onClick={onBack} style={{ fontSize:"0.8rem",color:C.dim,fontFamily:font.body,
        background:"none",border:"none",cursor:"pointer",
        textDecoration:"none",letterSpacing:"0.05em",transition:"color 0.2s" }}
        onMouseEnter={e=>e.target.style.color=C.white}
        onMouseLeave={e=>e.target.style.color=C.dim}>← Back to site</button>
    </nav>
  );
}

// ─── AUTH PAGE ────────────────────────────────────────────────────────
export default function Auth({ onAuthSuccess, onBack }) {
  const { isMobile } = useBreakpoint();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);

  const isLogin = mode === "login";

  const switchMode = (m) => {
    setMode(m); setErrors({}); setSuccess(false);
    setEmail(""); setPassword(""); setUsername(""); setConfirmPw("");
  };

  const validate = () => {
    const e = {};
    if (!email.includes("@")) e.email = "Enter a valid email address.";
    if (password.length < 6) e.password = "Password must be at least 6 characters.";
    if (!isLogin) {
      if (username.trim().length < 2) e.username = "Username must be at least 2 characters.";
      if (confirmPw !== password) e.confirmPw = "Passwords do not match.";
    }
    return e;
  };

  // Base URL of the backend API. In Vite, set VITE_API_URL in .env
  // Render backend base should be https://voidsync-rnvm.onrender.com
  const API_URL = (import.meta.env.VITE_API_URL || "https://voidsync-rnvm.onrender.com").replace(/\/+$/, "");


  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
      const body = isLogin
        ? { email, password }
        : { username: username.trim(), email, password };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        // Show the backend's error message under the most relevant field,
        // falling back to the email field for generic errors.
        const msg = data.error || "Something went wrong. Please try again.";
        if (/username/i.test(msg)) setErrors({ username: msg });
        else if (/email/i.test(msg)) setErrors({ email: msg });
        else if (/password/i.test(msg)) setErrors({ password: msg });
        else setErrors({ email: msg });
        setLoading(false);
        return;
      }

      // Success: store token + user, show success screen, then navigate
      localStorage.setItem("voidsync_token", data.token);
      localStorage.setItem("voidsync_user", JSON.stringify(data.user));

      setLoading(false);
      setSuccess(true);

      setTimeout(() => {
        onAuthSuccess?.(data.user);
      }, 1400);
    } catch (err) {
      console.error("Auth request failed:", err);
      setLoading(false);
      setErrors({
        email: `Couldn't reach the server. Backend: ${API_URL}${isLogin ? "/api/auth/login" : "/api/auth/signup"} (check Render status, CORS, and env vars)`,
      });
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.void, color:C.white, fontFamily:font.body, overflowX:"hidden" }}>

      {/* ── Full-page wormhole background — fixed, always behind everything ── */}
      <div style={{ position:"fixed", inset:0, zIndex:0 }}>
        <WormholeCanvas />
      </div>

      {/* ── Gold comic panel border ── */}
      <div style={{ position:"fixed", inset:"1.2rem",
        border:`1.5px solid rgba(255,214,74,0.28)`, borderRadius:4,
        zIndex:1, pointerEvents:"none" }} />

      {/* ── Navbar on top ── */}
      <Navbar onBack={onBack} />

      {/* ── Live pill ── */}
      <div style={{ position:"fixed", top: isMobile?"4.5rem":"5rem", left:"2rem", zIndex:10,
        display:"inline-flex", alignItems:"center", gap:"0.45rem",
        background:"rgba(0,0,0,0.55)", backdropFilter:"blur(8px)",
        border:`1px solid rgba(0,229,255,0.2)`, borderRadius:20,
        padding:"0.28rem 0.85rem", fontSize:"0.62rem", color:C.dim,
        fontFamily:font.mono, letterSpacing:"0.08em" }}>
        <span style={{ width:6,height:6,borderRadius:"50%",background:"#00ff88",
          display:"inline-block",boxShadow:"0 0 5px #00ff88" }} />
        12,847 online now
      </div>

      {/* ── Scrollable page content centred over the background ── */}
      <div style={{ position:"relative", zIndex:5,
        minHeight:"100vh", paddingTop:64,
        display:"flex", alignItems:"center", justifyContent:"center",
        padding: isMobile ? "80px 1.2rem 2.5rem" : "90px 2rem 2.5rem" }}>

        {/* Frosted glass form card */}
        <div style={{ width:"100%", maxWidth: isMobile?"100%":480,
          background:"rgba(4,0,14,0.08)",
          backdropFilter:"none",
          WebkitBackdropFilter:"none",
          border:`1px solid rgba(0,229,255,0.12)`,
          borderRadius:6,
          padding: isMobile?"1.8rem 1.4rem":"2.6rem 2.4rem",
          boxShadow:`0 0 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,229,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)`,
          position:"relative" }}>

          {/* Top glow line on card */}
          <div style={{ position:"absolute",top:0,left:"8%",right:"8%",height:1,
            background:`linear-gradient(90deg,transparent,${C.cyan},transparent)`,
            borderRadius:1, opacity:0.6 }} />

          {/* ── Mode toggle tabs ── */}
          <div style={{ display:"flex", gap:0, marginBottom:"2rem",
            background:"rgba(0,0,0,0.12)", borderRadius:4,
            border:`1px solid ${C.border}`, padding:"3px", overflow:"hidden" }}>
            {["login","signup"].map(m => (
              <button key={m} onClick={() => switchMode(m)} style={{
                flex:1, padding:"0.6rem", border:"none", cursor:"pointer",
                borderRadius:3, fontFamily:font.display, fontWeight:900,
                fontSize:"0.8rem", letterSpacing:"0.1em", textTransform:"uppercase",
                transition:"all 0.22s",
                background: mode === m ? `linear-gradient(135deg,${C.cyan},${C.magenta})` : "transparent",
                color: mode === m ? "#030109" : C.dim,
              }}>
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* ── Header ── */}
          <div style={{ marginBottom:"1.6rem" }}>
            <div style={{ fontSize:"0.58rem", letterSpacing:"0.32em", color:C.cyan,
              fontFamily:font.mono, textTransform:"uppercase", marginBottom:"0.45rem" }}>
              {isLogin ? "Welcome back, Traveller" : "Begin Your Journey"}
            </div>
            <h1 style={{ fontFamily:font.display, fontSize:"clamp(1.6rem,4vw,2.2rem)",
              fontWeight:900, margin:0, letterSpacing:"-0.02em",
              background:`linear-gradient(135deg,#fff 40%,${C.cyan})`,
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
              {isLogin ? "Sign into the Void" : "Create your Void Account"}
            </h1>
          </div>

          {/* ── Success state ── */}
          {success ? (
            <div style={{ textAlign:"center", padding:"2.5rem 1rem" }}>
              <div style={{ fontSize:"2.5rem", marginBottom:"1rem" }}>✦</div>
              <h2 style={{ fontFamily:font.display, fontSize:"1.4rem", fontWeight:900,
                color:C.cyan, margin:"0 0 0.6rem" }}>
                {isLogin ? "Signal acquired." : "Account created."}
              </h2>
              <p style={{ color:C.dim, fontSize:"0.88rem", lineHeight:1.6 }}>
                {isLogin ? "Syncing you to the nearest Void Room…" : "Welcome to the cosmos. Redirecting to your first room…"}
              </p>
              <div style={{ marginTop:"1.5rem", display:"inline-block",
                width:32, height:32, border:`2px solid ${C.cyan}`,
                borderTopColor:"transparent", borderRadius:"50%",
                animation:"spin 0.8s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <>
              {/* ── Username (signup only) ── */}
              {!isLogin && (
                <Input label="Username" value={username} onChange={e=>setUsername(e.target.value)}
                  placeholder="cosmic_traveller" error={errors.username} icon="◎" />
              )}

              {/* ── Email ── */}
              <Input label="Email address" type="email" value={email}
                onChange={e=>setEmail(e.target.value)}
                placeholder="you@voidsync.io" error={errors.email} icon="✉" />

              {/* ── Password ── */}
              <div style={{ position:"relative" }}>
                <Input label="Password" type={showPw?"text":"password"} value={password}
                  onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••••" error={errors.password} icon="⬡" />
                <button onClick={()=>setShowPw(v=>!v)} style={{
                  position:"absolute", right:"0.9rem", top:"2rem",
                  background:"none", border:"none", cursor:"pointer",
                  color:C.dimmer, fontSize:"0.7rem", fontFamily:font.mono,
                  letterSpacing:"0.06em", padding:0,
                }}>{showPw?"HIDE":"SHOW"}</button>
              </div>

              {/* ── Confirm password (signup only) ── */}
              {!isLogin && (
                <Input label="Confirm Password" type={showPw?"text":"password"} value={confirmPw}
                  onChange={e=>setConfirmPw(e.target.value)}
                  placeholder="••••••••" error={errors.confirmPw} icon="⬡" />
              )}

              {/* ── Forgot password (login only) ── */}
              {isLogin && (
                <div style={{ textAlign:"right", marginTop:"-0.4rem", marginBottom:"1.2rem" }}>
                  <a href="#" style={{ fontSize:"0.7rem", color:C.dimmer, fontFamily:font.mono,
                    textDecoration:"none", letterSpacing:"0.08em", transition:"color 0.2s" }}
                    onMouseEnter={e=>e.target.style.color=C.cyan}
                    onMouseLeave={e=>e.target.style.color=C.dimmer}>
                    Forgot password?
                  </a>
                </div>
              )}

              {/* ── T&C (signup only) ── */}
              {!isLogin && (
                <p style={{ fontSize:"0.7rem", color:C.dimmer, lineHeight:1.55,
                  fontFamily:font.body, marginBottom:"1.2rem" }}>
                  By creating an account you agree to the{" "}
                  <a href="#" style={{ color:C.cyan, textDecoration:"none" }}>Terms of Service</a> and{" "}
                  <a href="#" style={{ color:C.cyan, textDecoration:"none" }}>Privacy Policy</a>.
                </p>
              )}

              {/* ── Submit ── */}
              <button onClick={handleSubmit} disabled={loading} style={{
                width:"100%", padding:"0.9rem", border:"none", borderRadius:3,
                fontFamily:font.display, fontSize:"0.88rem", fontWeight:900,
                letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer",
                background: loading ? "rgba(0,229,255,0.2)" : `linear-gradient(135deg,${C.cyan},${C.magenta})`,
                color: loading ? C.dim : "#030109",
                boxShadow: loading ? "none" : `0 0 28px rgba(0,229,255,0.4)`,
                transition:"all 0.2s", marginBottom:"1.4rem",
              }}>
                {loading ? "Syncing…" : isLogin ? "Enter the Void →" : "Create Account →"}
              </button>

              {/* ── Divider ── */}
              <div style={{ display:"flex", alignItems:"center", gap:"0.8rem", marginBottom:"1.2rem" }}>
                <div style={{ flex:1, height:1, background:C.border }} />
                <span style={{ fontSize:"0.6rem", color:C.dimmer, fontFamily:font.mono, letterSpacing:"0.12em" }}>OR</span>
                <div style={{ flex:1, height:1, background:C.border }} />
              </div>

              {/* ── OAuth buttons ── */}
              <div style={{ display:"flex", flexDirection:"column", gap:"0.65rem", marginBottom:"1.5rem" }}>
                {[
                  { label:"Continue with Google",  icon:"G", color:"#ea4335" },
                  { label:"Continue with Discord", icon:"⌨", color:"#5865f2" },
                  { label:"Continue with GitHub",  icon:"◆", color:C.dim },
                ].map(({ label, icon, color }) => (
                  <button key={label} onClick={()=>alert(`${label} is coming soon — not wired up yet!`)} style={{
                    width:"100%", padding:"0.7rem 1rem", borderRadius:3, cursor:"pointer",
                    background:"rgba(255,255,255,0.04)",
                    border:`1px solid ${C.border}`,
                    color:C.white, fontFamily:font.body, fontSize:"0.84rem",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:"0.7rem",
                    transition:"border-color 0.2s, background 0.2s",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(0,229,255,0.5)";e.currentTarget.style.background="rgba(0,229,255,0.06)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="rgba(255,255,255,0.04)";}}>
                    <span style={{ color, fontWeight:700, fontSize:"0.88rem" }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Switch mode ── */}
              <p style={{ textAlign:"center", fontSize:"0.78rem", color:C.dimmer, fontFamily:font.body, margin:0 }}>
                {isLogin ? "No account yet? " : "Already have an account? "}
                <button onClick={()=>switchMode(isLogin?"signup":"login")} style={{
                  background:"none", border:"none", color:C.cyan, cursor:"pointer",
                  fontSize:"0.78rem", fontFamily:font.body,
                  textDecoration:"underline", textUnderlineOffset:"3px", padding:0,
                }}>
                  {isLogin ? "Create one" : "Log in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
