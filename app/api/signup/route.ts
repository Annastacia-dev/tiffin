import { NextResponse } from "next/server";
import { accountExists, supabase } from "@/lib/supabase";
import { hashPassword, normEmail, passwordProblem, validEmail } from "@/lib/password";

export const dynamic = "force-dynamic";

/** Sign-up is only open until the first account exists. */
export async function GET() {
  try {
    return NextResponse.json({ open: !(await accountExists()) });
  } catch (e: any) {
    return NextResponse.json({ open: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = normEmail(b.email);
  const name = String(b.name || "").trim().slice(0, 80);
  const password = String(b.password || "");
  if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  const pw = passwordProblem(password);
  if (pw) return NextResponse.json({ error: pw }, { status: 400 });
  if (await accountExists()) return NextResponse.json({ error: "Sign-up is closed." }, { status: 403 });

  const { error } = await supabase().from("users").insert({ email, name, password_hash: hashPassword(password) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
