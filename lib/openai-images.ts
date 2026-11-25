import type { Recipe } from "@/lib/types";

export class ImageError extends Error {
  constructor(
    public status: number,
    public code = "",
  ) {
    super(`OpenAI answered ${status} ${code}`);
  }
}

export function aiPhotosConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

function imagePrompt(r: Recipe, detail: string) {
  const items = r.ingredients.map((i) => [i.item, i.note].filter(Boolean).join(", ")).join("; ");
  return `A realistic, appetising food photograph of one home-cooked serving of "${r.title}"${r.cuisine ? ` (${r.cuisine})` : ""}.
It is made with: ${items.slice(0, 1500)}. Show only food that fits these ingredients.
How it's made: ${r.steps.join(" ").slice(0, 1500)}
${detail ? `The cook also asks: ${detail}` : ""}
Show the finished dish in natural daylight on simple tableware, centred and filling most of the frame. No text, labels, logos, people or hands.`;
}

/** Returns a landscape WebP image of the dish. */
export async function makeImage(r: Recipe, detail: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      // Low is the quickest and cheapest. Higher ones can take longer than the server is allowed to run.
      quality: process.env.OPENAI_IMAGE_QUALITY || "low",
      prompt: imagePrompt(r, detail),
      size: "1536x1024",
      output_format: "webp",
      output_compression: 65,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(50_000),
  });
  const j = await res.json().catch((e) => {
    if (res.ok) throw e;
    return null;
  });
  if (!res.ok) throw new ImageError(res.status, String(j?.error?.code || ""));
  const b64 = j?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) throw new ImageError(502, "no_image");
  return Buffer.from(b64, "base64");
}
