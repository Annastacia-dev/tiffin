# Tiffin

Tiffin is a gut-health meal planner for packed lunches: week/month plans, AI-generated recipes, a recipe library, settings with exclusions, and a shopping list for any date range.

- **Next.js 15** (App Router)
- **NextAuth** with email + password or Google sign-in (single account, managed in the app)
- **Supabase** Postgres for data. Only the server talks to it, using the service role key.
- **Prisma** for database migrations only. The app still reads and writes through `supabase-js`.
- **Anthropic API** for recipe ideas. The key stays on the server.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Under **Project Settings → API**, copy the **Project URL** and the **service_role** key.
3. Click **Connect**, copy the **Session pooler** connection string and put your database password in it. This is `DATABASE_URL`.

## 2. Your account

You don't set a user in env variables. The first time you open Tiffin, you'll see **Create account**.
Enter your name, email and password there. Sign-up closes once that first account exists, so nobody else can register.

You can change your name, email or password later under **Settings → Profile**. Changing the email or password asks for your current password.
Passwords are stored as scrypt hashes in the `users` table.

### Sign in with Google (optional)

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type **Web application**.
2. Add `<your site URL>/api/auth/callback/google` as an **Authorized redirect URI**. Add one for each place you run Tiffin, such as `http://localhost:3000/api/auth/callback/google`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The **Continue with Google** button appears once both are set.

Google follows the same one-account rule. It opens your account if the verified Google email matches your Tiffin email, or creates the account if none exists yet. Any other Google account is refused.

## 3. Anthropic

Create an API key at [console.anthropic.com](https://console.anthropic.com). Filling a whole week costs a few requests.

## 4. Run locally

```bash
npm install
cp .env.example .env.local   # fill in every value
npm run db:deploy            # creates the tables
npm run dev
```

Open http://localhost:3000, create your account, then (optional) import your existing recipes and plan:

```bash
npm run import-data -- you@example.com
```


To create `NEXTAUTH_SECRET`, run `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## Database migrations

`prisma/schema.prisma` describes the database and `prisma/migrations/` holds the SQL history.

| Command | What it does |
| --- | --- |
| `npm run db:migrate -- --name add_something` | Creates a migration from your schema changes and applies it. Run this against a local database, because it can offer to reset the database it's pointed at. |
| `npm run db:deploy` | Applies pending migrations. Use this for Supabase. |
| `npm run db:status` | Shows which migrations have been applied. |

Prisma can't express row level security, so add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` to the migration by hand for any new table.

### If your database was created with the old `supabase/schema.sql`

Your tables already exist, so tell Prisma the first migration is done, then apply the rest. Run these once:

```bash
npm run db:baseline
npm run db:deploy
```

## 5. Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. In [Vercel](https://vercel.com), choose **Add New → Project** and import the repo.
3. Add every variable from `.env.example`. Set `NEXTAUTH_URL` to your production URL.
4. Deploy.

Migrations don't run during the build. Run `npm run db:deploy` with the production `DATABASE_URL` before deploying code that needs them.

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
prisma/             database schema and migrations
scripts/import.mjs + data/export.json   your data from the Claude version
```
