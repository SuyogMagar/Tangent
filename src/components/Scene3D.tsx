import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { useRef, Suspense, useMemo } from "react";
import * as THREE from "three";
import { useScroll, MotionValue } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Carbon Thread Orb → Infinite Unravel                               */
/*  - Sphere of wound carbon thread rises from below                   */
/*  - Slowly spins                                                     */
/*  - Unravels from center as user scrolls                             */
/*  - Single continuous fiber extends to the right                     */
/*  - Fiber morphs through ribbon / weave patterns                     */
/* ------------------------------------------------------------------ */

const PATH_SAMPLES = 360;
const TUBULAR = 340;
const RADIAL = 10;

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}

function ThreadOrb({
  scrollY,
  mouse,
}: {
  scrollY: MotionValue<number>;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const group = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.Mesh>(null!);
  const ghost = useRef<THREE.Mesh>(null!);
  const startRef = useRef<number | null>(null);
  const tmpPoints = useMemo(
    () => Array.from({ length: PATH_SAMPLES }, () => new THREE.Vector3()),
    [],
  );

  // Material — dark carbon with warm specular kick.
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0c0c10",
        metalness: 0.92,
        roughness: 0.28,
        envMapIntensity: 1.25,
      }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (startRef.current === null) startRef.current = t;
    const elapsed = t - startRef.current;

    // Rise-from-below intro (1.6s ease-out).
    const intro = Math.min(1, elapsed / 1.6);
    const introE = easeOutCubic(intro);

    const s = THREE.MathUtils.clamp(scrollY.get(), 0, 1);

    // What fraction of the thread still wraps the sphere?
    // At s=0: ~92% wrapped. At s=1: ~12% wrapped (rest streams right).
    const wrapEnd = THREE.MathUtils.lerp(0.92, 0.12, easeOutCubic(s));
    const R = THREE.MathUtils.lerp(1.0, 0.85, s); // sphere shrinks slightly as it unravels
    const windings = 22; // # of spiral wraps around the sphere

    // Extension length grows with scroll.
    const extLen = THREE.MathUtils.lerp(2.2, 7.5, s);
    // Ribbon flare grows with scroll → morphs the fiber outward.
    const flare = s;

    // Release point on sphere (where the fiber leaves the orb): equatorial right side.
    // Spin the sphere → release point migrates, but we compute it from spiral end so it's continuous.
    const spin = t * 0.18 + s * Math.PI * 0.4;

    for (let i = 0; i < PATH_SAMPLES; i++) {
      const u = i / (PATH_SAMPLES - 1);
      const p = tmpPoints[i];

      if (u <= wrapEnd) {
        // Spherical spiral (Fibonacci-ish wrap).
        const v = u / wrapEnd; // 0..1 along the wound portion
        const phi = Math.acos(1 - 2 * v); // 0..PI pole-to-pole
        const theta = windings * Math.PI * 2 * v + spin;
        p.set(
          R * Math.sin(phi) * Math.cos(theta),
          R * Math.cos(phi),
          R * Math.sin(phi) * Math.sin(theta),
        );
      } else {
        // Extension: leaves the equator on the right and flows outward.
        const v = (u - wrapEnd) / (1 - wrapEnd); // 0..1 along extension
        // Anchor at sphere equator-right so it visibly "uncoils".
        const anchorX = R;
        const anchorY = 0;
        const anchorZ = 0;
        // Outward flowing curve.
        const x = anchorX + v * extLen;
        const wave = Math.sin(v * Math.PI * 3 + t * 1.1) * 0.35 * v;
        const wave2 = Math.cos(v * Math.PI * 4 + t * 0.7) * 0.25 * v;
        const y = anchorY + wave * (0.5 + flare * 0.8);
        const z = anchorZ + wave2 * (0.4 + flare * 0.9);
        // Ribbon flare: gentle vertical fanning the further it travels.
        const fan = Math.sin(v * Math.PI) * flare * 0.45;
        p.set(x, y + fan * 0.2, z - fan * 0.1);
      }
    }

    // Build a fresh tube along the path.
    const curve = new THREE.CatmullRomCurve3(tmpPoints, false, "catmullrom", 0.5);
    const radius = THREE.MathUtils.lerp(0.022, 0.03, s);
    const newGeom = new THREE.TubeGeometry(curve, TUBULAR, radius, RADIAL, false);
    if (mesh.current) {
      mesh.current.geometry.dispose();
      mesh.current.geometry = newGeom;
    }

    // Ghost wireframe sphere — fades out as the orb unravels.
    if (ghost.current) {
      const gm = ghost.current.material as THREE.MeshBasicMaterial;
      gm.opacity = (1 - s) * 0.08 * introE;
      ghost.current.scale.setScalar(R);
    }

    // Group transforms: rise from below + mouse parallax + slow drift.
    if (group.current) {
      const riseY = THREE.MathUtils.lerp(-3.4, 0, introE);
      group.current.position.set(
        mouse.current.x * 0.18,
        riseY + mouse.current.y * 0.12 + Math.sin(t * 0.6) * 0.04,
        0,
      );
      group.current.rotation.y = mouse.current.x * 0.25 + t * 0.05;
      group.current.rotation.x = -mouse.current.y * 0.18;
      group.current.scale.setScalar(introE);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={mesh} material={material} castShadow>
        <bufferGeometry />
      </mesh>
      {/* Faint wireframe orb hint */}
      <mesh ref={ghost}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#ffb066" wireframe transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Camera                                                             */
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
    const z = THREE.MathUtils.lerp(4.2, 6.2, s);
    const x = THREE.MathUtils.lerp(0, 1.1, s) + mouse.current.x * 0.2;
    const y = mouse.current.y * 0.18;
    state.camera.position.lerp(new THREE.Vector3(x, y, z), 0.06);
    state.camera.lookAt(THREE.MathUtils.lerp(0, 1.6, s), 0, 0);
  });
  return null;
}

export function Scene3D() {
  const { scrollYProgress } = useScroll();
  const mouse = useRef({ x: 0, y: 0 });

  if (typeof window !== "undefined" && !(window as any).__tangentMouseBound) {
    window.addEventListener("mousemove", (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    });
    (window as any).__tangentMouseBound = true;
  }

  return (
    <div className="fixed inset-0 -z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <CameraRig scrollY={scrollYProgress} mouse={mouse} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[4, 5, 4]} intensity={1.3} color="#ffd9a8" />
          <directionalLight position={[-4, -2, -3]} intensity={0.6} color="#5fb8d6" />
          <pointLight position={[2, 0, 2]} intensity={1.6} color="#ffb066" distance={10} />
          <pointLight position={[-2, 1, 1]} intensity={1.0} color="#5fb8d6" distance={8} />

          <ThreadOrb scrollY={scrollYProgress} mouse={mouse} />

          <Environment preset="warehouse" />
        </Suspense>
      </Canvas>
    </div>
  );
}
