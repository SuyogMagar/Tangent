import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { useRef, Suspense, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { useScroll, MotionValue, motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Carbon HexSphere — procedural buckyball-like lattice.              */
/*  - Hexagonal faces mapped over a sphere                             */
/*  - Pops up from below, spins FAST for ~2.5s, eases into slow spin   */
/*  - Dual annotation pointers appear once spin slows                  */
/*  - On scroll, orb slides RIGHT and distorts per section             */
/* ------------------------------------------------------------------ */

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function HexSphere({
  scrollY,
  mouse,
  onSettled,
}: {
  scrollY: MotionValue<number>;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
  onSettled: () => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const ghost = useRef<THREE.Mesh>(null!);
  const startRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const spinRef = useRef(0);

  const COUNT = 360;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Fibonacci sphere point distribution
  const basePoints = useMemo(() => {
    const pts = [];
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#111115",
        metalness: 0.95,
        roughness: 0.2,
        envMapIntensity: 1.5,
      }),
    [],
  );

  const hexGeometry = useMemo(() => {
    // A hexagon cylinder
    return new THREE.CylinderGeometry(0.075, 0.075, 0.015, 6);
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (startRef.current === null) startRef.current = t;
    const elapsed = t - startRef.current;

    // Intro rise (1.4s)
    const intro = Math.min(1, elapsed / 1.4);
    const introE = easeOutCubic(intro);

    // Spin profile
    let spinSpeed: number;
    if (elapsed < 0.8) {
      spinSpeed = THREE.MathUtils.lerp(0.3, 12.0, easeOutCubic(elapsed / 0.8));
    } else if (elapsed < 1.5) {
      spinSpeed = 12.0;
    } else if (elapsed < 2.5) {
      const k = (elapsed - 1.5) / 1.0;
      spinSpeed = THREE.MathUtils.lerp(12.0, 0.25, easeInOutCubic(k));
      if (!settledRef.current && k > 0.85) {
        settledRef.current = true;
        onSettled();
      }
    } else {
      spinSpeed = 0.25;
    }
    const dt = lastTRef.current === null ? 0.016 : Math.min(0.05, t - lastTRef.current);
    lastTRef.current = t;
    spinRef.current += spinSpeed * dt;

    const s = THREE.MathUtils.clamp(scrollY.get(), 0, 1);
    
    // Shape morph driven by scroll (disabled, stays a sphere)
    const shape = s;
    const R = 1.0;
    const oblate = 1.0;
    const elongate = 1.0;
    const knot = 0.0;

    if (mesh.current) {
      const center = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < COUNT; i++) {
        const p = basePoints[i];

        let x = p.x * R * elongate;
        let y = p.y * R * oblate;
        let z = p.z * R;

        if (knot > 0.01) {
          const u = (p.y + 1) / 2;
          const a = Math.sin(u * Math.PI * 4 + spinRef.current * 0.6) * 0.15 * knot;
          const b = Math.cos(u * Math.PI * 3 + spinRef.current * 0.4) * 0.12 * knot;
          x += a;
          y += b * 0.6;
          z += a * 0.5;
        }

        dummy.position.set(x, y, z);
        
        // Orient the hexagon face to point outward from center
        dummy.lookAt(center);
        dummy.rotateX(Math.PI / 2);
        
        // Add subtle rotation based on scroll for extra cool effect
        dummy.rotateY(spinRef.current * 0.1 + p.x * knot);
        
        // Scale down slightly to look denser or fragmented during morph
        const scale = 1 - knot * 0.15;
        dummy.scale.setScalar(scale);

        dummy.updateMatrix();
        mesh.current.setMatrixAt(i, dummy.matrix);
      }
      mesh.current.instanceMatrix.needsUpdate = true;
    }

    if (ghost.current) {
      const gm = ghost.current.material as THREE.MeshBasicMaterial;
      gm.opacity = 0.04 * introE * (1 - s * 0.5);
      ghost.current.scale.set(R * elongate * 0.98, R * oblate * 0.98, R * 0.98);
    }

    if (group.current) {
      const riseY = THREE.MathUtils.lerp(-3.4, 0, introE);
      // Object stays in the middle initially, slides right on scroll
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
      <instancedMesh ref={mesh} args={[hexGeometry, material, COUNT]} castShadow receiveShadow />
      <mesh ref={ghost}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#ffb066" wireframe transparent opacity={0.04} />
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
    const z = 4.2; // Keep constant distance, do not zoom out on scroll
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

            <HexSphere
              scrollY={scrollYProgress}
              mouse={mouse}
              onSettled={() => setSettled(true)}
            />

            <Environment preset="warehouse" />
          </Suspense>
        </Canvas>
      </div>

      <AnnotationPointers show={showLabel} />
    </>
  );
}

function CustomPointer({
  show,
  startX,
  startY,
  endX,
  endY,
  labelLeft,
  labelTop,
  alignRight,
  delay = 0,
  children,
}: {
  show: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  labelLeft: string;
  labelTop: string;
  alignRight?: boolean;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <motion.line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="oklch(0.85 0.13 75)"
              strokeWidth="0.25"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut", delay }}
            />
            <motion.circle
              cx={startX}
              cy={startY}
              r="0.8"
              fill="oklch(0.85 0.13 75)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: delay + 0.7 }}
            />
          </svg>
          <motion.div
            initial={{ opacity: 0, x: alignRight ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.85, duration: 0.5 }}
            className="absolute"
            style={{
              left: labelLeft,
              top: labelTop,
              textAlign: alignRight ? "right" : "left",
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AnnotationPointers({ show }: { show: boolean }) {
  return (
    <div className="fixed inset-0 -z-0 pointer-events-none flex items-center justify-center">
      <div className="relative w-[520px] h-[520px] max-w-[80vw] max-h-[80vw]">
        
        {/* Pointer 1: Carbon element - Top Right */}
        <CustomPointer
          show={show}
          startX={64}
          startY={36}
          endX={105}
          endY={5}
          labelLeft="calc(105% + 12px)"
          labelTop="0%"
        >
          <div className="w-[300px]">
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
          </div>
        </CustomPointer>

        {/* Pointer 2: Brand/Product details - Bottom Right */}
        <CustomPointer
          show={show}
          delay={0.4}
          startX={64}
          startY={64}
          endX={105}
          endY={95}
          labelLeft="calc(105% + 16px)"
          labelTop="92%"
        >
          <div className="w-[380px]">
            <div
              className="text-[10px] uppercase tracking-[0.35em] text-accent mb-2"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              One fiber · Infinite applications
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed mb-4">
              Tangent crafts aerospace-grade carbon fiber and high-purity specialty
              chemicals for the industries shaping tomorrow.
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground/80 font-mono">
              <div className="text-foreground/90 font-medium">T-1100 / 12K</div>
              <div>6.4 GPa tensile · 350 GPa modulus</div>
              <div>ISO-9001 · 99.99% purity</div>
            </div>
          </div>
        </CustomPointer>
        
      </div>
    </div>
  );
}
