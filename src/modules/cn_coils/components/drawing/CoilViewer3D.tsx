/**
 * CoilViewer3D
 * ------------
 * Visualizador 3D interativo da serpentina em React Three Fiber.
 *
 * Renderiza em tempo real:
 *  - Aletas (laminas finas de alumínio)
 *  - Tubos de cobre passando pelas aletas
 *  - Manifolds (coletores) de entrada e saída
 *  - Zonas térmicas por gradiente de cor (frio → quente)
 *  - Fluxo animado de refrigerante nos circuitos
 *  - Iluminação HDR com sombras suaves
 *
 * Controles: orbit (rotação), zoom, pan
 */

import { useRef, useMemo, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Text,
  Html,
  PerspectiveCamera,
  Grid,
  GizmoHelper,
  GizmoViewport,
} from "@react-three/drei";
import * as THREE from "three";
import type { CycleResult } from "../../engines/cycle/cycleTypes";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CoilGeometry {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  rows: number;
  tubesPerRow: number;
  tubeOuterDiamMm: number;
  finPitchMm: number;
  finThicknessMm: number;
  circuits: number;
  staggered?: boolean;
}

interface Props {
  geometry: CoilGeometry;
  cycleResult?: CycleResult | null;
  refrigerantId?: string;
  showThermalZones?: boolean;
  showFlow?: boolean;
  showGrid?: boolean;
  className?: string;
}

// ── Paleta térmica ─────────────────────────────────────────────────────────────

function thermalColor(t: number): THREE.Color {
  // t: 0 = frio (azul), 1 = quente (vermelho)
  const cold = new THREE.Color("#1E6FD9");
  const warm = new THREE.Color("#FF5722");
  return cold.lerp(warm, t);
}

// ── Componente: Aletas ─────────────────────────────────────────────────────────

function Fins({ geo, showThermal }: { geo: CoilGeometry; showThermal: boolean }) {
  const { heightMm: H, widthMm: W, depthMm: D, finPitchMm, finThicknessMm, rows } = geo;
  const scale = 0.001; // mm → m
  const numFins = Math.max(2, Math.floor(W / finPitchMm));
  const finGeo = useMemo(() => new THREE.BoxGeometry(
    H * scale, D * scale, finThicknessMm * scale
  ), [H, D, finThicknessMm, scale]);

  return (
    <group>
      {Array.from({ length: numFins }).map((_, i) => {
        const t = rows > 1 ? i / (numFins - 1) : 0.5;
        const color = showThermal ? thermalColor(t) : new THREE.Color("#D0E8FF");
        const x = (-W / 2 + i * finPitchMm) * scale;
        return (
          <mesh key={i} position={[x, 0, 0]} geometry={finGeo}>
            <meshStandardMaterial
              color={color}
              metalness={0.7}
              roughness={0.3}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Componente: Tubos ──────────────────────────────────────────────────────────

function Tubes({ geo, showThermal }: { geo: CoilGeometry; showThermal: boolean }) {
  const { heightMm: H, widthMm: W, depthMm: D, rows, tubesPerRow, tubeOuterDiamMm, staggered } = geo;
  const scale = 0.001;
  const r = (tubeOuterDiamMm / 2) * scale;
  const tubeLen = W * scale;

  const tubes = useMemo(() => {
    const pts: { x: number; y: number; z: number; row: number; col: number }[] = [];
    const rowPitch = rows > 1 ? D / (rows - 1) : D / 2;
    const tubePitch = tubesPerRow > 1 ? H / (tubesPerRow - 1) : H / 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < tubesPerRow; col++) {
        const z = (-D / 2 + row * rowPitch) * scale;
        const staggerOff = staggered && row % 2 === 1 ? (tubePitch / 2) * scale : 0;
        const y = (-H / 2 + col * tubePitch) * scale + staggerOff;
        pts.push({ x: 0, y, z, row, col });
      }
    }
    return pts;
  }, [rows, tubesPerRow, H, D, scale, staggered]);

  const tubeGeo = useMemo(() => new THREE.CylinderGeometry(r, r, tubeLen, 16), [r, tubeLen]);

  return (
    <group>
      {tubes.map(({ x, y, z, row }) => {
        const t = rows > 1 ? row / (rows - 1) : 0.5;
        const color = showThermal ? thermalColor(t) : new THREE.Color("#B87333"); // cobre
        return (
          <mesh key={`${row}-${y}`} position={[x, y, z]}
            rotation={[0, 0, Math.PI / 2]}
            geometry={tubeGeo}>
            <meshStandardMaterial
              color={color}
              metalness={0.85}
              roughness={0.15}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Componente: Manifolds ──────────────────────────────────────────────────────

function Manifolds({ geo }: { geo: CoilGeometry }) {
  const { heightMm: H, widthMm: W, depthMm: D } = geo;
  const scale = 0.001;
  const manifoldR = 0.018;
  const manifoldLen = H * scale * 1.1;

  return (
    <group>
      {/* Manifold de entrada (lado quente — direita) */}
      <mesh position={[W / 2 * scale + 0.01, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[manifoldR, manifoldR, manifoldLen, 16]} />
        <meshStandardMaterial color="#E53935" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Manifold de saída (lado frio — esquerda) */}
      <mesh position={[-W / 2 * scale - 0.01, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[manifoldR, manifoldR, manifoldLen, 16]} />
        <meshStandardMaterial color="#1E6FD9" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Conexão de entrada */}
      <mesh position={[W / 2 * scale + 0.01, -H / 2 * scale * 0.6, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.04, 12]} />
        <meshStandardMaterial color="#E53935" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Conexão de saída */}
      <mesh position={[-W / 2 * scale - 0.01, H / 2 * scale * 0.6, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.04, 12]} />
        <meshStandardMaterial color="#1E6FD9" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ── Componente: Partículas de fluxo animado ────────────────────────────────────

function FlowParticles({ geo, cycleResult }: { geo: CoilGeometry; cycleResult?: CycleResult | null }) {
  const { heightMm: H, widthMm: W, depthMm: D, rows, tubesPerRow, circuits } = geo;
  const scale = 0.001;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const numParticles = Math.min(circuits * tubesPerRow * 2, 80);
  const positions = useMemo(() => {
    const pts: { x: number; y: number; z: number; speed: number; phase: number }[] = [];
    for (let i = 0; i < numParticles; i++) {
      const row = Math.floor(Math.random() * rows);
      const col = Math.floor(Math.random() * tubesPerRow);
      const rowPitch = rows > 1 ? D / (rows - 1) : D / 2;
      const tubePitch = tubesPerRow > 1 ? H / (tubesPerRow - 1) : H / 2;
      pts.push({
        x: (-W / 2 + Math.random() * W) * scale,
        y: (-H / 2 + col * tubePitch) * scale,
        z: (-D / 2 + row * rowPitch) * scale,
        speed: 0.3 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return pts;
  }, [numParticles, rows, tubesPerRow, H, W, D, scale]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    positions.forEach((p, i) => {
      const x = ((-W / 2) * scale + ((p.phase + t * p.speed) % 1) * W * scale);
      dummy.position.set(x, p.y, p.z);
      dummy.scale.setScalar(0.006);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Cor das partículas baseada no estado do ciclo
  const particleColor = cycleResult?.statePoints
    ? "#8B5CF6" // bifásico
    : "#60A5FA";

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, numParticles]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color={particleColor} emissive={particleColor} emissiveIntensity={0.5} />
    </instancedMesh>
  );
}

// ── Componente: Labels de informação ──────────────────────────────────────────

function InfoLabels({ geo, cycleResult }: { geo: CoilGeometry; cycleResult?: CycleResult | null }) {
  const { heightMm: H, widthMm: W } = geo;
  const scale = 0.001;

  return (
    <group>
      {/* Label ENTRADA */}
      <Text
        position={[W / 2 * scale + 0.06, 0, 0]}
        fontSize={0.025}
        color="#E53935"
        anchorX="left"
        font="/fonts/inter.woff"
      >
        {`ENTRADA\n${cycleResult?.Tc_C?.toFixed(1) ?? "—"} °C`}
      </Text>
      {/* Label SAÍDA */}
      <Text
        position={[-W / 2 * scale - 0.06, 0, 0]}
        fontSize={0.025}
        color="#1E6FD9"
        anchorX="right"
        font="/fonts/inter.woff"
      >
        {`SAÍDA\n${cycleResult?.Te_C?.toFixed(1) ?? "—"} °C`}
      </Text>
      {/* Label capacidade */}
      {cycleResult && (
        <Html position={[0, H / 2 * scale + 0.06, 0]} center>
          <div className="bg-white/90 border border-blue-200 rounded px-2 py-1 text-xs font-mono shadow-sm whitespace-nowrap">
            <span className="text-blue-700 font-bold">
              Q = {(cycleResult.Q_evap_W / 1000).toFixed(2)} kW
            </span>
            <span className="text-slate-500 ml-2">
              COP = {cycleResult.COP?.toFixed(2) ?? "—"}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Cena 3D principal ──────────────────────────────────────────────────────────

function CoilScene({
  geometry, cycleResult, showThermalZones, showFlow,
}: {
  geometry: CoilGeometry;
  cycleResult?: CycleResult | null;
  showThermalZones: boolean;
  showFlow: boolean;
}) {
  const { widthMm: W, heightMm: H, depthMm: D } = geometry;
  const scale = 0.001;
  const camDist = Math.max(W, H, D) * scale * 2.5;

  return (
    <>
      <PerspectiveCamera makeDefault position={[camDist, camDist * 0.7, camDist]} fov={45} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={camDist * 0.3}
        maxDistance={camDist * 4}
      />

      {/* Iluminação */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.5} color="#B0C4DE" />
      <pointLight position={[0, 0, 3]} intensity={0.3} color="#60A5FA" />

      {/* Ambiente HDR */}
      <Environment preset="studio" />

      {/* Grid de referência */}
      <Grid
        position={[0, -H / 2 * scale - 0.02, 0]}
        args={[2, 2]}
        cellSize={0.05}
        cellThickness={0.5}
        cellColor="#94A3B8"
        sectionSize={0.2}
        sectionColor="#CBD5E1"
        fadeDistance={3}
        infiniteGrid
      />

      {/* Serpentina */}
      <group>
        <Fins geo={geometry} showThermal={showThermalZones} />
        <Tubes geo={geometry} showThermal={showThermalZones} />
        <Manifolds geo={geometry} />
        {showFlow && <FlowParticles geo={geometry} cycleResult={cycleResult} />}
        <InfoLabels geo={geometry} cycleResult={cycleResult} />
      </group>

      {/* Gizmo de orientação */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport
          axisColors={["#E53935", "#22C55E", "#1E6FD9"]}
          labelColor="white"
        />
      </GizmoHelper>
    </>
  );
}

// ── Componente principal exportado ────────────────────────────────────────────

export function CoilViewer3D({
  geometry,
  cycleResult,
  refrigerantId = "R404A",
  showThermalZones = true,
  showFlow = true,
  showGrid = true,
  className = "",
}: Props) {
  const [thermal, setThermal] = useState(showThermalZones);
  const [flow, setFlow] = useState(showFlow);

  const hasData = geometry.rows > 0 && geometry.tubesPerRow > 0 && geometry.heightMm > 0;

  return (
    <div className={`flex flex-col rounded-lg border border-slate-200 shadow-sm overflow-hidden bg-[#0F172A] ${className}`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1E3A5F]">
        <div className="flex items-center gap-2">
          <span className="text-white text-xs font-bold tracking-wider uppercase">
            Visualizador 3D — Serpentina
          </span>
          <span className="text-blue-300 text-xs font-mono">
            {geometry.heightMm}×{geometry.widthMm}×{geometry.depthMm} mm | {refrigerantId}
          </span>
        </div>
        {/* Controles */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={thermal}
              onChange={e => setThermal(e.target.checked)}
              className="accent-blue-400 w-3 h-3"
            />
            <span className="text-blue-200 text-xs">Zonas térmicas</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={flow}
              onChange={e => setFlow(e.target.checked)}
              className="accent-purple-400 w-3 h-3"
            />
            <span className="text-blue-200 text-xs">Fluxo</span>
          </label>
        </div>
      </div>

      {/* Canvas 3D */}
      <div className="relative" style={{ height: 420 }}>
        {!hasData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <svg className="w-16 h-16 mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <p className="text-sm">Configure a geometria e clique em Calcular</p>
            <p className="text-xs mt-1 opacity-60">O modelo 3D será gerado automaticamente</p>
          </div>
        ) : (
          <Canvas
            shadows
            gl={{ antialias: true, alpha: false }}
            style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
          >
            <Suspense fallback={null}>
              <CoilScene
                geometry={geometry}
                cycleResult={cycleResult}
                showThermalZones={thermal}
                showFlow={flow}
              />
            </Suspense>
          </Canvas>
        )}

        {/* Legenda de zonas térmicas */}
        {hasData && thermal && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/50 rounded px-2 py-1">
            <div className="w-20 h-2 rounded" style={{
              background: "linear-gradient(to right, #1E6FD9, #8B5CF6, #FF5722)"
            }} />
            <span className="text-white text-xs ml-1">Frio → Quente</span>
          </div>
        )}

        {/* Instruções */}
        {hasData && (
          <div className="absolute top-3 right-3 text-xs text-slate-400 bg-black/40 rounded px-2 py-1">
            🖱 Arrastar = rotacionar · Scroll = zoom · Shift+drag = pan
          </div>
        )}
      </div>

      {/* Barra de dados */}
      {cycleResult && (
        <div className="flex items-center gap-4 px-4 py-2 bg-[#1E293B] border-t border-slate-700 text-xs font-mono">
          <span className="text-slate-400">Te:</span>
          <span className="text-blue-300">{cycleResult.Te_C?.toFixed(1)} °C</span>
          <span className="text-slate-400">Tc:</span>
          <span className="text-red-300">{cycleResult.Tc_C?.toFixed(1)} °C</span>
          <span className="text-slate-400">Q evap:</span>
          <span className="text-green-300">{(cycleResult.Q_evap_W / 1000).toFixed(2)} kW</span>
          <span className="text-slate-400">COP:</span>
          <span className="text-yellow-300">{cycleResult.COP?.toFixed(2)}</span>
          <span className="text-slate-400">U:</span>
          <span className="text-purple-300">{cycleResult.evaporatorResult?.overallU_WM2K?.toFixed(1)} W/m²K</span>
          <span className={`ml-auto px-2 py-0.5 rounded text-xs ${cycleResult.converged ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
            {cycleResult.converged ? "✓ Convergido" : "✗ Não convergido"}
          </span>
        </div>
      )}
    </div>
  );
}
