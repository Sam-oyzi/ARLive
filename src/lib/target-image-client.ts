import { toast } from "sonner";
import { runAction } from "./action-client";
import { imageSize, uploadFile } from "./upload-client";
import { replaceTargetImage } from "@/server/actions/books";

export const TARGET_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

/** Upload a new picture for an existing page (target). Its 3D content stays; the book needs a recompile. */
export async function replaceTargetImageFromFile(targetId: string, file: File, onProgress?: (percent: number) => void) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    toast.error("Use a JPG, PNG or WebP image.");
    return false;
  }
  try {
    const size = await imageSize(file);
    const { url } = await uploadFile(file, "targets", file.name, onProgress);
    const result = await runAction(replaceTargetImage(targetId, { imageUrl: url, ...size }));
    return !!result?.ok;
  } catch (error) {
    toast.error((error as Error).message);
    return false;
  }
}
