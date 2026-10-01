"use client";

// 3D stage for placing content on a page. The page lies flat on a table (target +Z = up), which is
// how students see it when holding a phone over the book.
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createContent } from "@/ar/content-objects";
import type { ContentData } from "@/lib/content";

export type TransformMode = "translate" | "rotate" | "scale";
export type Transform = Pick<ContentData, "posX" | "posY" | "posZ" | "rotX" | "rotY" | "rotZ" | "scale">;

const DEG = Math.PI / 180;

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      texture.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Page({ url, aspect, onDeselect }: { url: string; aspect: number; onDeselect: () => void }) {
  const texture = useTexture(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // Ignore the click that ends a gizmo drag or an orbit (pointer moved).
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta <= 2) onDeselect();
  };
  return (
    <group>
      <mesh position={[0, 0, -0.002]} onClick={onClick}>
        <planeGeometry args={[1.04, aspect + 0.04]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.08} />
      </mesh>
      <mesh onClick={onClick}>
        <planeGeometry args={[1, aspect]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ContentNode({
  data,
  selected,
  mode,
  onSelect,
  onTransform,
  onClips,
}: {
  data: ContentData;
  selected: boolean;
  mode: TransformMode;
  onSelect: (id: string) => void;
  onTransform: (id: string, t: Transform) => void;
  onClips: (id: string, clips: string[]) => void;
}) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  // Rebuild only when something that changes the object itself changes (not on transform edits).
  const handle = useMemo(
    () => createContent(data, "editor"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.id, data.type, data.url, data.text, data.color, data.loop, data.animation, data.autoplay],
  );

  useEffect(() => {
    let alive = true;
    handle
      .load()
      .then(() => {
        if (!alive) return;
        handle.play();
        if (handle.clips.length) onClips(data.id, handle.clips);
      })
      .catch(() => {});
    return () => {
      alive = false;
      handle.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  useFrame((_, delta) => handle.update(delta));

  return (
    <>
      <group
        ref={setGroup}
        position={[data.posX, data.posY, data.posZ]}
        rotation={[data.rotX * DEG, data.rotY * DEG, data.rotZ * DEG]}
        scale={data.scale}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(data.id);
        }}
      >
        <primitive object={handle.object} />
      </group>
      {selected && group && (
        <TransformControls
          object={group}
          mode={mode}
          size={0.8}
          onObjectChange={() => {
            let scale = data.scale;
            if (mode === "scale") {
              // Keep scale uniform: take whichever axis the user dragged.
              const axes = [group.scale.x, group.scale.y, group.scale.z];
              scale = axes.reduce((best, v) => (Math.abs(v - data.scale) > Math.abs(best - data.scale) ? v : best), data.scale);
              scale = Math.max(0.01, scale);
              group.scale.setScalar(scale);
            }
            onTransform(data.id, {
              posX: group.position.x,
              posY: group.position.y,
              posZ: group.position.z,
              rotX: group.rotation.x / DEG,
              rotY: group.rotation.y / DEG,
              rotZ: group.rotation.z / DEG,
              scale,
            });
          }}
        />
      )}
    </>
  );
}

export default function EditorCanvas({
  imageUrl,
  aspect,
  contents,
  selectedId,
  mode,
  onSelect,
  onTransform,
  onClips,
}: {
  imageUrl: string;
  /** target height / width */
  aspect: number;
  contents: ContentData[];
  selectedId: string | null;
  mode: TransformMode;
  onSelect: (id: string | null) => void;
  onTransform: (id: string, t: Transform) => void;
  onClips: (id: string, clips: string[]) => void;
}) {
  // The scene is authored directly in target space (X right, Y towards the top of the page, Z out of
  // the page) with a Z-up camera, rather than rotating a parent group to lay the page flat:
  // TransformControls' gizmo must live in world space, and this way its X/Y/Z arrows match the
  // inspector's X/Y/Z fields and the AR anchor exactly.
  return (
    <Canvas
      camera={{ position: [0, -1.25 - aspect * 0.35, 1.15], up: [0, 0, 1], fov: 40, near: 0.01, far: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={(e) => {
        if (e.type === "click") onSelect(null);
      }}
    >
      <color attach="background" args={["#eceef6"]} />
      <Environment />
      <hemisphereLight args={[0xffffff, 0x8888aa, 1.1]} position={[0, 0, 1]} />
      <directionalLight position={[0.6, -1.2, 2]} intensity={1.6} />
      <Grid
        infiniteGrid
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.003]}
        cellSize={0.05}
        sectionSize={0.25}
        cellColor="#d6d8e6"
        sectionColor="#b8bbd2"
        fadeDistance={5}
        fadeStrength={1.5}
      />
      <Suspense fallback={null}>
        <Page url={imageUrl} aspect={aspect} onDeselect={() => onSelect(null)} />
      </Suspense>
      {contents.map((content) => (
        <ContentNode
          key={content.id}
          data={content}
          selected={content.id === selectedId}
          mode={mode}
          onSelect={onSelect}
          onTransform={onTransform}
          onClips={onClips}
        />
      ))}
      <OrbitControls makeDefault minDistance={0.3} maxDistance={6} maxPolarAngle={Math.PI * 0.49} target={[0, 0, 0.08]} />
    </Canvas>
  );
}
