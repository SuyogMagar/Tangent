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

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+";

export function ScrambleText({ text, show, delay = 0, className, style }: { text: string; show: boolean; delay?: number; className?: string; style?: React.CSSProperties }) {
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    if (!show) {
      setDisplayText(text);
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    let frameId: number;
    let iteration = 0;

    timeout = setTimeout(() => {
      const animate = () => {
        setDisplayText(() =>
          text
            .split("")
            .map((char, index) => {
              if (char === " " || char === "·") return char;
              if (index < iteration) {
                return text[index];
              }
              return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            })
            .join("")
        );

        if (iteration >= text.length) {
          cancelAnimationFrame(frameId);
        } else {
          iteration += 0.5;
          frameId = requestAnimationFrame(animate);
        }
      };

      frameId = requestAnimationFrame(animate);
    }, delay * 1000);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frameId);
    };
  }, [text, show, delay]);

  return <span className={className} style={style}>{displayText}</span>;
}

function MolecularOrb({
  scrollY,
  mouse,
  onSettled,
}: {
  scrollY: MotionValue<number>;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
  onSettled: () => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const nodesMesh = useRef<THREE.InstancedMesh>(null!);
  const rodsMesh = useRef<THREE.InstancedMesh>(null!);
  const startRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const spinRef = useRef(0);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Generate dual graph of geodesic sphere for fullerene structure
  const { nodes, rods } = useMemo(() => {
    // 1. Create a high-detail Icosahedron (geodesic sphere)
    const radius = 1.0;
    const detail = 5; // Yields 720 faces (nodes in dual graph). Dense nanostructure.
    const geo = new THREE.IcosahedronGeometry(radius, detail);

    let pos: ArrayLike<number> = geo.attributes.position.array;
    let idx: ArrayLike<number> | null = geo.index ? geo.index.array : null;

    if (!idx) {
      // Build index manually if unindexed
      const newPos: number[] = [];
      const newIdx: number[] = [];
      const vMap = new Map<string, number>();
      let vCount = 0;

      for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i], y = pos[i + 1], z = pos[i + 2];
        const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
        if (!vMap.has(key)) {
          vMap.set(key, vCount++);
          newPos.push(x, y, z);
        }
        newIdx.push(vMap.get(key)!);
      }
      pos = newPos;
      idx = newIdx;
    }

    const computedNodes: THREE.Vector3[] = [];
    const edgeMap = new Map<string, number[]>();

    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      const vA = new THREE.Vector3(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]);
      const vB = new THREE.Vector3(pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]);
      const vC = new THREE.Vector3(pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]);

      // Node is the centroid of the face, projected to sphere surface
      const center = vA.clone().add(vB).add(vC).divideScalar(3).normalize().multiplyScalar(radius);
      computedNodes.push(center);

      const faceIdx = i / 3;
      const faceVertices = [a, b, c];

      // Map edges to find adjacent faces
      for (let j = 0; j < 3; j++) {
        const v1 = faceVertices[j];
        const v2 = faceVertices[(j + 1) % 3];
        const min = Math.min(v1, v2);
        const max = Math.max(v1, v2);
        const key = `${min}-${max}`;

        if (!edgeMap.has(key)) {
          edgeMap.set(key, []);
        }
        edgeMap.get(key)!.push(faceIdx);
      }
    }

    const computedRods: { p1: THREE.Vector3; p2: THREE.Vector3 }[] = [];
    edgeMap.forEach((faces) => {
      // For a closed manifold, every edge is shared by exactly 2 faces
      if (faces.length === 2) {
        computedRods.push({
          p1: computedNodes[faces[0]],
          p2: computedNodes[faces[1]],
        });
      }
    });

    return { nodes: computedNodes, rods: computedRods };
  }, []);

  // Materials for the premium carbon fiber look
  const nodeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a1a1c",
        metalness: 1.0,
        roughness: 0.15,
        envMapIntensity: 2.0,
      }),
    [],
  );

  const rodMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0a0a0c",
        metalness: 0.8,
        roughness: 0.3,
        envMapIntensity: 1.5,
      }),
    [],
  );

  const nodeGeometry = useMemo(() => new THREE.SphereGeometry(0.04, 16, 16), []);
  const rodGeometry = useMemo(() => new THREE.CylinderGeometry(0.02, 0.02, 1, 8), []);

  // Initialize instance matrices
  useEffect(() => {
    if (nodesMesh.current) {
      nodes.forEach((node, i) => {
        dummy.position.copy(node);
        dummy.scale.setScalar(1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        nodesMesh.current.setMatrixAt(i, dummy.matrix);
      });
      nodesMesh.current.instanceMatrix.needsUpdate = true;
    }

    if (rodsMesh.current) {
      rods.forEach((rod, i) => {
        const { p1, p2 } = rod;
        const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const length = p1.distanceTo(p2);

        dummy.position.copy(center);
        dummy.lookAt(p2);
        dummy.rotateX(Math.PI / 2); // align cylinder with Z axis from lookAt
        dummy.scale.set(1, length, 1);
        dummy.updateMatrix();
        rodsMesh.current.setMatrixAt(i, dummy.matrix);
      });
      rodsMesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [nodes, rods, dummy]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (startRef.current === null) startRef.current = t;
    const elapsed = t - startRef.current;

    const DELAY = 4.0;
    const activeElapsed = Math.max(0, elapsed - DELAY);

    // Intro rise (1.4s)
    const intro = Math.min(1, activeElapsed / 1.4);
    const introE = easeOutCubic(intro);

    // Spin profile
    let spinSpeed: number;
    if (activeElapsed === 0) {
      spinSpeed = 0;
    } else if (activeElapsed < 0.8) {
      spinSpeed = THREE.MathUtils.lerp(0.3, 12.0, easeOutCubic(activeElapsed / 0.8));
    } else if (activeElapsed < 1.5) {
      spinSpeed = 12.0;
    } else if (activeElapsed < 2.5) {
      const k = (activeElapsed - 1.5) / 1.0;
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

    if (group.current) {
      const riseY = THREE.MathUtils.lerp(-3.4, 0, introE);
      // Object stays in the middle initially, slides right on scroll
      const baseX = THREE.MathUtils.lerp(0.7, 2.4, easeInOutCubic(s));
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
      <instancedMesh ref={nodesMesh} args={[nodeGeometry, nodeMaterial, nodes.length]} castShadow receiveShadow />
      <instancedMesh ref={rodsMesh} args={[rodGeometry, rodMaterial, rods.length]} castShadow receiveShadow />
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
      <div className="fixed inset-0 z-10 pointer-events-none">
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

            <MolecularOrb
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
  labelRight,
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
  labelLeft?: string;
  labelRight?: string;
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
            <motion.path
              d={`M ${startX} ${startY} L ${alignRight ? endX + 12 : endX - 12} ${endY} L ${endX} ${endY}`}
              fill="none"
              stroke="oklch(0.45 0.15 75)"
              strokeWidth="0.4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut", delay }}
            />
            <motion.circle
              cx={startX}
              cy={startY}
              r="1.0"
              fill="oklch(0.45 0.15 75)"
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
              right: labelRight,
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
    <div className="fixed inset-0 z-20 pointer-events-none flex items-center justify-center ml-[12vw] md:ml-[16vw]">
      <div className="relative w-[520px] h-[520px] max-w-[80vw] max-h-[80vw]">

        {/* Pointer 1: Carbon element - Bottom Left */}
        <CustomPointer
          show={show}
          startX={28}
          startY={72}
          endX={-5}
          endY={95}
          labelRight="calc(105% + 16px)"
          labelTop="92%"
          alignRight={true}
        >
          <div className="w-[300px]">
            <ScrambleText
              text="Element · C"
              show={show}
              delay={0.85}
              className="block text-[11px] font-bold uppercase tracking-[0.35em] text-primary"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            />
            <ScrambleText
              text="Carbon · Atomic No. 6"
              show={show}
              delay={0.9}
              className="block text-lg font-bold text-foreground/95 mt-1 whitespace-nowrap"
              style={{ fontFamily: "'Orbitron', 'Space Grotesk', sans-serif", letterSpacing: "0.08em" }}
            />
          </div>
        </CustomPointer>

        {/* Pointer 2: Brand/Product details - Bottom Right */}
        <CustomPointer
          show={show}
          delay={0.4}
          startX={72}
          startY={72}
          endX={105}
          endY={95}
          labelLeft="calc(105% + 16px)"
          labelTop="92%"
        >
          <div className="w-[380px]">
            <ScrambleText
              text="One fiber · Infinite applications"
              show={show}
              delay={0.4 + 0.85}
              className="block text-[11px] font-bold uppercase tracking-[0.35em] text-accent mb-2"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            />
            <div className="text-[15px] font-semibold text-muted-foreground leading-relaxed mb-4">
              Tangent crafts aerospace-grade carbon fiber and high-purity specialty
              chemicals for the industries shaping tomorrow.
            </div>
            <div className="flex flex-col gap-1 text-[13px] font-bold text-muted-foreground/80 font-mono">
              <ScrambleText text="T-1100 / 12K" show={show} delay={0.4 + 1.0} className="text-foreground/90" />
              <ScrambleText text="6.4 GPa tensile · 350 GPa modulus" show={show} delay={0.4 + 1.1} />
              <ScrambleText text="ISO-9001 · 99.99% purity" show={show} delay={0.4 + 1.2} />
            </div>
          </div>
        </CustomPointer>

      </div>
    </div>
  );
}
