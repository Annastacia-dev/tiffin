import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { NextResponse } from "next/server";

function allowed(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ user }) {
      return allowed(user.email);
    },
  },
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
