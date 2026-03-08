"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Mombasa coordinates
const MOMBASA_LAT = -4.0435;
const MOMBASA_LON = 39.6682;
const GLOBE_RADIUS = 2;

/** Convert lat/lon to 3D position on sphere surface */
function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** Build a canvas texture showing a stylised dark-mode world map */
function buildEarthTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Ocean background
  ctx.fillStyle = "#030b1a";
  ctx.fillRect(0, 0, W, H);

  // Helper: draw a simplified continent from lon/lat point arrays
  const drawLand = (
    points: [number, number][],
    fillColor: string,
    strokeColor: string
  ) => {
    ctx.beginPath();
    points.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // Africa (simplified key points)
  drawLand(
    [
      [-17, 15], [-15, 11], [-12, 7], [-8, 5], [-5, 5],
      [0, 5], [5, 4], [8, 4], [10, 2], [10, -2], [10, -5],
      [13, -8], [12, -15], [10, -20], [12, -25], [18, -30],
      [20, -35], [25, -34], [30, -30], [35, -25], [38, -20],
      [40, -12], [42, -10], [44, -8], [45, -5], [45, 0],
      [45, 5], [43, 12], [42, 15], [38, 18], [35, 20],
      [30, 22], [25, 23], [20, 22], [15, 22], [10, 22],
      [5, 15], [0, 15], [-5, 15], [-10, 15], [-15, 15], [-17, 15],
    ],
    "#0d2a1e",
    "#1a4a32"
  );

  // East Africa highlight (Kenya/Tanzania region)
  drawLand(
    [
      [33, 5], [38, 5], [42, 2], [44, -2], [44, -8],
      [40, -12], [38, -12], [35, -10], [33, -8],
      [30, -5], [30, 0], [30, 3], [32, 5], [33, 5],
    ],
    "#0f3825",
    "#1f6040"
  );

  // Europe (simplified)
  drawLand(
    [
      [-10, 36], [-5, 36], [0, 37], [5, 43], [10, 44], [15, 45],
      [20, 48], [25, 50], [30, 52], [28, 58], [22, 60],
      [15, 60], [8, 58], [4, 56], [0, 50], [-3, 47],
      [-8, 44], [-10, 40], [-10, 36],
    ],
    "#0a1e2a",
    "#112838"
  );

  // Asia (simplified chunk)
  drawLand(
    [
      [30, 52], [40, 55], [60, 55], [80, 55], [100, 52],
      [110, 45], [120, 40], [125, 35], [120, 25],
      [110, 18], [100, 5], [95, 5], [80, 10],
      [70, 22], [60, 22], [50, 25], [40, 38],
      [35, 42], [30, 50], [30, 52],
    ],
    "#0a1e2a",
    "#112838"
  );

  // North America (simplified)
  drawLand(
    [
      [-170, 65], [-155, 70], [-140, 70], [-130, 70],
      [-120, 60], [-110, 50], [-90, 50], [-80, 45],
      [-70, 45], [-65, 48], [-60, 47], [-55, 40],
      [-65, 35], [-70, 25], [-75, 20], [-80, 22],
      [-85, 20], [-90, 18], [-85, 15], [-80, 10],
      [-75, 10], [-68, 12], [-62, 12],
      [-62, 18], [-65, 22], [-70, 30],
      [-75, 35], [-80, 42], [-75, 50],
      [-85, 55], [-95, 60], [-110, 65],
      [-130, 68], [-150, 70], [-170, 65],
    ],
    "#0a1e2a",
    "#112838"
  );

  // South America (simplified)
  drawLand(
    [
      [-80, 10], [-75, 12], [-62, 12], [-62, 8], [-60, 5],
      [-52, 5], [-50, 0], [-50, -5], [-42, -15],
      [-38, -20], [-38, -25], [-42, -30],
      [-50, -35], [-55, -40], [-60, -50], [-65, -55],
      [-67, -55], [-70, -50], [-70, -45],
      [-65, -38], [-60, -30], [-55, -25],
      [-55, -15], [-58, -10], [-60, -5],
      [-65, 0], [-70, 5], [-75, 10], [-80, 10],
    ],
    "#0a1e2a",
    "#112838"
  );

  // Australia
  drawLand(
    [
      [115, -22], [120, -18], [130, -14], [138, -15],
      [143, -18], [148, -22], [152, -28], [152, -32],
      [148, -38], [145, -38], [140, -38], [135, -35],
      [128, -35], [120, -32], [115, -28], [115, -22],
    ],
    "#0a1e2a",
    "#112838"
  );

  // Glow around Mombasa on the texture
  const mombasaX = ((MOMBASA_LON + 180) / 360) * W;
  const mombasaY = ((90 - MOMBASA_LAT) / 180) * H;

  const grd = ctx.createRadialGradient(
    mombasaX, mombasaY, 2,
    mombasaX, mombasaY, 30
  );
  grd.addColorStop(0, "rgba(255, 140, 0, 0.9)");
  grd.addColorStop(0.3, "rgba(255, 100, 0, 0.5)");
  grd.addColorStop(1, "rgba(255, 60, 0, 0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(mombasaX, mombasaY, 30, 0, Math.PI * 2);
  ctx.fill();

  // Bright dot at Mombasa
  ctx.beginPath();
  ctx.arc(mombasaX, mombasaY, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ff9000";
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

export default function MombasaGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ──────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 6);

    // ── Starfield ─────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 200;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Earth Globe ───────────────────────────────────────────────
    const earthTex = buildEarthTexture();
    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTex,
      specular: new THREE.Color(0x111111),
      shininess: 8,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // ── Atmosphere glow ───────────────────────────────────────────
    const atmGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 32, 32);
    const atmMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(0.1, 0.5, 1.0, 1.0) * intensity;
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    // ── Mombasa marker ────────────────────────────────────────────
    const mombasaPos = latLonToVec3(MOMBASA_LAT, MOMBASA_LON, GLOBE_RADIUS);

    // Core bright sphere
    const markerGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xff9000 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.copy(mombasaPos);
    earth.add(marker);

    // Pulsing ring 1
    const ring1Geo = new THREE.RingGeometry(0.08, 0.11, 32);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.position.copy(mombasaPos.clone().multiplyScalar(1.01));
    ring1.lookAt(ring1.position.clone().multiplyScalar(2));
    earth.add(ring1);

    // Pulsing ring 2
    const ring2Geo = new THREE.RingGeometry(0.12, 0.15, 32);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.position.copy(mombasaPos.clone().multiplyScalar(1.01));
    ring2.lookAt(ring2.position.clone().multiplyScalar(2));
    earth.add(ring2);

    // Pulsing ring 3
    const ring3Geo = new THREE.RingGeometry(0.18, 0.21, 32);
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.position.copy(mombasaPos.clone().multiplyScalar(1.01));
    ring3.lookAt(ring3.position.clone().multiplyScalar(2));
    earth.add(ring3);

    // ── Spike from Mombasa outward ────────────────────────────────
    const spikeDir = mombasaPos.clone().normalize();
    const spikePts = [
      mombasaPos.clone(),
      mombasaPos.clone().addScaledVector(spikeDir, 0.55),
    ];
    const spikeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(spikePts),
      new THREE.LineBasicMaterial({ color: 0xff9000, transparent: true, opacity: 0.8 })
    );
    earth.add(spikeLine);

    // Tip sphere at end of spike
    const tipGeo = new THREE.SphereGeometry(0.035, 12, 12);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.copy(mombasaPos.clone().addScaledVector(spikeDir, 0.55));
    earth.add(tip);

    // ── Lights ────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x112233, 1.2);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // ── Orient globe so Mombasa faces camera ──────────────────────
    // Derived: for a point at lon to face camera (+z), rotation must be:
    //   α = PI/2 - (lon + 180) * PI/180
    earth.rotation.y = Math.PI / 2 - (MOMBASA_LON + 180) * (Math.PI / 180);

    // ── Auto-rotate ───────────────────────────────────────────────
    let animId: number;
    let elapsed = 0;

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);
      elapsed = time * 0.001;

      // Slow eastward rotation
      earth.rotation.y += 0.0015;

      // Pulse rings
      const pulse1 = 0.7 + 0.3 * Math.sin(elapsed * 3);
      const pulse2 = 0.6 + 0.4 * Math.sin(elapsed * 3 - 0.8);
      const pulse3 = 0.4 + 0.4 * Math.sin(elapsed * 3 - 1.6);
      ring1Mat.opacity = pulse1;
      ring1.scale.setScalar(0.85 + 0.3 * Math.sin(elapsed * 3));
      ring2Mat.opacity = pulse2;
      ring2.scale.setScalar(0.85 + 0.3 * Math.sin(elapsed * 3 - 0.8));
      ring3Mat.opacity = pulse3;
      ring3.scale.setScalar(0.85 + 0.3 * Math.sin(elapsed * 3 - 1.6));

      // Marker brightness pulse
      const brightness = 0.7 + 0.3 * Math.sin(elapsed * 5);
      (markerMat as THREE.MeshBasicMaterial).color.setRGB(1, brightness * 0.56, 0);
      (tipMat as THREE.MeshBasicMaterial).color.setRGB(1, brightness, 0);

      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);

    // ── Resize handler ────────────────────────────────────────────
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      earthTex.dispose();
    };
  }, []);

  return (
    <div
      data-testid="mombasa-globe"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "radial-gradient(ellipse at center, #040a18 0%, #000308 100%)",
      }}
    >
      {/* Three.js canvas mount */}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* Overlay info card */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(4, 14, 30, 0.88)",
          border: "1px solid rgba(255, 144, 0, 0.35)",
          borderRadius: 16,
          padding: "20px 32px",
          textAlign: "center",
          backdropFilter: "blur(18px)",
          boxShadow:
            "0 8px 48px rgba(0,0,0,0.8), 0 0 40px rgba(255,100,0,0.1)",
          pointerEvents: "none",
          minWidth: 260,
        }}
      >
        {/* Glow dot */}
        <div
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#ff9000",
            boxShadow: "0 0 12px 4px rgba(255,144,0,0.8), 0 0 24px 8px rgba(255,80,0,0.4)",
            marginBottom: 12,
            animation: "pulse-dot 1.5s ease-in-out infinite",
          }}
        />
        <h2
          style={{
            color: "#ffffff",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.04em",
            margin: "0 0 4px",
          }}
        >
          MOMBASA
        </h2>
        <p
          style={{
            color: "rgba(255,200,100,0.8)",
            fontSize: 13,
            margin: "0 0 12px",
            fontWeight: 500,
            letterSpacing: "0.08em",
          }}
        >
          KEŇA, VÝCHODNÍ AFRIKA
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 24px",
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          <span>🌐 {Math.abs(MOMBASA_LAT).toFixed(2)}° J</span>
          <span>📍 {MOMBASA_LON.toFixed(2)}° V</span>
          <span>👥 ~1.2M obyvatel</span>
          <span>🌊 Indický oceán</span>
        </div>
      </div>

      {/* CSS keyframe for pulsing dot */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 12px 4px rgba(255,144,0,0.8), 0 0 24px 8px rgba(255,80,0,0.4); }
          50%       { box-shadow: 0 0 20px 8px rgba(255,144,0,1),   0 0 40px 16px rgba(255,80,0,0.6); }
        }
      `}</style>
    </div>
  );
}
