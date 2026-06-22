import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function SolarLoader({ message = "Syncing with the Void…", onWordFormed }) {
  const ref = useRef(null);
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const W = el.clientWidth, H = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 300);
    camera.position.set(0, 2, 30);

    // ════════════════════════════════════════════════════════════════
    // PART 1 — Solar system, tilted vertical, positioned in upper area
    // ════════════════════════════════════════════════════════════════
    const solarGroup = new THREE.Group();
    solarGroup.position.set(0, 10, -6);     // sits above the wordmark area
    solarGroup.rotation.x = Math.PI / 2.25; // tilt so orbits read as vertical ellipses, not a flat disc
    solarGroup.rotation.z = 0.12;           // slight diagonal for dynamism
    scene.add(solarGroup);

    // Sun
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd64a })
    );
    solarGroup.add(sun);

    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(2.05, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9f2f, transparent: true, opacity: 0.16, side: THREE.BackSide })
    );
    solarGroup.add(sunGlow);

    const sunLight = new THREE.PointLight(0xffd64a, 2.2, 60);
    solarGroup.add(sunLight);
    scene.add(new THREE.AmbientLight(0x111133, 0.7));

    const PLANETS = [
      { radius:0.24, distance:3.0, color:0x8c6a4a, speed:1.60, tilt:0.03 },
      { radius:0.34, distance:4.2, color:0xe8b96a, speed:1.17, tilt:0.04 },
      { radius:0.37, distance:5.4, color:0x3a8ef6, speed:1.00, tilt:0.41 },
      { radius:0.27, distance:6.6, color:0xc1440e, speed:0.80, tilt:0.44 },
      { radius:0.78, distance:8.6, color:0xc88b3a, speed:0.43, tilt:0.05 },
      { radius:0.66, distance:10.8, color:0xe4d08a, speed:0.32, tilt:0.47, rings:true, ringColor:0xc8a86b },
      { radius:0.52, distance:12.8, color:0x7de8e8, speed:0.22, tilt:1.71, rings:true, ringColor:0x7de8e8 },
      { radius:0.50, distance:14.6, color:0x4b70dd, speed:0.18, tilt:0.49 },
    ];

    const planetMeshes = [];

    PLANETS.forEach((p) => {
      // Orbit path ring (visible line showing the orbit)
      const orbitGeo = new THREE.RingGeometry(p.distance - 0.012, p.distance + 0.012, 128);
      const orbitMat = new THREE.MeshBasicMaterial({ color:0xffffff, side:THREE.DoubleSide, transparent:true, opacity:0.1 });
      const orbitMesh = new THREE.Mesh(orbitGeo, orbitMat);
      orbitMesh.rotation.x = Math.PI / 2;
      solarGroup.add(orbitMesh);

      const pivot = new THREE.Group();
      solarGroup.add(pivot);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius, 22, 22),
        new THREE.MeshStandardMaterial({ color:p.color, roughness:0.85, metalness:0.1 })
      );
      mesh.position.x = p.distance;
      pivot.add(mesh);

      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.z = p.tilt;
      mesh.add(tiltGroup);

      if (p.rings) {
        const innerR = p.radius * 1.4, outerR = p.radius * 2.5;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(innerR, outerR, 64),
          new THREE.MeshBasicMaterial({ color:p.ringColor, side:THREE.DoubleSide, transparent:true, opacity:0.6 })
        );
        ring.rotation.x = Math.PI / 2.4;
        tiltGroup.add(ring);

        const innerRing = new THREE.Mesh(
          new THREE.RingGeometry(innerR * 0.86, innerR, 64),
          new THREE.MeshBasicMaterial({ color:p.ringColor, side:THREE.DoubleSide, transparent:true, opacity:0.3 })
        );
        tiltGroup.add(innerRing);
      }

      planetMeshes.push({ pivot, mesh, speed:p.speed, angle: Math.random() * Math.PI * 2 });
    });

    // ════════════════════════════════════════════════════════════════
    // PART 2 — Particle stars converging into the "VoidSync" wordmark
    // ════════════════════════════════════════════════════════════════
    const TEXT = "VoidSync";
    const SAMPLE_W = 1200, SAMPLE_H = 300;
    const txtCanvas = document.createElement("canvas");
    txtCanvas.width = SAMPLE_W;
    txtCanvas.height = SAMPLE_H;
    const ctx = txtCanvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SAMPLE_W, SAMPLE_H);
    ctx.fillStyle = "#fff";
    ctx.font = "900 200px Arial Black, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(TEXT, SAMPLE_W / 2, SAMPLE_H / 2 + 10);
    const imgData = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

    const candidates = [];
    const STEP = 2;
    for (let y = 0; y < SAMPLE_H; y += STEP) {
      for (let x = 0; x < SAMPLE_W; x += STEP) {
        const idx = (y * SAMPLE_W + x) * 4;
        if (imgData[idx] > 128) candidates.push({ x, y });
      }
    }

    const WORLD_WIDTH = 14;
    const scaleFactor = WORLD_WIDTH / SAMPLE_W;
    const WORDMARK_Y_OFFSET = -3.5; // lower portion of screen, below the solar system

    const TARGET_COUNT = Math.min(6500, candidates.length * 3);
    const vTargetsFinal = [];
    const vTargetsPuffy = [];

    for (let i = 0; i < TARGET_COUNT; i++) {
      const c = candidates[Math.floor(Math.random() * candidates.length)];
      const jx = c.x + (Math.random() - 0.5) * STEP * 1.4;
      const jy = c.y + (Math.random() - 0.5) * STEP * 1.4;

      const worldX = (jx - SAMPLE_W / 2) * scaleFactor;
      const worldY = -(jy - SAMPLE_H / 2) * scaleFactor + WORDMARK_Y_OFFSET;

      const finalPos = new THREE.Vector3(worldX, worldY, (Math.random() - 0.5) * 0.4);

      const dirFromCenter = new THREE.Vector3(worldX, worldY - WORDMARK_Y_OFFSET, 0);
      if (dirFromCenter.lengthSq() === 0) dirFromCenter.set(1, 0, 0);
      dirFromCenter.normalize();
      const puffyPos = finalPos.clone().addScaledVector(dirFromCenter, 0.35 + Math.random() * 0.3);
      puffyPos.z = finalPos.z + (Math.random() - 0.5) * 0.6;

      vTargetsFinal.push(finalPos);
      vTargetsPuffy.push(puffyPos);
    }

    const STAR_COUNT = vTargetsFinal.length;

    const startPositions = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = 16 + Math.random() * 26;
      startPositions.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) - 4,
        r * Math.cos(phi) * 0.6 - 5
      ));
    }

    const delays    = vTargetsFinal.map(() => Math.random() * 1.3);
    const durations = vTargetsFinal.map(() => 2.2 + Math.random() * 1.2);
    const sizes     = vTargetsFinal.map(() => 0.034 + Math.random() * 0.038);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizeAttr = new Float32Array(STAR_COUNT);

    const colorCyan = new THREE.Color(0x00e5ff);
    const colorMagenta = new THREE.Color(0xff2cf7);
    const colorWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < STAR_COUNT; i++) {
      const p = startPositions[i];
      positions[i*3] = p.x; positions[i*3+1] = p.y; positions[i*3+2] = p.z;
      const target = vTargetsFinal[i];
      const xRatio = (target.x / (WORLD_WIDTH / 2) + 1) / 2;
      const c = xRatio < 0.5
        ? colorWhite.clone().lerp(colorCyan, xRatio / 0.5)
        : colorCyan.clone().lerp(colorMagenta, (xRatio - 0.5) / 0.5);
      colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
      sizeAttr[i] = sizes[i];
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizeAttr, 1));

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 340.0 * uPixelRatio / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.0, d);
          float core = smoothstep(0.18, 0.0, d);
          vec3 col = vColor + core * 0.55;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const starPoints = new THREE.Points(geometry, starMaterial);
    scene.add(starPoints);

    // ── Ambient deep-space starfield (fills the whole scene) ────────
    const bgGeo = new THREE.BufferGeometry();
    const bgCount = 900;
    const bgPos = new Float32Array(bgCount * 3);
    for (let i = 0; i < bgCount; i++) {
      bgPos[i*3]   = (Math.random()-0.5) * 90;
      bgPos[i*3+1] = (Math.random()-0.5) * 90;
      bgPos[i*3+2] = -20 - Math.random()*60;
    }
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    const bgMat = new THREE.PointsMaterial({ color:0xffffff, size:0.05, transparent:true, opacity:0.35 });
    scene.add(new THREE.Points(bgGeo, bgMat));

    // ── Easing ───────────────────────────────────────────────────────
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const easeOutBack = (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    const easeInOutQuad = (t) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;

    let phase = "converge";
    let holdStart = null;
    let settleStart = null;
    const HOLD_DURATION = 0.5;
    const SETTLE_DURATION = 0.85;

    const clock = new THREE.Clock();
    let raf;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const posAttr = geometry.attributes.position;

      // Word-mark convergence animation
      if (phase === "converge") {
        let allArrived = true;
        for (let i = 0; i < STAR_COUNT; i++) {
          const localT = (t - delays[i]) / durations[i];
          if (localT < 1) allArrived = false;
          const clamped = Math.max(0, Math.min(1, localT));
          const eased = easeOutBack(clamped);
          const start = startPositions[i];
          const target = vTargetsPuffy[i];
          posAttr.array[i*3]   = start.x + (target.x - start.x) * eased;
          posAttr.array[i*3+1] = start.y + (target.y - start.y) * eased;
          posAttr.array[i*3+2] = start.z + (target.z - start.z) * easeOutCubic(clamped);
        }
        if (allArrived) { phase = "hold"; holdStart = t; }
      } else if (phase === "hold") {
        for (let i = 0; i < STAR_COUNT; i++) {
          const target = vTargetsPuffy[i];
          const jitter = Math.sin(t * 6 + i) * 0.018;
          posAttr.array[i*3]   = target.x + jitter;
          posAttr.array[i*3+1] = target.y + jitter * 0.6;
          posAttr.array[i*3+2] = target.z;
        }
        if (t - holdStart > HOLD_DURATION) { phase = "settle"; settleStart = t; }
      } else if (phase === "settle") {
        const clamped = Math.max(0, Math.min(1, (t - settleStart) / SETTLE_DURATION));
        const eased = easeInOutQuad(clamped);
        for (let i = 0; i < STAR_COUNT; i++) {
          const from = vTargetsPuffy[i];
          const to = vTargetsFinal[i];
          posAttr.array[i*3]   = from.x + (to.x - from.x) * eased;
          posAttr.array[i*3+1] = from.y + (to.y - from.y) * eased;
          posAttr.array[i*3+2] = from.z + (to.z - from.z) * eased;
        }
        if (clamped >= 1) {
          phase = "settled";
          setShowTagline(true);
          if (onWordFormed) onWordFormed();
        }
      } else if (phase === "settled") {
        const pulse = 1 + Math.sin(t * 2.2) * 0.025;
        starPoints.scale.setScalar(pulse);
      }
      posAttr.needsUpdate = true;

      // Solar system: continuously orbits the whole time, never stops
      sun.scale.setScalar(1 + Math.sin(t * 1.8) * 0.04);
      sunGlow.material.opacity = 0.12 + Math.sin(t * 1.2) * 0.05;
      planetMeshes.forEach((p) => {
        p.angle += p.speed * 0.006;
        p.pivot.rotation.y = p.angle;
        p.mesh.rotation.y += 0.01 * p.speed;
      });

      // Gentle camera drift
      camera.position.x = Math.sin(t * 0.07) * 1.4;
      camera.position.y = 2 + Math.cos(t * 0.05) * 0.6;
      camera.lookAt(0, 2, 0);

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geometry.dispose();
      starMaterial.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, background:"#03010a", zIndex:999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", overflow:"hidden" }}>
      <div ref={ref} style={{ position:"absolute", inset:0 }} />

      {/* Tagline sits below the star-formed wordmark, near the bottom */}
      <p style={{
        position:"relative", zIndex:1, marginBottom:"8vh",
        fontFamily:"'Courier New',monospace", fontSize:"0.75rem",
        color:"rgba(240,244,255,0.45)", letterSpacing:"0.18em", textTransform:"uppercase",
        opacity: showTagline ? 1 : 0,
        transition:"opacity 0.8s ease 0.2s",
      }}>
        {message}
      </p>
    </div>
  );
}
