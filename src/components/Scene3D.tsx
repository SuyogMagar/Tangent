import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { useRef, Suspense, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { useScroll, MotionValue, motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Carbon Thread Orb — wound spherical thread, no tail.               */
/*  - Pops up from below, spins FAST for ~2.5s, eases into slow spin   */
/*  - Annotation pointer appears once spin slows                       */
/*  - On scroll, orb slides RIGHT and morphs per section               */
/* ------------------------------------------------------------------ */

const PATH_SAMPLES = 420;
const TUBULAR = 380;
const RADIAL = 10;

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function ThreadOrb({
  scrollY,
  mouse,
  onSettled,
}: {
  scrollY: MotionValue<number>;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
  onSettled: () => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.Mesh>(null!);
  const ghost = useRef<THREE.Mesh>(null!);
  const startRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const spinRef = useRef(0);

  const tmpPoints = useMemo(
    () => Array.from({ length: PATH_SAMPLES }, () => new THREE.Vector3()),
    [],
  );

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

    // Intro rise (1.4s)
    const intro = Math.min(1, elapsed / 1.4);
    const introE = easeOutCubic(intro);

    // Spin profile:
    //  0 .. 1.4s : ramp up to fast
    //  1.4 .. 3.8s : FAST spin
    //  3.8 .. 5.4s : ease down to slow
    //  > 5.4s : steady slow
    let spinSpeed: number;
    if (elapsed < 1.4) {
      spinSpeed = THREE.MathUtils.lerp(0.3, 3.2, easeOutCubic(elapsed / 1.4));
    } else if (elapsed < 3.8) {
      spinSpeed = 3.2;
    } else if (elapsed < 5.4) {
      const k = (elapsed - 3.8) / 1.6;
      spinSpeed = THREE.MathUtils.lerp(3.2, 0.25, easeInOutCubic(k));
      if (!settledRef.current && k > 0.85) {
        settledRef.current = true;
        onSettled();
      }
    } else {
      spinSpeed = 0.25;
    }
    spinRef.current += spinSpeed * state.clock.getDelta() ;
    // getDelta() can be 0 in some setups; fallback with frame timing:
    if (!isFinite(spinRef.current) || spinRef.current === 0) {
      spinRef.current = t * 0.25;
    }

    const s = THREE.MathUtils.clamp(scrollY.get(), 0, 1);

    // Shape morph driven by scroll: 0 sphere, 0.33 oblate, 0.66 capsule, 1 tight knot
    const shape = s;
    const R = THREE.MathUtils.lerp(1.0, 0.78, shape);
    const oblate = 1 - shape * 0.55; // squash Y as we scroll
    const elongate = 1 + shape * 0.4; // stretch X subtly
    const knot = shape; // adds twist deformation
    const windings = THREE.MathUtils.lerp(22, 34, shape);

    for (let i = 0; i < PATH_SAMPLES; i++) {
      const u = i / (PATH_SAMPLES - 1);
      const p = tmpPoints[i];

      // Closed spherical spiral — no extension/tail.
      const phi = Math.acos(1 - 2 * u);
      const theta = windings * Math.PI * 2 * u;
      let x = R * Math.sin(phi) * Math.cos(theta) * elongate;
      let y = R * Math.cos(phi) * oblate;
      let z = R * Math.sin(phi) * Math.sin(theta);

      // Knot deformation as we scroll deeper
      if (knot > 0.01) {
        const a = Math.sin(u * Math.PI * 4 + spinRef.current * 0.6) * 0.15 * knot;
        const b = Math.cos(u * Math.PI * 3 + spinRef.current * 0.4) * 0.12 * knot;
        x += a;
        y += b * 0.6;
        z += a * 0.5;
      }
      p.set(x, y, z);
    }

    const curve = new THREE.CatmullRomCurve3(tmpPoints, true, "catmullrom", 0.5);
    const radius = THREE.MathUtils.lerp(0.022, 0.028, shape);
    const newGeom = new THREE.TubeGeometry(curve, TUBULAR, radius, RADIAL, true);
    if (mesh.current) {
      mesh.current.geometry.dispose();
      mesh.current.geometry = newGeom;
    }

    if (ghost.current) {
      const gm = ghost.current.material as THREE.MeshBasicMaterial;
      gm.opacity = 0.06 * introE * (1 - s * 0.7);
      ghost.current.scale.set(R * elongate, R * oblate, R);
    }

    if (group.current) {
      const riseY = THREE.MathUtils.lerp(-3.4, 0, introE);
      // Slide to the right as user scrolls.
      const baseX = THREE.MathUtils.lerp(0, 1.9, easeInOutCubic(s));
      group.current.position.set(
        baseX + mouse.current.x * 0.12,
        riseY + mouse.current.y * 0.1 + Math.sin(t * 0.6) * 0.03,
        0,
      );
      group.current.rotation.y = spinRef.current + mouse.current.x * 0.2;
      group.current.rotation.x = Math.sin(spinRef.current * 0.3) * 0.15 - mouse.current.y * 0.15;
      group.current.scale.setScalar(introE);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={mesh} material={material} castShadow>
        <bufferGeometry />
      </mesh>
      <mesh ref={ghost}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#ffb066" wireframe transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

function CameraRig({
  scrollY,
  mouse,
}: {
  scrollY: MotionValue<number>;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
}) {
  useFrame((state) => {
    const s = scrollY.get();
    const z = THREE.MathUtils.lerp(4.2, 5.6, s);
    const x = mouse.current.x * 0.15;
    const y = mouse.current.y * 0.12;
    state.camera.position.lerp(new THREE.Vector3(x, y, z), 0.06);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function Scene3D() {
  const { scrollYProgress } = useScroll();
  const mouse = useRef({ x: 0, y: 0 });
  const [settled, setSettled] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const showLabel = settled && !scrolled;

  return (
    <>
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

            <ThreadOrb
              scrollY={scrollYProgress}
              mouse={mouse}
              onSettled={() => setSettled(true)}
            />

            <Environment preset="warehouse" />
          </Suspense>
        </Canvas>
      </div>

      {/* Annotation pointer — appears once the orb slows */}
      <AnnotationPointer show={showLabel} />
    </>
  );
}

function AnnotationPointer({ show }: { show: boolean }) {
  return (
    <div className="fixed inset-0 -z-0 pointer-events-none flex items-center justify-center">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="relative w-[520px] h-[520px] max-w-[80vw] max-h-[80vw]"
          >
            {/* line */}
            <svg
              className="absolute inset-0 w-full h-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <motion.line
                x1="62"
                y1="38"
                x2="92"
                y2="14"
                stroke="oklch(0.85 0.13 75)"
                strokeWidth="0.25"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <motion.circle
                cx="62"
                cy="38"
                r="0.8"
                fill="oklch(0.85 0.13 75)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7 }}
              />
            </svg>
            {/* label */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.85, duration: 0.5 }}
              className="absolute"
              style={{ left: "calc(92% + 8px)", top: "10%" }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.35em] text-primary/80"
                style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
              >
                Element · C
              </div>
              <div
                className="text-base text-foreground/95 mt-1 whitespace-nowrap"
                style={{ fontFamily: "'Orbitron', 'Space Grotesk', sans-serif", letterSpacing: "0.08em" }}
              >
                Carbon · Atomic No. 6
              </div>
              <div className="text-xs text-muted-foreground mt-1 whitespace-nowrap">
                Foundation of every Tangent carbon fiber.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
