/**
 * CycleCircuitDiagram3D
 * ---------------------
 * Diagrama 3D animado do ciclo de refrigeração.
 * Inspirado no VapCyc, mas renderizado em Three.js/R3F.
 *
 * Componentes 3D:
 *  - Evaporador (caixa azul com aletas)
 *  - Compressor (cilindro laranja)
 *  - Condensador (caixa vermelha com aletas)
 *  - Válvula de expansão (cone roxo)
 *  - Tubulações conectando os componentes
 *  - Partículas animadas fluindo pelas tubulações
 *  - Labels HTML flutuantes com valores calculados
 */

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Html,
  PerspectiveCamera,
  GizmoHelper,
  GizmoViewport,
  Tube,
} from "@react-three/drei";
import * as THREE from "three";
import type { CycleResult } from "../../engines/cycle/cycleTypes";

interface Props {
  cycleResult?: CycleResult | null;
  refrigerantId?: string;
  className?: string;
}

function fmt(v: number | undefined, dec = 1): string {
  if (v === undefined || v === null || isNaN(v)) return "—";
  return v.toFixed(dec);
}

// ── Componente 3D: Caixa de trocador de calor ──────────────────────────────────

function HeatExchangerBox({
  position, color, label, sublabel, width = 0.5, height = 0.3, depth = 0.15,
}: {
  position: [number, number, number];
  color: string;
  label: string;
  sublabel?: string;
  width?: number;
  height?: number;
  depth?: number;
}) {
  const numFins = 12;
  return (
    <group position={position}>
      {/* Corpo principal */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} transparent opacity={0.85} />
      </mesh>
      {/* Aletas decorativas */}
      {Array.from({ length: numFins }).map((_, i) => (
        <mesh key={i} position={[(-width / 2 + (i + 0.5) * width / numFins), 0, 0]}>
          <boxGeometry args={[0.003, height * 1.05, depth * 1.1]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} transparent opacity={0.6} />
        </mesh>
      ))}
      {/* Borda */}
      <mesh>
        <boxGeometry args={[width + 0.005, height + 0.005, depth + 0.005]} />
        <meshStandardMaterial color={color} wireframe opacity={0.3} transparent />
      </mesh>
      {/* Label HTML */}
      <Html center position={[0, height / 2 + 0.06, 0]}>
        <div className="bg-white/95 border-2 rounded-lg px-3 py-1.5 shadow-lg text-center min-w-[90px]"
          style={{ borderColor: color }}>
          <div className="text-xs font-bold" style={{ color }}>{label}</div>
          {sublabel && <div className="text-xs text-slate-500 mt-0.5">{sublabel}</div>}
        </div>
      </Html>
    </group>
  );
}

// ── Componente 3D: Compressor ──────────────────────────────────────────────────

function CompressorMesh({
  position, cycleResult,
}: {
  position: [number, number, number];
  cycleResult?: CycleResult | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current && cycleResult?.converged) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 1.5;
    }
  });

  return (
    <group position={position}>
      {/* Corpo do compressor */}
      <mesh ref={meshRef} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.28, 24]} />
        <meshStandardMaterial color="#F97316" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Topo */}
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#EA580C" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Label */}
      <Html center position={[0, 0.28, 0]}>
        <div className="bg-white/95 border-2 border-orange-500 rounded-lg px-3 py-1.5 shadow-lg text-center min-w-[100px]">
          <div className="text-xs font-bold text-orange-600">COMPRESSOR</div>
          <div className="text-xs text-slate-600">W = {fmt(cycleResult?.W_comp_W ? cycleResult.W_comp_W / 1000 : undefined, 2)} kW</div>
          <div className="text-xs text-slate-600">COP = {fmt(cycleResult?.COP, 2)}</div>
        </div>
      </Html>
    </group>
  );
}

// ── Componente 3D: Válvula de expansão ────────────────────────────────────────

function ExpansionValve({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <coneGeometry args={[0.08, 0.18, 16]} />
        <meshStandardMaterial color="#8B5CF6" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.12, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.08, 0.18, 16]} />
        <meshStandardMaterial color="#7C3AED" metalness={0.7} roughness={0.3} />
      </mesh>
      <Html center position={[0, 0.2, 0]}>
        <div className="bg-white/95 border-2 border-purple-500 rounded-lg px-2 py-1 shadow-lg text-center">
          <div className="text-xs font-bold text-purple-600">VÁL. EXPANSÃO</div>
        </div>
      </Html>
    </group>
  );
}

// ── Partículas animadas nas tubulações ────────────────────────────────────────

function FlowParticles3D({
  path, color, speed = 0.4, count = 8,
}: {
  path: THREE.CatmullRomCurve3;
  color: string;
  speed?: number;
  count?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(() => Array.from({ length: count }, (_, i) => i / count), [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    offsets.forEach((offset, i) => {
      const u = ((offset + t * speed) % 1);
      const pt = path.getPoint(u);
      dummy.position.copy(pt);
      dummy.scale.setScalar(0.018);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </instancedMesh>
  );
}

// ── Tubulação entre componentes ───────────────────────────────────────────────

function Pipe({
  points, color, particleColor, showParticles = true,
}: {
  points: THREE.Vector3[];
  color: string;
  particleColor: string;
  showParticles?: boolean;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  return (
    <group>
      <Tube args={[curve, 32, 0.012, 8, false]}>
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} transparent opacity={0.9} />
      </Tube>
      {showParticles && (
        <FlowParticles3D path={curve} color={particleColor} speed={0.35} count={6} />
      )}
    </group>
  );
}

// ── Cena 3D do ciclo ──────────────────────────────────────────────────────────

function CycleScene({ cycleResult, refrigerantId }: { cycleResult?: CycleResult | null; refrigerantId: string }) {
  const converged = cycleResult?.converged ?? false;

  // Posições dos componentes no espaço 3D
  const EVAP_POS: [number, number, number] = [-1.0, 0, 0];
  const COMP_POS: [number, number, number] = [0, 0.7, 0];
  const COND_POS: [number, number, number] = [1.0, 0, 0];
  const VALVE_POS: [number, number, number] = [0, -0.7, 0];

  // Tubulações (caminhos entre componentes)
  const pipeEvapComp = useMemo(() => [
    new THREE.Vector3(-0.75, 0.1, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(-0.15, 0.7, 0),
  ], []);

  const pipeCompCond = useMemo(() => [
    new THREE.Vector3(0.15, 0.7, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(0.75, 0.1, 0),
  ], []);

  const pipeCondValve = useMemo(() => [
    new THREE.Vector3(0.75, -0.1, 0),
    new THREE.Vector3(0.5, -0.5, 0),
    new THREE.Vector3(0.15, -0.7, 0),
  ], []);

  const pipeValveEvap = useMemo(() => [
    new THREE.Vector3(-0.15, -0.7, 0),
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(-0.75, -0.1, 0),
  ], []);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 3.5]} fov={50} />
      <OrbitControls enableDamping dampingFactor={0.05} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 2, -3]} intensity={0.4} color="#B0C4DE" />
      <pointLight position={[0, 2, 2]} intensity={0.4} color="#60A5FA" />

      <Environment preset="city" />

      {/* Componentes */}
      <HeatExchangerBox
        position={EVAP_POS} color="#1E6FD9" label="EVAPORADOR"
        sublabel={`Q = ${fmt(cycleResult?.Q_evap_W ? cycleResult.Q_evap_W / 1000 : undefined, 2)} kW\nTe = ${fmt(cycleResult?.Te_C)} °C`}
        width={0.5} height={0.3} depth={0.15}
      />
      <CompressorMesh position={COMP_POS} cycleResult={cycleResult} />
      <HeatExchangerBox
        position={COND_POS} color="#EF4444" label="CONDENSADOR"
        sublabel={`Q = ${fmt(cycleResult?.Q_cond_W ? cycleResult.Q_cond_W / 1000 : undefined, 2)} kW\nTc = ${fmt(cycleResult?.Tc_C)} °C`}
        width={0.5} height={0.3} depth={0.15}
      />
      <ExpansionValve position={VALVE_POS} />

      {/* Tubulações com partículas */}
      <Pipe points={pipeEvapComp} color="#F97316" particleColor="#FCD34D" showParticles={converged} />
      <Pipe points={pipeCompCond} color="#EF4444" particleColor="#FCA5A5" showParticles={converged} />
      <Pipe points={pipeCondValve} color="#1E6FD9" particleColor="#93C5FD" showParticles={converged} />
      <Pipe points={pipeValveEvap} color="#8B5CF6" particleColor="#C4B5FD" showParticles={converged} />

      {/* Pontos de estado */}
      {converged && cycleResult?.statePoints && (
        <>
          {[
            { pos: new THREE.Vector3(-0.4, 0.45, 0), num: "1", label: `${fmt(cycleResult.statePoints.point1_evapOut.T_C)} °C` },
            { pos: new THREE.Vector3(0.4, 0.45, 0), num: "2", label: `${fmt(cycleResult.statePoints.point2_compOut.T_C)} °C` },
            { pos: new THREE.Vector3(0.4, -0.45, 0), num: "3", label: `${fmt(cycleResult.statePoints.point3_condOut.T_C)} °C` },
            { pos: new THREE.Vector3(-0.4, -0.45, 0), num: "4", label: `${fmt(cycleResult.statePoints.point4_valveOut.T_C)} °C` },
          ].map(({ pos, num, label }) => (
            <group key={num} position={pos}>
              <mesh>
                <sphereGeometry args={[0.025, 16, 16]} />
                <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
              </mesh>
              <Html center position={[0, 0.06, 0]}>
                <div className="bg-slate-800/90 text-white text-xs rounded px-1.5 py-0.5 font-mono whitespace-nowrap">
                  <span className="text-yellow-300 font-bold">{num}</span> {label}
                </div>
              </Html>
            </group>
          ))}
        </>
      )}

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={["#E53935", "#22C55E", "#1E6FD9"]} labelColor="white" />
      </GizmoHelper>
    </>
  );
}

// ── Componente principal exportado ────────────────────────────────────────────

export function CycleCircuitDiagram3D({ cycleResult, refrigerantId = "R404A", className = "" }: Props) {
  const converged = cycleResult?.converged ?? false;

  return (
    <div className={`flex flex-col rounded-lg border border-slate-200 shadow-sm overflow-hidden bg-[#0F172A] ${className}`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1E3A5F]">
        <span className="text-white text-xs font-bold tracking-wider uppercase">
          Diagrama 3D — Ciclo de Refrigeração
        </span>
        <div className="flex items-center gap-2">
          <span className="text-blue-200 text-xs font-mono">{refrigerantId}</span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${converged ? "bg-green-800 text-green-200" : "bg-slate-700 text-slate-300"}`}>
            {converged ? "✓ Ciclo convergido" : "Aguardando cálculo"}
          </span>
        </div>
      </div>

      {/* Canvas 3D */}
      <div style={{ height: 380 }}>
        <Canvas
          shadows
          gl={{ antialias: true, alpha: false }}
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)" }}
        >
          <Suspense fallback={null}>
            <CycleScene cycleResult={cycleResult} refrigerantId={refrigerantId} />
          </Suspense>
        </Canvas>
      </div>

      {/* Barra de dados */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[#1E293B] border-t border-slate-700 text-xs font-mono flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-slate-400">Evap:</span>
          <span className="text-blue-300">{fmt(cycleResult?.Q_evap_W ? cycleResult.Q_evap_W / 1000 : undefined, 2)} kW</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-slate-400">Comp:</span>
          <span className="text-orange-300">{fmt(cycleResult?.W_comp_W ? cycleResult.W_comp_W / 1000 : undefined, 2)} kW</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-slate-400">Cond:</span>
          <span className="text-red-300">{fmt(cycleResult?.Q_cond_W ? cycleResult.Q_cond_W / 1000 : undefined, 2)} kW</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-slate-400">COP:</span>
          <span className="text-yellow-300">{fmt(cycleResult?.COP, 2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-slate-400">EER:</span>
          <span className="text-green-300">{fmt(cycleResult?.EER, 2)}</span>
        </div>
        <span className="text-xs text-slate-500 ml-auto">🖱 Arrastar = rotacionar · Scroll = zoom</span>
      </div>
    </div>
  );
}
