import { createHash, randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase";
import type { RecipePhoto } from "@/lib/types";

// AI images are kept in Supabase Storage. The bucket is public, so a browser can load
// them, and their random names can't be guessed.
const BUCKET = "recipe-photos";

// Recipe ids come from the browser, so they're hashed to make a safe folder name.
const folder = (uid: string, recipeId: string) => `${uid}/${createHash("sha256").update(recipeId).digest("hex").slice(0, 32)}`;
const fileOf = (photoId: string) => photoId.slice(3) + ".webp";

export function isAiPhotoId(id: unknown): id is string {
  return typeof id === "string" && /^ai-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id);
}

function toPhoto(uid: string, recipeId: string, id: string): RecipePhoto {
  const src = supabase().storage.from(BUCKET).getPublicUrl(`${folder(uid, recipeId)}/${fileOf(id)}`).data.publicUrl;
  return { id, src, thumb: src, alt: "", by: "", byUrl: "", url: "", ai: true };
}

export async function storeAiPhoto(uid: string, recipeId: string, image: Buffer): Promise<RecipePhoto> {
  const id = "ai-" + randomUUID();
  const path = `${folder(uid, recipeId)}/${fileOf(id)}`;
  const upload = () => supabase().storage.from(BUCKET).upload(path, image, { contentType: "image/webp", cacheControl: "31536000" });
  let { error } = await upload();
  if (error && /bucket not found/i.test(error.message)) {
    // The first image makes the bucket. Another request may have just made it, so the second upload decides.
    await supabase().storage.createBucket(BUCKET, { public: true, allowedMimeTypes: ["image/webp"], fileSizeLimit: "5MB" });
    ({ error } = await upload());
  }
  if (error) throw error;
  return toPhoto(uid, recipeId, id);
}

/** An image made earlier for this recipe, for undoing its removal. Null if it's gone. */
export async function findAiPhoto(uid: string, recipeId: string, id: string): Promise<RecipePhoto | null> {
  const { data, error } = await supabase().storage.from(BUCKET).list(folder(uid, recipeId));
  if (error) throw error;
  return data.some((f) => f.name === fileOf(id)) ? toPhoto(uid, recipeId, id) : null;
}

/** Deletes a recipe's AI images, except the one to keep. A failure only leaves an unused file behind. */
export async function clearAiPhotos(uid: string, recipeId: string, keepId = "") {
  try {
    const dir = folder(uid, recipeId);
    const { data, error } = await supabase().storage.from(BUCKET).list(dir);
    if (error) throw error;
    const old = data.filter((f) => !keepId || f.name !== fileOf(keepId)).map((f) => `${dir}/${f.name}`);
    if (!old.length) return;
    const gone = await supabase().storage.from(BUCKET).remove(old);
    if (gone.error) throw gone.error;
  } catch (e) {
    console.error("clear AI photos", e);
  }
}
