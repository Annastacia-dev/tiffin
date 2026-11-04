# Tiffin

Tiffin is a gut-health meal planner for packed lunches: week/month plans, AI-generated recipes, a recipe library, settings with exclusions, and a shopping list for any date range.

- **Next.js 15** (App Router)
- **NextAuth** with email + password sign-in (single account, managed in the app)
- **Supabase** Postgres for data. Only the server talks to it, using the service role key.
- **Anthropic API** for recipe ideas. The key stays on the server.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste in `supabase/schema.sql` and run it.
3. Under **Project Settings → API**, copy the **Project URL** and the **service_role** key.

## 2. Your account

You don't set a user in env variables. The first time you open Tiffin, you'll see **Create account**.
Enter your name, email and password there. Sign-up closes once that first account exists, so nobody else can register.

You can change your name, email or password later under **Settings → Profile**. Changing the email or password asks for your current password.
Passwords are stored as scrypt hashes in the `users` table.

## 3. Anthropic

Create an API key at [console.anthropic.com](https://console.anthropic.com). Filling a whole week costs a few requests.

## 4. Run locally

```bash
npm install
cp .env.example .env.local   # fill in every value
npm run dev
```

Open http://localhost:3000, create your account, then (optional) import your existing recipes and plan:

```bash
npm run import-data -- you@example.com
```


To create `NEXTAUTH_SECRET`, run `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## 5. Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. In [Vercel](https://vercel.com), choose **Add New → Project** and import the repo.
3. Add every variable from `.env.example`. Set `NEXTAUTH_URL` to your production URL.
4. Deploy.

Netlify, Railway or any Node host works too. Run `npm run build && npm start`.

## Direct links

The `#` part of the URL picks the tab: `/#plan`, `/#shopping`, `/#recipes`, `/#settings`.

## Project layout

```
app/api/signup     first-run account creation
app/api/profile    GET/PUT name, email, password
app/api/state      GET everything for the signed-in user
app/api/plan       POST slot changes
app/api/recipes    POST recipes, DELETE /api/recipes/:id
app/api/settings   PUT settings
app/api/checks     PUT shopping-list ticks
app/api/ai         POST: builds the prompt from your settings and calls Claude
components/        Planner UI (planner-app.js does the rendering)
supabase/schema.sql
scripts/import.mjs + data/export.json   your data from the Claude version
```
