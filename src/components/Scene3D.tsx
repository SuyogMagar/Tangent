import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, MeshTransmissionMaterial } from "@react-three/drei";
import { useRef, Suspense } from "react";
import * as THREE from "three";
import { useScroll, useTransform, MotionValue } from "framer-motion";

function CarbonTorus({ scrollY }: { scrollY: MotionValue<number> }) {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const s = scrollY.get();
    if (mesh.current) {
      mesh.current.rotation.x = t * 0.15 + s * 3;
      mesh.current.rotation.y = t * 0.2 + s * 4;
      mesh.current.position.x = Math.sin(s * Math.PI) * 1.8;
      mesh.current.position.z = -s * 2;
      const scale = 1 + s * 0.6;
      mesh.current.scale.setScalar(scale);
    }
  });
  return (
    <mesh ref={mesh}>
      <torusKnotGeometry args={[1, 0.32, 220, 32]} />
      <meshStandardMaterial
        color="#1a1a1f"
        metalness={0.95}
        roughness={0.25}
        envMapIntensity={1.2}
      />
    </mesh>
  );
}

function GlassCapsule({ scrollY }: { scrollY: MotionValue<number> }) {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const s = scrollY.get();
    if (mesh.current) {
      mesh.current.rotation.y = t * 0.4;
      mesh.current.position.y = Math.sin(t * 0.6) * 0.2 - s * 1.5;
      mesh.current.position.x = -2 + s * 4;
    }
  });
  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh ref={mesh} position={[-2.5, 0, -1]}>
        <capsuleGeometry args={[0.45, 1.2, 16, 32]} />
        <MeshTransmissionMaterial
          thickness={0.6}
          roughness={0.05}
          transmission={1}
          ior={1.45}
          chromaticAberration={0.05}
          color="#ffb066"
          backside
        />
      </mesh>
    </Float>
  );
}

function Particles() {
  const points = useRef<THREE.Points>(null!);
  const count = 800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
  }
  useFrame((s) => {
    if (points.current) points.current.rotation.y = s.clock.getElapsedTime() * 0.02;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.015} color="#ffaa55" transparent opacity={0.7} />
    </points>
  );
}

export function Scene3D() {
  const { scrollYProgress } = useScroll();
  const cameraZ = useTransform(scrollYProgress, [0, 1], [5, 3.2]);

  return (
    <div className="fixed inset-0 -z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <CameraRig zRef={cameraZ} />
          <ambientLight intensity={0.3} />
          <directionalLight position={[4, 5, 4]} intensity={1.4} color="#ffd9a8" />
          <directionalLight position={[-4, -2, -3]} intensity={0.6} color="#5fb8d6" />
          <CarbonTorus scrollY={scrollYProgress} />
          <GlassCapsule scrollY={scrollYProgress} />
          <Particles />
          <Environment preset="warehouse" />
        </Suspense>
      </Canvas>
    </div>
  );
}

function CameraRig({ zRef }: { zRef: MotionValue<number> }) {
  useFrame((state) => {
    state.camera.position.z = zRef.get();
    state.camera.updateProjectionMatrix();
  });
  return null;
}
