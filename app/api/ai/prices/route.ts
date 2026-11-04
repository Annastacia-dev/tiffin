import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseJson } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const maxDuration = 60;

const BATCH = 40;
const keyOf = (item: string, unit: string) => item + "|" + unit;

/** Grams and millilitres are too small to price well, so the AI quotes per kg or L. */
function askFor(unit: string): { per: string; divide: number } {
  if (unit === "g") return { per: "1 kg", divide: 1000 };
  if (unit === "ml") return { per: "1 L", divide: 1000 };
  if (!unit || unit === "pc") return { per: "1 piece", divide: 1 };
  return { per: "1 " + unit, divide: 1 };
}

/** Returns the cost of one unit of each ingredient, asking the AI only about ones not saved yet. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  const seen = new Set<string>();
  const items: { item: string; unit: string }[] = [];
  for (const x of Array.isArray(b.items) ? b.items : []) {
    const item = String(x?.item || "").trim().toLowerCase().slice(0, 80);
    const unit = String(x?.unit ?? "").trim().toLowerCase().slice(0, 20);
    if (!item || seen.has(keyOf(item, unit))) continue;
    seen.add(keyOf(item, unit));
    items.push({ item, unit });
  }
  if (items.length > BATCH) return NextResponse.json({ error: `Send at most ${BATCH} items at a time` }, { status: 400 });

  const sb = supabase();
  const { data: row, error: settingsError } = await sb.from("settings").select("data").eq("user_id", uid).maybeSingle();
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });
  const { currency, location } = { ...DEFAULT_SETTINGS, ...(row?.data || {}) };
  if (!items.length) return NextResponse.json({ currency, prices: {} });

  const { data: saved, error } = await sb
    .from("ingredient_prices")
    .select("item, unit, price")
    .eq("user_id", uid)
    .eq("currency", currency)
    .in("item", items.map((i) => i.item));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const prices: Record<string, number | null> = {};
  for (const p of saved || []) if (seen.has(keyOf(p.item, p.unit))) prices[keyOf(p.item, p.unit)] = p.price;
  const missing = items.filter((i) => !(keyOf(i.item, i.unit) in prices));
  if (!missing.length) return NextResponse.json({ currency, prices });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

  try {
    const msg = await new Anthropic().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Estimate what these groceries usually cost, in ${currency}, when shopping here: ${location}
Give a typical mid-range shop price for the quantity in "per". Use null for "price" if you can't make a sensible estimate.

Return ONLY JSON in exactly this shape, no prose, no code fences:
{"prices":[{"id":0,"price":number}]}

Groceries:
${JSON.stringify(missing.map((i, id) => ({ id, item: i.item, per: askFor(i.unit).per })))}`,
        },
      ],
    });
    const parsed = parseJson(msg.content.map((c: any) => (c.type === "text" ? c.text : "")).join(""));
    const rows = [];
    for (const x of Array.isArray(parsed?.prices) ? parsed.prices : []) {
      const it = missing[x?.id];
      const n = Number(x?.price);
      if (!it || (x?.price !== null && (!isFinite(n) || n <= 0 || n > 10_000_000))) continue;
      const price = x.price === null ? null : n / askFor(it.unit).divide; // null is remembered, so it isn't asked again
      rows.push({ user_id: uid, item: it.item, unit: it.unit, currency, price });
      prices[keyOf(it.item, it.unit)] = price;
    }
    if (rows.length) {
      const put = await sb.from("ingredient_prices").upsert(rows);
      if (put.error) return NextResponse.json({ error: put.error.message }, { status: 500 });
    }
    return NextResponse.json({ currency, prices });
  } catch (e: any) {
    const status = e?.status === 429 ? 429 : 502;
    return NextResponse.json({ error: e?.message || "AI request failed", code: status === 429 ? "rate_limited" : "ai_error" }, { status });
  }
}

/** Forgets saved estimates, so they get worked out again. */
export async function DELETE() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const { error } = await supabase().from("ingredient_prices").delete().eq("user_id", uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
