import { after, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { aiPhotosConfigured, ImageError, makeImage } from "@/lib/openai-images";
import { clearAiPhotos, findAiPhoto, isAiPhotoId, storeAiPhoto } from "@/lib/photo-store";
import { supabase } from "@/lib/supabase";
import { rowToRecipe, type RecipePhoto } from "@/lib/types";
import { getPhoto, photosConfigured, reportUsed, searchPhotos, UnsplashError, validPhotoId } from "@/lib/unsplash";

export const maxDuration = 60;

const NOT_SET_UP = { error: "Photos aren't set up yet. Add UNSPLASH_ACCESS_KEY to the server settings." };

function failed(e: unknown) {
  if (e instanceof UnsplashError) {
    if (e.limited) return NextResponse.json({ error: "Too many photo searches. Try again in an hour." }, { status: 429 });
    if (e.status === 401 || e.status === 403) return NextResponse.json({ error: "Unsplash didn't accept the API key. Check UNSPLASH_ACCESS_KEY." }, { status: 502 });
    if (e.status === 404) return NextResponse.json({ error: "That photo isn't on Unsplash any more. Pick another." }, { status: 404 });
  }
  console.error(e);
  return NextResponse.json({ error: "Couldn't reach Unsplash. Try again." }, { status: 502 });
}

function imageFailed(e: unknown) {
  console.error("AI photo", e);
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
  if (e instanceof ImageError) {
    if (e.code === "insufficient_quota" || e.code === "billing_hard_limit_reached") return fail("Your OpenAI account is out of credit. Add some, then try again.", 402);
    if (e.status === 429) return fail("Too many AI images. Try again in a minute.", 429);
    if (e.status === 401) return fail("OpenAI didn't accept the API key. Check OPENAI_API_KEY.", 502);
    if (e.status === 403) return fail("Your OpenAI account can't use this image model. You may need to verify your organization with OpenAI.", 502);
    if (e.code === "moderation_blocked") return fail("OpenAI wouldn't make that image. Try describing the dish differently.", 400);
  }
  if (e instanceof Error && e.name === "TimeoutError") return fail("That image took too long. Try again.", 504);
  return fail("Couldn't make that image. Try again.", 502);
}

/** ?q=chicken+teriyaki -> { photos: RecipePhoto[] } */
export async function GET(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  if (!photosConfigured()) return NextResponse.json(NOT_SET_UP, { status: 503 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ error: "Type a dish to search for." }, { status: 400 });
  try {
    return NextResponse.json({ photos: await searchPhotos(q) });
  } catch (e) {
    return failed(e);
  }
}

/** Body: { recipeId, detail? } makes an AI image of the recipe and sets it as the photo. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  if (!aiPhotosConfigured()) return NextResponse.json({ error: "AI images aren't set up yet. Add OPENAI_API_KEY to the server settings." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const recipeId = String(b.recipeId || "");
  const detail = String(b.detail || "").trim().slice(0, 200);

  const found = await supabase().from("recipes").select("*").eq("user_id", uid).eq("id", recipeId).maybeSingle();
  if (found.error) return NextResponse.json({ error: found.error.message }, { status: 500 });
  if (!found.data) return NextResponse.json({ error: "That recipe no longer exists." }, { status: 404 });

  let photo: RecipePhoto;
  try {
    photo = await storeAiPhoto(uid, recipeId, await makeImage(rowToRecipe(found.data), detail));
  } catch (e) {
    return imageFailed(e);
  }
  const { data, error } = await supabase().from("recipes").update({ photo }).eq("user_id", uid).eq("id", recipeId).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data.length) {
    after(() => clearAiPhotos(uid, recipeId)); // deleted while the image was being made
    return NextResponse.json({ error: "That recipe no longer exists." }, { status: 404 });
  }
  after(() => clearAiPhotos(uid, recipeId, photo.id));
  return NextResponse.json({ ok: true, photo });
}

/**
 * Body: { recipeId, photoId } sets a recipe's photo. A null photoId removes it.
 * The photo is looked up here, so the browser can't save an address of its own.
 */
export async function PUT(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const recipeId = String(b.recipeId || "");
  const photoId = b.photoId ?? null;
  if (!recipeId || (photoId !== null && !validPhotoId(photoId)))
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const ai = isAiPhotoId(photoId);
  if (photoId !== null && !ai && !photosConfigured()) return NextResponse.json(NOT_SET_UP, { status: 503 });

  let photo: RecipePhoto | null = null;
  let usedPath = "";
  if (ai) {
    try {
      photo = await findAiPhoto(uid, recipeId, photoId);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Couldn't get that image back. Try again." }, { status: 502 });
    }
    if (!photo) return NextResponse.json({ error: "That image is gone. Make a new one." }, { status: 404 });
  } else if (photoId !== null) {
    try {
      ({ photo, usedPath } = await getPhoto(photoId));
    } catch (e) {
      return failed(e);
    }
  }
  const { data, error } = await supabase().from("recipes").update({ photo }).eq("user_id", uid).eq("id", recipeId).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data.length) return NextResponse.json({ error: "That recipe no longer exists." }, { status: 404 });
  if (usedPath) after(() => reportUsed(usedPath));
  return NextResponse.json({ ok: true, photo });
}
