import type { RecipePhoto } from "@/lib/types";

const API = "https://api.unsplash.com";

export class UnsplashError extends Error {
  constructor(
    public status: number,
    public limited = false,
  ) {
    super(`Unsplash answered ${status}`);
  }
}

export function photosConfigured() {
  return !!process.env.UNSPLASH_ACCESS_KEY;
}

async function unsplash(path: string) {
  const res = await fetch(API + path, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, "Accept-Version": "v1" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Going over the hourly limit can come back as a plain 403, so the header decides.
    const limited = res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
    throw new UnsplashError(res.status, limited);
  }
  return res.json();
}

/** Only keeps addresses that really are on Unsplash. */
function onUnsplash(v: unknown): string {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" && (u.hostname === "unsplash.com" || u.hostname.endsWith(".unsplash.com")) ? u.href : "";
  } catch {
    return "";
  }
}

/** Links back to Unsplash have to say which app sent the visitor. */
function credited(v: unknown): string {
  const href = onUnsplash(v);
  if (!href) return "";
  const u = new URL(href);
  u.searchParams.set("utm_source", "tiffin");
  u.searchParams.set("utm_medium", "referral");
  return u.href;
}

function toPhoto(p: any): RecipePhoto | null {
  const photo = {
    id: String(p?.id || ""),
    // Image addresses are kept exactly as given: Unsplash counts views through them.
    src: onUnsplash(p?.urls?.regular),
    thumb: onUnsplash(p?.urls?.small),
    alt: String(p?.alt_description || "").slice(0, 200),
    by: String(p?.user?.name || "").slice(0, 80),
    byUrl: credited(p?.user?.links?.html),
    url: credited(p?.links?.html),
  };
  return validPhotoId(photo.id) && photo.src && photo.thumb && photo.url ? photo : null;
}

export function validPhotoId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(id);
}

async function search(query: string): Promise<RecipePhoto[]> {
  const params = { query: `${query} food`, per_page: "8", orientation: "landscape", content_filter: "high" };
  const j = await unsplash(`/search/photos?${new URLSearchParams(params)}`);
  return (Array.isArray(j?.results) ? j.results : []).map(toPhoto).filter(Boolean);
}

/** A dish with no photos is tried again by its last word, which is usually the kind of dish ("Bircher Muesli"). */
export async function searchPhotos(query: string): Promise<RecipePhoto[]> {
  const photos = await search(query);
  const last = query.split(" ").pop()!;
  return photos.length || last === query ? photos : search(last);
}

/** Also returns the API path that tells Unsplash the photo was used. */
export async function getPhoto(id: string): Promise<{ photo: RecipePhoto; usedPath: string }> {
  const j = await unsplash(`/photos/${id}`);
  const photo = toPhoto(j);
  if (!photo) throw new UnsplashError(404);
  const used = String(j?.links?.download_location || "");
  // The key goes with this request, so it must only ever go to the Unsplash API.
  return { photo, usedPath: used.startsWith(API + "/") ? used.slice(API.length) : "" };
}

/** Unsplash asks to be told when a photo is used. A failure here doesn't matter to the cook. */
export async function reportUsed(path: string) {
  if (path) await unsplash(path).catch((e) => console.error("unsplash usage report", e));
}
