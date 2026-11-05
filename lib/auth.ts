import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { accountExists, supabase } from "@/lib/supabase";
import { normEmail, verifyPassword } from "@/lib/password";

/**
 * The Tiffin account a Google profile may use, or null if it may not sign in.
 * Tiffin has one account: Google can open it if the verified email matches,
 * or create it if no account exists yet. Everyone else is turned away.
 */
export async function accountForGoogle(profile: any): Promise<{ id: string } | null> {
  const email = normEmail(profile?.email);
  if (!email || profile?.email_verified !== true) return null;
  const sb = supabase();
  const { data: existing, error } = await sb.from("users").select("id").eq("email", email).maybeSingle();
  if (error) throw error;
  if (existing) return existing;
  if (await accountExists()) return null;
  const { data: created, error: insertError } = await sb
    .from("users")
    .insert({ email, name: String(profile.name || "").slice(0, 80), password_hash: null })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created;
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
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 90 * 24 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      return !!(await accountForGoogle(profile));
    },
    async jwt({ token, user, account, profile }) {
      // For Google, user.id is Google's id, so look up ours
      if (account?.provider === "google") token.uid = (await accountForGoogle(profile))?.id;
      else if (user) token.uid = user.id;
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
