# Tiffin

Tiffin is a gut-health meal planner for packed lunches: week/month plans, AI-generated recipes, a recipe library, settings with exclusions, and a shopping list for any date range.

- **Next.js 15** (App Router)
- **NextAuth** with Google sign-in, limited to the emails in `ALLOWED_EMAILS`
- **Supabase** Postgres for data. Only the server talks to it, using the service role key.
- **Anthropic API** for recipe ideas. The key stays on the server.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste in `supabase/schema.sql` and run it.
3. Under **Project Settings → API**, copy the **Project URL** and the **service_role** key.

## 2. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/) go to **APIs & Services → Credentials → Create credentials → OAuth client ID**, choose **Web application**, and set up the consent screen if you're asked to.
2. Add these **Authorised redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-DOMAIN/api/auth/callback/google`
3. Copy the client ID and secret.

## 3. Anthropic

Create an API key at [console.anthropic.com](https://console.anthropic.com). Filling a whole week costs a few requests.

## 4. Run locally

```bash
npm install
cp .env.example .env.local   # fill in every value
npm run import-data -- annetotoh@gmail.com   # optional: brings over your existing recipes and plan
npm run dev
```

Then open http://localhost:3000.

To create `NEXTAUTH_SECRET`, run `openssl rand -base64 32`.

## 5. Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. In [Vercel](https://vercel.com), choose **Add New → Project** and import the repo.
3. Add every variable from `.env.example`. Set `NEXTAUTH_URL` to your production URL.
4. Deploy, then add the production callback URL in Google Cloud (step 2).

Netlify, Railway or any Node host works too. Run `npm run build && npm start`.

## Direct links

The `#` part of the URL picks the tab: `/#plan`, `/#shopping`, `/#recipes`, `/#settings`.

## Project layout

```
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
