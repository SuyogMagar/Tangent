import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { useRef, Suspense, useMemo } from "react";
import * as THREE from "three";
import { useScroll, useTransform, MotionValue } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Carbon Fiber Weave Ribbon                                          */
/*  - Raw fibers -> aligned -> woven -> aerospace sheet                */
/*  - Twists with scroll, reacts to mouse                              */
/* ------------------------------------------------------------------ */
function CarbonRibbon({
  scrollY,
  mouse,
}: {
  scrollY: MotionValue<number>;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const group = useRef<THREE.Group>(null!);
  const STRANDS = 28;
  const SEGMENTS = 220;

  // Each strand: a tube along x with vertical offset; we'll modulate vertices.
  const strands = useMemo(() => {
    const arr: {
      geom: THREE.PlaneGeometry;
      basePositions: Float32Array;
      offset: number;
      seed: number;
    }[] = [];
    for (let i = 0; i < STRANDS; i++) {
      const geom = new THREE.PlaneGeometry(10, 0.05, SEGMENTS, 1);
      const basePositions = new Float32Array(geom.attributes.position.array);
      arr.push({
        geom,
        basePositions,
        offset: (i - STRANDS / 2) * 0.07,
        seed: Math.random() * 1000,
      });
    }
    return arr;
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const s = scrollY.get(); // 0..1

    // Phases: 0 raw -> 0.33 align -> 0.66 weave -> 1 sheet
    const alignPhase = THREE.MathUtils.smoothstep(s, 0.0, 0.35);
    const weavePhase = THREE.MathUtils.smoothstep(s, 0.3, 0.7);
    const sheetPhase = THREE.MathUtils.smoothstep(s, 0.65, 1.0);

    strands.forEach((strand, idx) => {
      const pos = strand.geom.attributes.position;
      const base = strand.basePositions;
      const isWarp = idx % 2 === 0;

      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const bx = base[ix];
        const by = base[ix + 1];

        const u = (bx + 5) / 10; // 0..1 along strand

        // RAW: chaotic noise scatter
        const rawX =
          bx + Math.sin(strand.seed + u * 14 + t * 0.8) * 0.6 * (1 - alignPhase);
        const rawY =
          by +
          strand.offset * 4 +
          Math.sin(strand.seed * 2 + u * 18 + t) * 0.9 * (1 - alignPhase) +
          Math.cos(strand.seed + u * 9 + t * 0.7) * 0.5 * (1 - alignPhase);
        const rawZ =
          Math.sin(strand.seed * 0.7 + u * 11 + t * 0.6) *
          1.2 *
          (1 - alignPhase);

        // ALIGN: pull toward straight line at offset
        const alignY = strand.offset;
        const alignZ = 0;

        // WEAVE: sinusoidal over/under
        const weaveAmp = 0.06 * weavePhase * (1 - sheetPhase * 0.7);
        const weaveZ =
          Math.sin(u * Math.PI * 16 + (isWarp ? 0 : Math.PI)) * weaveAmp;

        // SHEET: flatten completely, slight panel curvature
        const sheetY = strand.offset * (1 - sheetPhase * 0.05);
        const panelCurve = Math.sin(u * Math.PI) * 0.08 * sheetPhase;

        const finalX = THREE.MathUtils.lerp(rawX, bx, alignPhase);
        const finalY =
          THREE.MathUtils.lerp(rawY, alignY, alignPhase) * (1 - sheetPhase) +
          sheetY * sheetPhase;
        const finalZ =
          THREE.MathUtils.lerp(rawZ, alignZ, alignPhase) +
          weaveZ +
          panelCurve;

        pos.array[ix] = finalX;
        pos.array[ix + 1] = finalY;
        pos.array[ix + 2] = finalZ;
      }
      pos.needsUpdate = true;
      strand.geom.computeVertexNormals();
    });

    if (group.current) {
      // Ribbon length runs along world Z (down the tunnel axis).
      // Base orientation: rotate Y by 90° so the plane's long X-axis becomes Z.
      const twist = s * Math.PI * 1.6;
      group.current.rotation.y = Math.PI / 2 + mouse.current.x * 0.15 + s * 0.2;
      group.current.rotation.x = mouse.current.y * 0.12 + Math.sin(t * 0.3) * 0.03;
      group.current.rotation.z = twist * 0.5; // twist around the tunnel axis
      group.current.position.set(0, 0, -4 + s * 2);
    }
  });

  return (
    <group ref={group}>
      {strands.map((strand, i) => (
        <mesh key={i} geometry={strand.geom}>
          <meshStandardMaterial
            color={i % 2 === 0 ? "#0e0e12" : "#1a1a22"}
            metalness={0.85}
            roughness={0.32}
            envMapIntensity={1.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Infinite Carbon Fiber Tunnel                                       */
/*  - Endless tube; camera flies through with scroll                   */
/*  - Glowing edge rings, industrial lighting                          */
/* ------------------------------------------------------------------ */
function CarbonTunnel({ scrollY }: { scrollY: MotionValue<number> }) {
  const tunnel = useRef<THREE.Mesh>(null!);
  const rings = useRef<THREE.Group>(null!);

  // Carbon weave texture procedurally via canvas
  const weaveTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#08080b";
    ctx.fillRect(0, 0, 256, 256);
    const cell = 16;
    for (let y = 0; y < 256; y += cell) {
      for (let x = 0; x < 256; x += cell) {
        const odd = ((x / cell) + (y / cell)) % 2 === 0;
        ctx.fillStyle = odd ? "#16161d" : "#0c0c11";
        ctx.fillRect(x, y, cell, cell);
        // strand highlight
        ctx.strokeStyle = "rgba(255,180,110,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (odd) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cell, y + cell);
        } else {
          ctx.moveTo(x + cell, y);
          ctx.lineTo(x, y + cell);
        }
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 4);
    tex.anisotropy = 8;
    return tex;
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const s = scrollY.get();
    if (tunnel.current) {
      const mat = tunnel.current.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.offset.x = -t * 0.04 - s * 1.5;
      }
      tunnel.current.rotation.z = t * 0.05 + s * 0.8;
    }
    if (rings.current) {
      rings.current.children.forEach((ring, i) => {
        const r = ring as THREE.Mesh;
        // move rings toward camera, recycle
        r.position.z = ((i / rings.current.children.length) * 40 + t * 4 + s * 20) % 40 - 30;
        const mat = r.material as THREE.MeshBasicMaterial;
        const fade = Math.max(0, 1 - Math.abs(r.position.z + 5) / 15);
        mat.opacity = fade * 0.9;
      });
    }
  });

  const ringCount = 14;
  return (
    <group position={[0, 0, 0]}>
      {/* Tunnel interior */}
      <mesh ref={tunnel} rotation={[0, 0, 0]} position={[0, 0, -10]}>
        <cylinderGeometry args={[3.2, 3.2, 60, 64, 1, true]} />
        <meshStandardMaterial
          map={weaveTexture}
          side={THREE.BackSide}
          metalness={0.9}
          roughness={0.35}
          color="#ffffff"
        />
      </mesh>

      {/* Glowing edge rings */}
      <group ref={rings}>
        {Array.from({ length: ringCount }).map((_, i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <torusGeometry args={[3.15, 0.012, 8, 96]} />
            <meshBasicMaterial color="#ffb066" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Camera rig — flies through tunnel, pulls back for ribbon hero      */
/* ------------------------------------------------------------------ */
function CameraRig({
  scrollY,
  mouse,
}: {
  scrollY: MotionValue<number>;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
}) {
  useFrame((state) => {
    const s = scrollY.get();
    // Hero: inside tunnel; mid: pull out to see ribbon; end: close up on sheet
    const z = THREE.MathUtils.lerp(1.5, 4.2, s);
    const y = THREE.MathUtils.lerp(0, 0.2, s) + mouse.current.y * 0.15;
    const x = mouse.current.x * 0.3;
    state.camera.position.set(x, y, z);
    state.camera.lookAt(0, 0, -2);
  });
  return null;
}

export function Scene3D() {
  const { scrollYProgress } = useScroll();
  const mouse = useRef({ x: 0, y: 0 });

  if (typeof window !== "undefined") {
    // Track mouse globally; canvas div is pointer-events-none.
    (window as any).__tangentMouseBound ||
      (window.addEventListener("mousemove", (e: MouseEvent) => {
        mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
      }),
      ((window as any).__tangentMouseBound = true));
  }

  return (
    <div className="fixed inset-0 -z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 1.5], fov: 55 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <CameraRig scrollY={scrollYProgress} mouse={mouse} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[4, 5, 4]} intensity={1.2} color="#ffd9a8" />
          <directionalLight position={[-4, -2, -3]} intensity={0.55} color="#5fb8d6" />
          <pointLight position={[0, 0, -2]} intensity={2.2} color="#ffb066" distance={8} />
          <pointLight position={[0, 0, 2]} intensity={1.4} color="#5fb8d6" distance={6} />

          <CarbonTunnel scrollY={scrollYProgress} />
          <CarbonRibbon scrollY={scrollYProgress} mouse={mouse} />

          <Environment preset="warehouse" />
        </Suspense>
      </Canvas>
    </div>
  );
}
