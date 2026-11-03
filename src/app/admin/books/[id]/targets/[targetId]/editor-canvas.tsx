"use client";

// 3D stage for placing content on a page. The page lies flat on a table (target +Z = up), which is
// how students see it when holding a phone over the book.
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { applyTransform, createContent } from "@/ar/content-objects";
import { applyPreset, resetGroup, upAxis } from "@/ar/motion";
import type { ContentData } from "@/lib/content";
import { parseMotion, sampleKeyframes, type Pose } from "@/lib/motion-schema";

export type TransformMode = "translate" | "rotate" | "scale";
export type Transform = Pose;
export type ContextTarget = { kind: "content"; id: string } | { kind: "page" };

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

function Page({
  url,
  aspect,
  onDeselect,
  onContext,
}: {
  url: string;
  aspect: number;
  onDeselect: () => void;
  onContext: (target: ContextTarget, x: number, y: number) => void;
}) {
  const texture = useTexture(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // Ignore the click that ends a gizmo drag or an orbit (pointer moved).
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta <= 2) onDeselect();
  };
  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onContext({ kind: "page" }, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };
  return (
    <group>
      <mesh position={[0, 0, -0.002]} onClick={onClick} onContextMenu={onContextMenu}>
        <planeGeometry args={[1.04, aspect + 0.04]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.08} />
      </mesh>
      <mesh onClick={onClick} onContextMenu={onContextMenu}>
        <planeGeometry args={[1, aspect]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ContentNode({
  data,
  pose,
  selected,
  showGizmo,
  preview,
  mode,
  onSelect,
  onTransform,
  onClips,
  onContext,
}: {
  data: ContentData;
  /** Overrides the authored transform (keyframe editing). */
  pose: Pose | null;
  selected: boolean;
  showGizmo: boolean;
  /** Play animations in the editor. */
  preview: boolean;
  mode: TransformMode;
  onSelect: (id: string) => void;
  onTransform: (id: string, t: Transform) => void;
  onClips: (id: string, clips: string[]) => void;
  onContext: (target: ContextTarget, x: number, y: number) => void;
}) {
  const [wrapper, setWrapper] = useState<THREE.Group | null>(null);
  const motionGroup = useRef<THREE.Group>(null);
  const wasAnimatingWrapper = useRef(false);
  const motion = useMemo(() => parseMotion(data.motion), [data.motion]);
  const transform = pose ?? data;

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

  useFrame(({ clock }, delta) => {
    handle.update(delta);
    const group = motionGroup.current;
    if (!group || !wrapper) return;
    const t = clock.elapsedTime;

    if (preview && motion?.kind === "preset") applyPreset(group, motion.preset, t * motion.speed, upAxis(data.type));
    else resetGroup(group);

    // Keyframes move the whole item, which would fight the gizmo: preview them only when not
    // selected and not being edited on the timeline.
    const animateWrapper = preview && motion?.kind === "keyframes" && !selected && !pose;
    if (animateWrapper) {
      const sampled = sampleKeyframes(motion, t);
      if (sampled) applyTransform(wrapper, sampled);
    } else if (wasAnimatingWrapper.current) {
      applyTransform(wrapper, transform); // back to the authored placement
    }
    wasAnimatingWrapper.current = animateWrapper;
  });

  return (
    <>
      <group
        ref={setWrapper}
        position={[transform.posX, transform.posY, transform.posZ]}
        rotation={[transform.rotX * DEG, transform.rotY * DEG, transform.rotZ * DEG]}
        scale={transform.scale}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(data.id);
        }}
        onContextMenu={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(data.id);
          onContext({ kind: "content", id: data.id }, e.nativeEvent.clientX, e.nativeEvent.clientY);
        }}
      >
        <group ref={motionGroup}>
          <primitive object={handle.object} />
        </group>
      </group>
      {selected && showGizmo && wrapper && (
        <TransformControls
          object={wrapper}
          mode={mode}
          size={0.8}
          onObjectChange={() => {
            let scale = transform.scale;
            if (mode === "scale") {
              // Keep scale uniform: take whichever axis the user dragged.
              const axes = [wrapper.scale.x, wrapper.scale.y, wrapper.scale.z];
              scale = axes.reduce((best, v) => (Math.abs(v - transform.scale) > Math.abs(best - transform.scale) ? v : best), transform.scale);
              scale = Math.max(0.01, scale);
              wrapper.scale.setScalar(scale);
            }
            onTransform(data.id, {
              posX: wrapper.position.x,
              posY: wrapper.position.y,
              posZ: wrapper.position.z,
              rotX: wrapper.rotation.x / DEG,
              rotY: wrapper.rotation.y / DEG,
              rotZ: wrapper.rotation.z / DEG,
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
  preview,
  editingPose,
  showGizmo,
  onSelect,
  onTransform,
  onClips,
  onContext,
}: {
  imageUrl: string;
  /** target height / width */
  aspect: number;
  contents: ContentData[];
  selectedId: string | null;
  mode: TransformMode;
  preview: boolean;
  /** The item being keyframed and its current pose on the timeline. */
  editingPose: { id: string; pose: Pose } | null;
  showGizmo: boolean;
  onSelect: (id: string | null) => void;
  onTransform: (id: string, t: Transform) => void;
  onClips: (id: string, clips: string[]) => void;
  onContext: (target: ContextTarget, x: number, y: number) => void;
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
        <Page url={imageUrl} aspect={aspect} onDeselect={() => onSelect(null)} onContext={onContext} />
      </Suspense>
      {contents.map((content) => (
        <ContentNode
          key={content.id}
          data={content}
          pose={editingPose?.id === content.id ? editingPose.pose : null}
          selected={content.id === selectedId}
          showGizmo={showGizmo}
          preview={preview}
          mode={mode}
          onSelect={onSelect}
          onTransform={onTransform}
          onClips={onClips}
          onContext={onContext}
        />
      ))}
      <OrbitControls makeDefault minDistance={0.3} maxDistance={6} maxPolarAngle={Math.PI * 0.49} target={[0, 0, 0.08]} />
    </Canvas>
  );
}
