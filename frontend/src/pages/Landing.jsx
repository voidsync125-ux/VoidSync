import { useEffect, useRef, useState, useCallback } from "react";
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
  border: "rgba(0,229,255,0.18)",
  panelBg: "rgba(13,1,32,0.82)",
};
const font = {
  display: "'Arial Black','Impact','Franklin Gothic Heavy',sans-serif",
  body: "'Inter','Segoe UI',sans-serif",
  mono: "'Courier New',monospace",
};

// ─── RESPONSIVE HOOK ─────────────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState({ isMobile: false, isTablet: false, isDesktop: false, w: 1200 });
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setBp({ isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024, w });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return bp;
}

// ─── THREE.JS CANVAS ─────────────────────────────────────────────────
function CosmicHero() {
  const mountRef = useRef(null);
  useEffect(() => {
    const container = mountRef.current;
    const W = container.clientWidth, H = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const rings = [];
    const colors = [0x00e5ff, 0xff2cf7, 0xffd64a];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.TorusGeometry(1.1 - i * 0.28, 0.048, 24, 120);
      const mat = new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.55, metalness: 0.95, roughness: 0.08 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = (Math.PI / 3) * i;
      mesh.rotation.y = (Math.PI / 4.5) * i;
      scene.add(mesh); rings.push(mesh);
    }

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00e5ff, emissiveIntensity: 2.8, metalness: 1, roughness: 0 })
    );
    scene.add(sphere);

    const mkPts = (color, count, rMin, rMax, size = 0.016, opacity = 0.5) => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1), r = rMin + Math.random() * (rMax - rMin);
        pos[i*3] = r*Math.sin(p)*Math.cos(t); pos[i*3+1] = r*Math.sin(p)*Math.sin(t); pos[i*3+2] = r*Math.cos(p);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity }));
      scene.add(pts); return pts;
    };
    const p1 = mkPts(0x00e5ff, 600, 2.2, 4.8);
    const p2 = mkPts(0xff2cf7, 300, 3.0, 5.5);
    const p3 = mkPts(0xffffff, 400, 5.5, 9.0, 0.008, 0.35);

    scene.add(new THREE.AmbientLight(0x08001a, 2.5));
    const l1 = new THREE.PointLight(0x00e5ff, 5, 14); l1.position.set(3, 3, 3); scene.add(l1);
    const l2 = new THREE.PointLight(0xff2cf7, 4, 10); l2.position.set(-3, -2, 2); scene.add(l2);
    const l3 = new THREE.PointLight(0xffd64a, 2, 8); l3.position.set(0, -3, -2); scene.add(l3);

    let mx = 0, my = 0;
    const onMouse = (e) => { const r = container.getBoundingClientRect(); mx = ((e.clientX-r.left)/r.width-0.5)*2; my = -((e.clientY-r.top)/r.height-0.5)*2; };
    container.addEventListener("mousemove", onMouse);
    const onResize = () => { const w=container.clientWidth,h=container.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);

    let raf; const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate); const t = clock.getElapsedTime();
      rings.forEach((r,i) => { r.rotation.x+=0.0025*(i%2===0?1:-1); r.rotation.y+=0.004*(i%2===0?-1:1); r.rotation.z+=0.002; });
      sphere.material.emissiveIntensity = 2.0 + Math.sin(t*2.8)*0.8;
      p1.rotation.y=t*0.035; p2.rotation.y=-t*0.022; p3.rotation.y=t*0.008;
      camera.position.x+=(mx*0.55-camera.position.x)*0.04;
      camera.position.y+=(my*0.35-camera.position.y)*0.04;
      camera.lookAt(0,0,0); renderer.render(scene,camera);
    };
    animate();
    return () => { cancelAnimationFrame(raf); container.removeEventListener("mousemove",onMouse); window.removeEventListener("resize",onResize); renderer.dispose(); if(container.contains(renderer.domElement)) container.removeChild(renderer.domElement); };
  }, []);

  return (
    <div ref={mountRef} style={{ position:"absolute", inset:0, zIndex:0 }}>
      <div style={{ position:"absolute",inset:0,zIndex:1,pointerEvents:"none", backgroundImage:"radial-gradient(circle,rgba(0,229,255,0.07) 1px,transparent 1px)", backgroundSize:"20px 20px", mixBlendMode:"screen" }} />
      <div style={{ position:"absolute",inset:0,zIndex:1,pointerEvents:"none", background:"radial-gradient(ellipse at 50% 50%,transparent 30%,rgba(3,1,10,0.88) 100%)" }} />
    </div>
  );
}

// ─── NAVBAR ──────────────────────────────────────────────────────────
function Navbar({ onLaunch }) {
  const { isMobile } = useBreakpoint();
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = ["Features","Rooms","Pricing","Community","Docs"];

  return (
    <>
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:200, background:"rgba(3,1,10,0.97)", backdropFilter:"blur(14px)", borderBottom:`1px solid ${C.border}`, padding: isMobile ? "0 1.2rem" : "0 2.5rem" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height: isMobile ? 56 : 68 }}>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:"0.55rem" }}>
            <div style={{ width:28,height:28,borderRadius:"50%", background:`radial-gradient(circle at 35% 35%,#fff,${C.cyan})`, boxShadow:`0 0 12px ${C.cyan}`, flexShrink:0 }} />
            <span style={{ fontFamily:font.display, fontSize: isMobile?"1.1rem":"1.35rem", fontWeight:900, letterSpacing:"-0.02em", background:`linear-gradient(135deg,#fff 30%,${C.cyan} 70%,${C.magenta})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>VoidSync</span>
            <span style={{ fontSize:"0.5rem",letterSpacing:"0.14em",color:C.gold, fontFamily:font.mono, border:`1px solid ${C.gold}`, padding:"1px 4px", borderRadius:2 }}>BETA</span>
          </div>

          {/* Desktop nav links */}
          {!isMobile && (
            <div style={{ display:"flex", gap:"2.2rem", alignItems:"center" }}>
              {navLinks.map(l => (
                <a key={l} href="#" style={{ color:C.dim,fontSize:"0.83rem",letterSpacing:"0.04em",textDecoration:"none",fontFamily:font.body,fontWeight:500,transition:"color 0.2s" }}
                  onMouseEnter={e=>e.target.style.color=C.white} onMouseLeave={e=>e.target.style.color=C.dim}>{l}</a>
              ))}
            </div>
          )}

          {/* Desktop CTAs */}
          {!isMobile ? (
            <div style={{ display:"flex",gap:"0.8rem",alignItems:"center" }}>
              <button style={{ background:"transparent",border:"none",color:C.dim,fontSize:"0.83rem",cursor:"pointer",fontFamily:font.body,padding:"0.45rem 1rem",transition:"color 0.2s" }}
                onMouseEnter={e=>e.target.style.color=C.white} onMouseLeave={e=>e.target.style.color=C.dim}>Log in</button>
              <button onClick={onLaunch} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontSize:"0.8rem",fontWeight:700,cursor:"pointer",fontFamily:font.body,letterSpacing:"0.06em",padding:"0.5rem 1.4rem",borderRadius:3,transition:"opacity 0.2s" }}
                onMouseEnter={e=>e.target.style.opacity="0.85"} onMouseLeave={e=>e.target.style.opacity="1"}>Launch App →</button>
            </div>
          ) : (
            /* Hamburger */
            <button onClick={()=>setMenuOpen(o=>!o)} style={{ background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",gap:"5px",padding:"4px" }}>
              {[0,1,2].map(i=>(
                <span key={i} style={{ display:"block",width:22,height:2,background:menuOpen && i===1 ? "transparent" : C.cyan, borderRadius:2, transition:"all 0.25s",
                  transform: menuOpen ? (i===0?"rotate(45deg) translate(5px,5px)":i===2?"rotate(-45deg) translate(5px,-5px)":"none") : "none" }} />
              ))}
            </button>
          )}
        </div>

        {/* Mobile dropdown menu */}
        {isMobile && menuOpen && (
          <div style={{ borderTop:`1px solid ${C.border}`, padding:"1.2rem 1.2rem 1.5rem", display:"flex", flexDirection:"column", gap:"0.2rem" }}>
            {navLinks.map(l=>(
              <a key={l} href="#" onClick={()=>setMenuOpen(false)} style={{ color:C.dim,fontSize:"1rem",padding:"0.65rem 0",textDecoration:"none",fontFamily:font.body,borderBottom:`1px solid rgba(0,229,255,0.07)`,display:"block" }}>{l}</a>
            ))}
            <div style={{ display:"flex",gap:"0.8rem",marginTop:"1rem" }}>
              <button onClick={onLaunch} style={{ flex:1,background:"transparent",border:`1px solid ${C.border}`,color:C.dim,fontSize:"0.85rem",padding:"0.7rem",borderRadius:3,cursor:"pointer",fontFamily:font.body }}>Log in</button>
              <button onClick={onLaunch} style={{ flex:1,background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#000",fontWeight:700,fontSize:"0.85rem",padding:"0.7rem",borderRadius:3,cursor:"pointer",fontFamily:font.body }}>Launch App</button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────
function Hero({ onLaunch }) {
  const { isMobile, isDesktop } = useBreakpoint();
  const navH = isMobile ? 56 : 68;
  const [show, setShow] = useState(false);
  useEffect(()=>{ setTimeout(()=>setShow(true),120); },[]);

  return (
    <section style={{ position:"relative", height:`calc(100vh - ${navH}px)`, minHeight: isMobile?520:600, marginTop:navH, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", background:C.void }}>
      <CosmicHero />

      {/* Comic panel gold border */}
      <div style={{ position:"absolute", inset: isMobile?"0.8rem":"1.5rem", border:`2px solid ${C.gold}`, borderRadius:4, zIndex:2, pointerEvents:"none", boxShadow:`inset 0 0 40px rgba(255,214,74,0.05)` }} />
      {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h],i)=>(
        <div key={i} style={{ position:"absolute", [v]: isMobile?"0.8rem":"1.5rem", [h]: isMobile?"0.8rem":"1.5rem", width:16,height:16,
          borderTop: v==="top"?`2px solid ${C.gold}`:"none", borderBottom: v==="bottom"?`2px solid ${C.gold}`:"none",
          borderLeft: h==="left"?`2px solid ${C.gold}`:"none", borderRight: h==="right"?`2px solid ${C.gold}`:"none", zIndex:3 }} />
      ))}

      {/* Hero text */}
      <div style={{ position:"relative",zIndex:4,textAlign:"center",padding: isMobile?"0 1.2rem":"0 2rem",pointerEvents:"none",width:"100%",maxWidth:820,margin:"0 auto" }}>
        <div style={{ fontSize: isMobile?"0.58rem":"0.62rem", letterSpacing:"0.38em", color:C.magenta, fontFamily:font.mono, textTransform:"uppercase", marginBottom:"0.9rem", opacity:show?1:0, transition:"opacity 0.9s ease 0.3s" }}>
          ✦ Galactic Chat Network ✦
        </div>
        <h1 style={{ fontFamily:font.display, fontSize: isMobile?"clamp(2.6rem,14vw,3.8rem)":isDesktop?"clamp(4rem,8vw,7rem)":"clamp(3rem,10vw,5rem)", fontWeight:900, letterSpacing:"-0.03em", lineHeight:0.92, margin:"0 0 0.6rem",
          background:`linear-gradient(160deg,#fff 20%,${C.cyan} 55%,${C.magenta} 100%)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
          opacity:show?1:0, transition:"opacity 1.1s ease 0.15s" }}>
          VoidSync
        </h1>
        <p style={{ fontSize: isMobile?"0.88rem":isDesktop?"1.15rem":"1rem", color:"rgba(220,230,255,0.7)", fontWeight:300, fontFamily:font.body, letterSpacing:"0.03em", maxWidth: isMobile?"100%":540, margin:"0 auto 2rem", lineHeight:1.6,
          opacity:show?1:0, transition:"opacity 1s ease 0.6s" }}>
          Chat across dimensions. Rooms, threads & live voice — built for humans from every corner of the cosmos.
        </p>

        <div style={{ display:"flex", gap:"0.9rem", justifyContent:"center", flexWrap:"wrap", pointerEvents:"auto", opacity:show?1:0, transition:"opacity 1s ease 0.9s" }}>
          <button onClick={onLaunch} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`, border:"none", color:"#030109", fontFamily:font.display, fontSize: isMobile?"0.78rem":"0.85rem", fontWeight:900, letterSpacing:"0.1em", padding: isMobile?"0.8rem 1.8rem":"0.95rem 2.6rem", borderRadius:3, cursor:"pointer", textTransform:"uppercase", boxShadow:`0 0 24px rgba(0,229,255,0.35)`, transition:"transform 0.18s,box-shadow 0.18s" }}
            onMouseEnter={e=>{e.target.style.transform="scale(1.05)";e.target.style.boxShadow=`0 0 40px rgba(0,229,255,0.6)`;}}
            onMouseLeave={e=>{e.target.style.transform="scale(1)";e.target.style.boxShadow=`0 0 24px rgba(0,229,255,0.35)`;}}
          >Enter the Void</button>
          <button style={{ background:"transparent", border:`1px solid rgba(255,214,74,0.45)`, color:C.gold, fontFamily:font.body, fontSize: isMobile?"0.78rem":"0.83rem", letterSpacing:"0.08em", padding: isMobile?"0.78rem 1.5rem":"0.92rem 2rem", borderRadius:3, cursor:"pointer", textTransform:"uppercase", transition:"border-color 0.2s,color 0.2s" }}
            onMouseEnter={e=>{e.target.style.borderColor=C.gold;e.target.style.color=C.white;}}
            onMouseLeave={e=>{e.target.style.borderColor="rgba(255,214,74,0.45)";e.target.style.color=C.gold;}}
          >Watch Trailer ▶</button>
        </div>

        <div style={{ marginTop:"2.2rem", display:"inline-flex", alignItems:"center", gap:"0.5rem", background:"rgba(0,0,0,0.45)", backdropFilter:"blur(8px)", border:`1px solid rgba(0,229,255,0.2)`, borderRadius:20, padding:"0.32rem 0.9rem", fontSize:"0.68rem", color:C.dim, fontFamily:font.mono, letterSpacing:"0.08em", pointerEvents:"none", opacity:show?1:0, transition:"opacity 1s ease 1.1s" }}>
          <span style={{ width:7,height:7,borderRadius:"50%",background:"#00ff88",display:"inline-block",boxShadow:"0 0 6px #00ff88" }} />
          12,847 travelers online now
        </div>
      </div>

      <div style={{ position:"absolute",bottom:"2rem",left:"50%",transform:"translateX(-50%)",zIndex:4,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.35rem",opacity:0.38 }}>
        <div style={{ fontSize:"0.52rem",letterSpacing:"0.25em",color:C.dim,fontFamily:font.mono,textTransform:"uppercase" }}>Scroll</div>
        <div style={{ width:1,height:24,background:`linear-gradient(${C.cyan},transparent)` }} />
      </div>
    </section>
  );
}

// ─── FEATURE MINI-CANVASES ────────────────────────────────────────────

function useMiniCanvas(setupFn) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0, 4);
    const cleanup = setupFn(scene, camera, renderer);
    let raf;
    const clock = new THREE.Clock();
    const loop = () => { raf = requestAnimationFrame(loop); cleanup.tick(clock.getElapsedTime()); renderer.render(scene, camera); };
    loop();
    return () => { cancelAnimationFrame(raf); cleanup.dispose && cleanup.dispose(); renderer.dispose(); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
  }, []);
  return ref;
}

// 1. Void Rooms — slow nebula particle drift
function VoidRoomsViz() {
  const ref = useMiniCanvas((scene, camera) => {
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const count = 180;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i*3]   = (Math.random()-0.5)*3.5;
        pos[i*3+1] = (Math.random()-0.5)*2;
        pos[i*3+2] = (Math.random()-0.5)*1.5;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos.slice(), 3));
      const colors = [0x00e5ff, 0xff2cf7, 0x7b2fff];
      const mat = new THREE.PointsMaterial({ color: colors[k], size: 0.04, transparent: true, opacity: 0.55 });
      const p = new THREE.Points(geo, mat);
      scene.add(p); pts.push({ mesh: p, base: pos.slice(), speed: 0.12 + k * 0.07 });
    }
    camera.position.z = 3;
    return {
      tick(t) {
        pts.forEach(({ mesh, base, speed }, k) => {
          const arr = mesh.geometry.attributes.position.array;
          for (let i = 0; i < arr.length / 3; i++) {
            arr[i*3]   = base[i*3]   + Math.sin(t * speed + i * 0.4) * 0.12;
            arr[i*3+1] = base[i*3+1] + Math.cos(t * speed * 0.7 + i * 0.3) * 0.09;
          }
          mesh.geometry.attributes.position.needsUpdate = true;
          mesh.material.opacity = 0.35 + Math.sin(t * 0.5 + k) * 0.18;
        });
      }
    };
  });
  return <div ref={ref} style={{ position:"absolute", inset:0 }} />;
}

// 2. Instant Sync — lightning arc between two nodes
function InstantSyncViz() {
  const ref = useMiniCanvas((scene, camera) => {
    camera.position.z = 3.5;
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const left  = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), nodeMat.clone());
    const right = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), nodeMat.clone());
    left.position.set(-1.4, 0, 0); right.position.set(1.4, 0, 0);
    scene.add(left, right);

    // Glow rings around nodes
    [left, right].forEach(n => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 32), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
      ring.position.copy(n.position); scene.add(ring);
    });

    // Arc line — rebuilt each frame
    let arcLine = null;
    const arcMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 });

    return {
      tick(t) {
        // Pulse node brightness
        const pulse = 0.6 + Math.abs(Math.sin(t * 3)) * 0.4;
        left.material.color.setRGB(0, pulse, pulse);
        right.material.color.setRGB(0, pulse * 0.8, pulse);

        // Rebuild jagged lightning arc
        if (arcLine) { scene.remove(arcLine); arcLine.geometry.dispose(); }
        const segs = 12;
        const verts = [];
        for (let i = 0; i <= segs; i++) {
          const x = -1.4 + (i / segs) * 2.8;
          const jag = i > 0 && i < segs ? (Math.random() - 0.5) * 0.55 : 0;
          verts.push(x, jag, 0);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
        arcLine = new THREE.Line(geo, arcMat);
        arcMat.opacity = 0.5 + Math.abs(Math.sin(t * 4)) * 0.5;
        scene.add(arcLine);
      },
      dispose() { if (arcLine) arcLine.geometry.dispose(); }
    };
  });
  return <div ref={ref} style={{ position:"absolute", inset:0 }} />;
}

// 3. Live Voice — oscillating waveform ring
function LiveVoiceViz() {
  const ref = useMiniCanvas((scene, camera) => {
    camera.position.z = 3.2;
    const POINTS = 128;
    const mat = new THREE.LineBasicMaterial({ color: 0xff2cf7, transparent: true, opacity: 0.8 });
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(POINTS * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const line = new THREE.LineLoop(geo, mat);
    scene.add(line);

    // Static outer ring
    const rGeo = new THREE.RingGeometry(1.18, 1.22, 64);
    scene.add(new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({ color: 0xff2cf7, transparent: true, opacity: 0.12, side: THREE.DoubleSide })));

    return {
      tick(t) {
        const arr = line.geometry.attributes.position.array;
        for (let i = 0; i < POINTS; i++) {
          const angle = (i / POINTS) * Math.PI * 2;
          const wave = Math.sin(angle * 6 + t * 4) * 0.22 + Math.sin(angle * 3 - t * 2.5) * 0.1;
          const r = 1.0 + wave;
          arr[i*3]   = Math.cos(angle) * r;
          arr[i*3+1] = Math.sin(angle) * r;
          arr[i*3+2] = 0;
        }
        line.geometry.attributes.position.needsUpdate = true;
        mat.opacity = 0.55 + Math.sin(t * 2) * 0.25;
      }
    };
  });
  return <div ref={ref} style={{ position:"absolute", inset:0 }} />;
}

// 4. Encrypted Tunnels — wireframe icosahedron + outer shell rotating opposite
function EncryptedTunnelsViz() {
  const ref = useMiniCanvas((scene, camera) => {
    camera.position.z = 3.8;
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.7, 0),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.7 })
    );
    const outer = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffd64a, wireframe: true, transparent: true, opacity: 0.22 })
    );
    scene.add(inner, outer);
    return {
      tick(t) {
        inner.rotation.x = t * 0.6; inner.rotation.y = t * 0.9;
        outer.rotation.x = -t * 0.35; outer.rotation.y = -t * 0.5;
        inner.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.2;
      }
    };
  });
  return <div ref={ref} style={{ position:"absolute", inset:0 }} />;
}

// 5. AI Co-Pilot — neural network pulsing nodes + connecting edges
function AiCopilotViz() {
  const ref = useMiniCanvas((scene, camera) => {
    camera.position.z = 4;
    const nodePositions = [
      [0, 0, 0],
      [-1.1, 0.6, 0], [1.1, 0.6, 0], [-1.1, -0.6, 0], [1.1, -0.6, 0],
      [-0.5, 1.2, 0], [0.5, 1.2, 0], [-0.5, -1.2, 0], [0.5, -1.2, 0],
    ];
    const edges = [[0,1],[0,2],[0,3],[0,4],[1,5],[2,6],[3,7],[4,8],[1,3],[2,4],[5,6],[7,8]];
    const nodeMeshes = nodePositions.map(([x,y,z], i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(i === 0 ? 0.18 : 0.1, 12, 12),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0xff2cf7 : 0x00e5ff, transparent: true, opacity: 0.9 })
      );
      m.position.set(x, y, z); scene.add(m); return m;
    });
    const edgeMats = edges.map(() => new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.3 }));
    edges.forEach(([a, b], i) => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...nodePositions[a]), new THREE.Vector3(...nodePositions[b])]);
      scene.add(new THREE.Line(geo, edgeMats[i]));
    });
    return {
      tick(t) {
        nodeMeshes.forEach((m, i) => {
          const phase = i * 0.7;
          m.material.opacity = 0.4 + Math.abs(Math.sin(t * 1.8 + phase)) * 0.6;
          const s = 1 + Math.sin(t * 2 + phase) * 0.18;
          m.scale.setScalar(s);
        });
        edgeMats.forEach((mat, i) => { mat.opacity = 0.15 + Math.abs(Math.sin(t * 1.4 + i * 0.5)) * 0.35; });
      }
    };
  });
  return <div ref={ref} style={{ position:"absolute", inset:0 }} />;
}

// 6. Cosmic Threads — branching tree growing outward
function CosmicThreadsViz() {
  const ref = useMiniCanvas((scene, camera) => {
    camera.position.z = 5;
    const branches = [];
    const mat = () => new THREE.LineBasicMaterial({ color: 0xffd64a, transparent: true, opacity: 0.55 });

    function addBranch(x1, y1, x2, y2, depth) {
      if (depth === 0) return;
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1,y1,0), new THREE.Vector3(x2,y2,0)]);
      const line = new THREE.Line(geo, mat());
      scene.add(line);
      branches.push({ line, depth, born: Math.random() * 2 });
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx*dx+dy*dy) * 0.68;
      const angle = Math.atan2(dy, dx);
      addBranch(x2, y2, x2 + Math.cos(angle - 0.45) * len, y2 + Math.sin(angle - 0.45) * len, depth - 1);
      addBranch(x2, y2, x2 + Math.cos(angle + 0.45) * len, y2 + Math.sin(angle + 0.45) * len, depth - 1);
    }
    addBranch(0, -1.5, 0, -0.3, 5);

    return {
      tick(t) {
        branches.forEach(({ line, depth, born }) => {
          line.material.opacity = Math.max(0, Math.min(0.75, (t - born) * 0.9)) * (0.4 + (depth / 5) * 0.6);
          line.material.color.setHSL(0.13 + depth * 0.04, 1, 0.6 + Math.sin(t + born) * 0.15);
        });
      }
    };
  });
  return <div ref={ref} style={{ width:"100%", height:120, borderRadius:4, overflow:"hidden" }} />;
}

const featureData = [
  { Viz: VoidRoomsViz,       title:"Void Rooms",        desc:"Persistent chat rooms that feel like drifting through a nebula. Themed, searchable, alive." },
  { Viz: InstantSyncViz,     title:"Instant Sync",      desc:"Zero-lag message delivery across every device in real time. Your words travel at lightspeed." },
  { Viz: LiveVoiceViz,       title:"Live Voice",        desc:"Crystal-clear voice channels with spatial audio — feel like you're orbiting the same station." },
  { Viz: EncryptedTunnelsViz,title:"Encrypted Tunnels", desc:"End-to-end encryption. Your messages vanish into the void and arrive only for the intended." },
  { Viz: AiCopilotViz,       title:"AI Co-Pilot",       desc:"A built-in AI that summarizes threads, translates across languages, and keeps channels tidy." },
  { Viz: CosmicThreadsViz,   title:"Cosmic Threads",    desc:"Branching threaded replies that don't hijack the main channel. Context, always in orbit." },
];

function Features() {
  const { isMobile } = useBreakpoint();

  return (
    <section style={{ background:C.nebula, padding: isMobile?"4.5rem 1.2rem":"7rem 2.5rem", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,zIndex:0,pointerEvents:"none", backgroundImage:"radial-gradient(circle,rgba(255,44,247,0.05) 1px,transparent 1px)", backgroundSize:"24px 24px" }} />
      <div style={{ maxWidth:1200,margin:"0 auto",position:"relative",zIndex:1 }}>
        <div style={{ textAlign:"center",marginBottom: isMobile?"3rem":"4.5rem" }}>
          <div style={{ fontSize:"0.58rem",letterSpacing:"0.36em",color:C.cyan,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.7rem" }}>✦ What's Inside ✦</div>
          <h2 style={{ fontFamily:font.display,fontSize: isMobile?"clamp(1.8rem,8vw,2.4rem)":"clamp(2rem,5vw,3.4rem)",fontWeight:900,color:C.white,letterSpacing:"-0.02em",margin:0 }}>
            Built for the <span style={{ color:C.magenta }}>Cosmos</span>
          </h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap: isMobile?"1rem":"1.5rem" }}>
          {featureData.map(({ Viz, title, desc }, i) => (
            <div key={i} style={{ background:C.panelBg, border:`1px solid ${C.border}`, borderRadius:4, padding: isMobile?"1.3rem":"1.6rem 1.8rem", transition:"border-color 0.25s,transform 0.25s", cursor:"default", position:"relative" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.cyan;e.currentTarget.style.transform="translateY(-4px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
              <div style={{ position:"absolute",top:"0.8rem",right:"0.9rem",fontSize:"0.52rem",fontFamily:font.mono,color:"rgba(255,214,74,0.32)",letterSpacing:"0.1em",zIndex:2 }}>0{i+1}</div>
              {/* Contained 120px animation canvas */}
              <div style={{ position:"relative", zIndex:1, height:120, marginBottom:"1rem", borderRadius:3, overflow:"hidden", border:`1px solid rgba(0,229,255,0.08)` }}>
                <Viz />
              </div>
              <h3 style={{ fontFamily:font.display,fontSize: isMobile?"0.95rem":"1.05rem",fontWeight:900,color:C.white,letterSpacing:"0.02em",margin:"0 0 0.5rem" }}>{title}</h3>
              <p style={{ fontFamily:font.body,fontSize: isMobile?"0.82rem":"0.85rem",color:C.dim,lineHeight:1.65,margin:0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ─────────────────────────────────────────────────────
const steps = [
  { label:"Create", detail:"Open a Void Room in seconds. Name it, theme it, invite who you want — or go public to the cosmos." },
  { label:"Connect", detail:"Text, voice, or threads. Guests join from any device with zero install required." },
  { label:"Sync", detail:"Every message stays in perfect sync across all travellers in real time, forever." },
];

function HowItWorks() {
  const { isMobile } = useBreakpoint();
  return (
    <section style={{ background:C.void, padding: isMobile?"4.5rem 1.2rem":"7rem 2.5rem" }}>
      <div style={{ maxWidth:900,margin:"0 auto" }}>
        <div style={{ textAlign:"center",marginBottom: isMobile?"3rem":"4.5rem" }}>
          <div style={{ fontSize:"0.58rem",letterSpacing:"0.36em",color:C.magenta,fontFamily:font.mono,textTransform:"uppercase",marginBottom:"0.7rem" }}>✦ Mission Brief ✦</div>
          <h2 style={{ fontFamily:font.display,fontSize: isMobile?"clamp(1.8rem,8vw,2.4rem)":"clamp(2rem,5vw,3.2rem)",fontWeight:900,color:C.white,letterSpacing:"-0.02em",margin:0 }}>
            Launch in <span style={{ color:C.gold }}>3 moves</span>
          </h2>
        </div>
        <div style={{ display:"flex",flexDirection:"column" }}>
          {steps.map((s,i)=>(
            <div key={i} style={{ display:"flex",alignItems:"flex-start",gap: isMobile?"1.2rem":"2rem", padding: isMobile?"1.8rem 0":"2.4rem 0", borderBottom: i<steps.length-1?`1px solid ${C.border}`:"none" }}>
              <div style={{ fontFamily:font.display,fontSize: isMobile?"2.6rem":"3.5rem",fontWeight:900,lineHeight:1,flexShrink:0,width: isMobile?"2.4rem":"3rem",
                background:`linear-gradient(180deg,${C.cyan},${C.magenta})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>{String(i+1).padStart(2,"0")}</div>
              <div>
                <div style={{ fontFamily:font.display,fontSize: isMobile?"1.05rem":"1.3rem",fontWeight:900,color:C.white,letterSpacing:"0.04em",marginBottom:"0.45rem",textTransform:"uppercase" }}>{s.label}</div>
                <p style={{ fontFamily:font.body,fontSize: isMobile?"0.84rem":"0.9rem",color:C.dim,lineHeight:1.7,margin:0 }}>{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA BAND ─────────────────────────────────────────────────────────
function CtaBand({ onLaunch }) {
  const { isMobile } = useBreakpoint();
  return (
    <section style={{ background:`linear-gradient(135deg,#0a001f,#000d1a)`, padding: isMobile?"4.5rem 1.2rem":"6rem 2.5rem", textAlign:"center", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute",top:"50%",left:"25%",transform:"translate(-50%,-50%)",width:400,height:400,borderRadius:"50%",background:"rgba(0,229,255,0.06)",filter:"blur(80px)",pointerEvents:"none" }} />
      <div style={{ position:"absolute",top:"50%",right:"15%",transform:"translate(50%,-50%)",width:300,height:300,borderRadius:"50%",background:"rgba(255,44,247,0.07)",filter:"blur(60px)",pointerEvents:"none" }} />
      <div style={{ position:"relative",zIndex:1 }}>
        <h2 style={{ fontFamily:font.display,fontSize: isMobile?"clamp(1.8rem,8vw,2.6rem)":"clamp(2rem,6vw,4rem)",fontWeight:900,color:C.white,letterSpacing:"-0.02em",margin:"0 0 1rem" }}>
          Your signal is lost.<br/><span style={{ color:C.cyan }}>Find it in the Void.</span>
        </h2>
        <p style={{ fontFamily:font.body,color:C.dim,fontSize: isMobile?"0.88rem":"1rem",marginBottom:"2.2rem" }}>Free forever for small crews. No credit card. No void tax.</p>
        <button onClick={onLaunch} style={{ background:`linear-gradient(135deg,${C.cyan},${C.magenta})`,border:"none",color:"#030109",fontFamily:font.display,fontSize: isMobile?"0.82rem":"0.9rem",fontWeight:900,letterSpacing:"0.1em",textTransform:"uppercase",padding: isMobile?"0.85rem 2rem":"1rem 3rem",borderRadius:3,cursor:"pointer",boxShadow:`0 0 32px rgba(0,229,255,0.4)`,transition:"transform 0.18s" }}
          onMouseEnter={e=>e.target.style.transform="scale(1.05)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}>
          Open a Room — Free
        </button>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────
function Footer() {
  const { isMobile, isTablet } = useBreakpoint();
  const cols = [
    { heading:"Product", links:["Features","Pricing","Changelog","Roadmap","Status"] },
    { heading:"Community", links:["Discord","Forum","Events","Blog","Showcase"] },
    { heading:"Company", links:["About","Careers","Press","Contact","Legal"] },
    { heading:"Developers", links:["API Docs","Webhooks","SDK","Open Source","Terms"] },
  ];

  return (
    <footer style={{ background:C.void, borderTop:`1px solid ${C.border}`, padding: isMobile?"3.5rem 1.2rem 2rem":"4.5rem 2.5rem 2.5rem", fontFamily:font.body }}>
      <div style={{ maxWidth:1280,margin:"0 auto" }}>

        {/* Top grid — brand + links */}
        <div style={{ display:"grid",
          gridTemplateColumns: isMobile?"1fr": isTablet?"1fr 1fr":"1.5fr repeat(4,1fr)",
          gap: isMobile?"2.5rem":"2rem",
          marginBottom: isMobile?"2.5rem":"3.5rem" }}>

          {/* Brand */}
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem" }}>
              <div style={{ width:24,height:24,borderRadius:"50%",background:`radial-gradient(circle,#fff,${C.cyan})`,boxShadow:`0 0 10px ${C.cyan}` }} />
              <span style={{ fontFamily:font.display,fontSize:"1.1rem",fontWeight:900,background:`linear-gradient(135deg,#fff,${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>VoidSync</span>
            </div>
            <p style={{ fontSize:"0.82rem",color:C.dim,lineHeight:1.65,maxWidth:220,margin:"0 0 1.3rem" }}>
              Chat infrastructure for explorers, creators, and people who refuse to stay in one galaxy.
            </p>
            <div style={{ display:"flex",gap:"0.65rem" }}>
              {["𝕏","⬡","▶","◎"].map((icon,i)=>(
                <button key={i} style={{ width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.dim,fontSize:"0.75rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"border-color 0.2s,color 0.2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.cyan;e.currentTarget.style.color=C.white;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>{icon}</button>
              ))}
            </div>
          </div>

          {/* Link columns — on tablet, wrap into 2-col sub-grid */}
          {isMobile ? (
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2rem" }}>
              {cols.map(col=>(
                <div key={col.heading}>
                  <div style={{ fontSize:"0.6rem",letterSpacing:"0.2em",color:C.cyan,textTransform:"uppercase",fontFamily:font.mono,marginBottom:"1rem" }}>{col.heading}</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:"0.6rem" }}>
                    {col.links.map(l=>(<a key={l} href="#" style={{ fontSize:"0.82rem",color:C.dim,textDecoration:"none" }}>{l}</a>))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            cols.map(col=>(
              <div key={col.heading}>
                <div style={{ fontSize:"0.6rem",letterSpacing:"0.2em",color:C.cyan,textTransform:"uppercase",fontFamily:font.mono,marginBottom:"1.1rem" }}>{col.heading}</div>
                <div style={{ display:"flex",flexDirection:"column",gap:"0.6rem" }}>
                  {col.links.map(l=>(
                    <a key={l} href="#" style={{ fontSize:"0.82rem",color:C.dim,textDecoration:"none",transition:"color 0.2s" }}
                      onMouseEnter={e=>e.target.style.color=C.white} onMouseLeave={e=>e.target.style.color=C.dim}>{l}</a>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop:`1px solid ${C.border}`,paddingTop:"1.4rem",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.8rem" }}>
          <span style={{ fontSize:"0.7rem",color:"rgba(240,244,255,0.28)",fontFamily:font.mono,letterSpacing:"0.05em" }}>
            © 2026 VoidSync, Inc. — Transmission from the edge.
          </span>
          <div style={{ display:"flex",gap:"1.3rem" }}>
            {["Privacy","Terms","Cookies"].map(t=>(
              <a key={t} href="#" style={{ fontSize:"0.7rem",color:"rgba(240,244,255,0.28)",textDecoration:"none",fontFamily:font.mono,letterSpacing:"0.05em",transition:"color 0.2s" }}
                onMouseEnter={e=>e.target.style.color=C.dim} onMouseLeave={e=>e.target.style.color="rgba(240,244,255,0.28)"}>{t}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── PAGE ROOT ────────────────────────────────────────────────────────
export default function Landing({ onLaunch }) {
  return (
    <div style={{ background:C.void, minHeight:"100vh", color:C.white, overflowX:"hidden" }}>
      <Navbar onLaunch={onLaunch} />
      <Hero onLaunch={onLaunch} />
      <Features />
      <HowItWorks />
      <CtaBand onLaunch={onLaunch} />
      <Footer />
    </div>
  );
}
