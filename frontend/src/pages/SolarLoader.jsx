import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function SolarLoader({ message = "Syncing with the Void…" }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const W = el.clientWidth, H = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    camera.position.set(0, 18, 38);
    camera.lookAt(0, 0, 0);

    // ── Starfield ──────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(3000);
    for (let i = 0; i < 3000; i++) {
      starPositions[i] = (Math.random() - 0.5) * 300;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.7 })));

    // ── Sun ────────────────────────────────────────────────────────
    const sunGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd64a });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    // Sun glow
    const glowGeo = new THREE.SphereGeometry(3.2, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff9f2f, transparent: true, opacity: 0.15, side: THREE.BackSide });
    scene.add(new THREE.Mesh(glowGeo, glowMat));

    // Sun point light
    const sunLight = new THREE.PointLight(0xffd64a, 2.5, 80);
    scene.add(sunLight);

    // Ambient
    scene.add(new THREE.AmbientLight(0x111133, 0.8));

    // ── Planet definitions ─────────────────────────────────────────
    // { radius, distance, color, speed, tilt, rings, ringColor }
    const PLANETS = [
      { radius: 0.38, distance: 5.0,  color: 0x8c6a4a, speed: 1.60, tilt: 0.03  },                              // Mercury
      { radius: 0.55, distance: 7.2,  color: 0xe8b96a, speed: 1.17, tilt: 0.04  },                              // Venus
      { radius: 0.60, distance: 9.5,  color: 0x3a8ef6, speed: 1.00, tilt: 0.41  },                              // Earth
      { radius: 0.42, distance: 11.8, color: 0xc1440e, speed: 0.80, tilt: 0.44  },                              // Mars
      { radius: 1.30, distance: 15.5, color: 0xc88b3a, speed: 0.43, tilt: 0.05  },                              // Jupiter
      { radius: 1.10, distance: 19.5, color: 0xe4d08a, speed: 0.32, tilt: 0.47, rings: true, ringColor: 0xc8a86b }, // Saturn
      { radius: 0.85, distance: 23.0, color: 0x7de8e8, speed: 0.22, tilt: 1.71, rings: true, ringColor: 0x7de8e8 }, // Uranus
      { radius: 0.80, distance: 26.5, color: 0x4b70dd, speed: 0.18, tilt: 0.49  },                              // Neptune
    ];

    const planetMeshes = [];

    PLANETS.forEach((p) => {
      // Orbit ring (the circle showing the orbit path)
      const orbitGeo = new THREE.RingGeometry(p.distance - 0.015, p.distance + 0.015, 128);
      const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.08 });
      const orbitMesh = new THREE.Mesh(orbitGeo, orbitMat);
      orbitMesh.rotation.x = Math.PI / 2;
      scene.add(orbitMesh);

      // Planet pivot (orbit parent)
      const pivot = new THREE.Group();
      pivot.rotation.z = p.tilt * 0.1; // slight orbital inclination
      scene.add(pivot);

      // Planet sphere
      const geo = new THREE.SphereGeometry(p.radius, 24, 24);
      const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.85, metalness: 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = p.distance;
      pivot.add(mesh);

      // Axial tilt group
      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.z = p.tilt;
      mesh.add(tiltGroup);

      // Rings (Saturn + Uranus)
      if (p.rings) {
        const innerR = p.radius * 1.4;
        const outerR = p.radius * 2.4;
        const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: p.ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.55,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.4;
        tiltGroup.add(ring);

        // Thin inner ring
        const innerRingGeo = new THREE.RingGeometry(innerR * 0.88, innerR, 64);
        const innerRingMat = new THREE.MeshBasicMaterial({ color: p.ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
        tiltGroup.add(new THREE.Mesh(innerRingGeo, innerRingMat));
      }

      planetMeshes.push({ pivot, mesh, speed: p.speed, angle: Math.random() * Math.PI * 2 });
    });

    // ── Animation ─────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      // Sun pulse
      const s = 1 + Math.sin(t * 1.8) * 0.04;
      sun.scale.setScalar(s);
      glowMat.opacity = 0.10 + Math.sin(t * 1.2) * 0.06;

      // Orbit planets
      planetMeshes.forEach((p) => {
        p.angle += p.speed * 0.008;
        p.pivot.rotation.y = p.angle;
        // Self-rotation
        p.mesh.rotation.y += 0.012 * p.speed;
      });

      // Gentle camera drift
      camera.position.x = Math.sin(t * 0.06) * 4;
      camera.position.y = 18 + Math.sin(t * 0.04) * 2;
      camera.lookAt(0, 0, 0);

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
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, background:"#03010a", zIndex:999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <div ref={ref} style={{ position:"absolute", inset:0 }} />

      {/* Overlay text */}
      <div style={{ position:"relative", zIndex:1, textAlign:"center", pointerEvents:"none" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"0.6rem", marginBottom:"0.5rem" }}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:"radial-gradient(circle at 35% 35%,#fff,#00e5ff)", boxShadow:"0 0 16px #00e5ff" }} />
          <span style={{ fontFamily:"'Arial Black','Impact',sans-serif", fontSize:"1.6rem", fontWeight:900, background:"linear-gradient(135deg,#fff 30%,#00e5ff 70%,#ff2cf7)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", letterSpacing:"-0.02em" }}>
            VoidSync
          </span>
        </div>
        <p style={{ fontFamily:"'Courier New',monospace", fontSize:"0.75rem", color:"rgba(240,244,255,0.45)", letterSpacing:"0.18em", textTransform:"uppercase", margin:0 }}>
          {message}
        </p>
      </div>
    </div>
  );
}
