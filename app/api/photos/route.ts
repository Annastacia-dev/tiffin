import { after, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getPhoto, photosConfigured, reportUsed, searchPhotos, UnsplashError, validPhotoId } from "@/lib/unsplash";

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
  if (photoId !== null && !photosConfigured()) return NextResponse.json(NOT_SET_UP, { status: 503 });

  let photo = null;
  let usedPath = "";
  if (photoId !== null) {
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
