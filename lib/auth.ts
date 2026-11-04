import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { NextResponse } from "next/server";
import { scryptSync, timingSafeEqual } from "node:crypto";

/** Checks a password against PASSWORD_HASH ("scrypt:<salt>:<hash>", made by `npm run hash-password`). */
function passwordOk(password: string) {
  const [algo, salt, hash] = (process.env.PASSWORD_HASH || "").trim().split(":");
  if (algo !== "scrypt" || !salt || !hash || !password) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

/** Only emails listed in ALLOWED_EMAILS can sign in. An empty list lets nobody in. */
export function allowed(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const ok = allowed(email) && passwordOk(String(credentials?.password || ""));
        if (!ok) {
          await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
          return null;
        }
        return { id: email, email, name: process.env.DISPLAY_NAME || email.split("@")[0] };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 90 * 24 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
};

/** Returns the signed-in user's id (lower-cased email) or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  return email && allowed(email) ? email.toLowerCase() : null;
}

/** Use in route handlers: `const u = await requireUser(); if (u instanceof NextResponse) return u;` */
export async function requireUser(): Promise<string | NextResponse> {
  const id = await currentUserId();
  return id ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
