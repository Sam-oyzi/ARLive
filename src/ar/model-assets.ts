import { Group, Mesh, MeshStandardMaterial, type AnimationClip } from "three";
import type { ContentData } from "@/lib/content";
import { disposeObject, getGLTFLoader } from "./content-objects";
import { modelSizeMetres, normalisePlacementModel } from "./model-placement";

/** The first selected 3D layer, upright and resting on the floor in both placement engines. */
export async function loadPlacementAsset(content: ContentData) {
  let model: Group | Mesh;
  let animations: AnimationClip[] = [];
  if (content.type === "MODEL" && content.url) {
    const gltf = await getGLTFLoader().loadAsync(content.url);
    model = gltf.scene;
    const selected = content.animation ? gltf.animations.filter((clip) => clip.name === content.animation) : gltf.animations;
    animations = content.autoplay ? (selected.length ? selected : gltf.animations) : [];
  } else if (content.type === "TEXT3D" && content.text?.trim()) {
    const { createTextGeometry } = await import("./text3d");
    model = new Mesh(await createTextGeometry(content.text), new MeshStandardMaterial({ color: content.color || "#f26a1a" }));
  } else {
    throw new Error("Add a 3D model or 3D text to this page in Studio.");
  }
  try {
    const object = normalisePlacementModel(model, modelSizeMetres(content.scale));
    return { object, animations, dispose: () => disposeObject(object) };
  } catch (error) {
    disposeObject(model);
    throw error;
  }
}
