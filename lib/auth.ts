import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normEmail, verifyPassword } from "@/lib/password";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normEmail(credentials?.email);
        const { data: user } = await supabase()
          .from("users")
          .select("id, email, name, password_hash")
          .eq("email", email)
          .maybeSingle();
        if (!user || !verifyPassword(String(credentials?.password || ""), user.password_hash)) {
          await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
          return null;
        }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 90 * 24 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.uid;
      return session;
    },
  },
};

export type CurrentUser = { id: string; email: string; name: string };

/** The signed-in user, re-read from the database so profile changes apply at once. */
export async function currentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id;
  if (!id) return null;
  const { data } = await supabase().from("users").select("id, email, name").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}

/** Use in route handlers: `const u = await requireUser(); if (u instanceof NextResponse) return u;` */
export async function requireUser(): Promise<string | NextResponse> {
  const id = await currentUserId();
  return id ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
