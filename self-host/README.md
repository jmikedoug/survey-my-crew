# Migrating Poll-Your-People off Lovable

This folder is the migration kit. Nothing here is used by the running Lovable app —
it is the set of files and steps needed to run this project from GitHub, on your own
Supabase project, hosted on Vercel or Netlify.

The live Lovable app keeps working the whole time, so you can cut over when ready.

---

## 1. Get the code onto GitHub

In the Lovable chat, use the **+** menu → **GitHub** → **Connect project**, then create
the repo. Sync is two-way, so you can keep working in either place until cutover.

## 2. Create your own Supabase project

1. Create a project at supabase.com (you own the dashboard, the service role key and
   the DB password there).
2. Apply the schema:

   ```bash
   # copy the kit's migration into your local Supabase folder
   cp self-host/supabase/migrations/00000000000000_init.sql supabase/migrations/
   supabase link --project-ref YOUR_REF
   supabase db push
   ```

   Or just paste `self-host/supabase/migrations/00000000000000_init.sql` into the
   SQL editor. It creates every enum, table, GRANT, RLS policy, function and trigger,
   including the security hardening (column-level grants that hide
   `surveys.creator_token`, `SECURITY DEFINER` functions with `EXECUTE` revoked from
   `anon`, affiliate links that must belong to a survey).

   Data is **not** carried over — this is a fresh start.

3. **Auth → Providers**: enable Email, and enable Google with your own Google Cloud
   OAuth client (`https://YOUR-PROJECT.supabase.co/auth/v1/callback` as the redirect URI).
4. **Auth → URL configuration**: add your site URL and
   `https://pyp.jmikedoug.com/**` to the redirect allow-list.

## 3. Swap the Lovable-specific code

| Replace | With |
| --- | --- |
| `src/integrations/lovable/index.ts` | `self-host/src/integrations/lovable/index.ts` (plain `supabase.auth.signInWithOAuth`; same API, so `src/routes/auth.tsx` needs no change) |
| `src/integrations/supabase/client.ts` | `self-host/src/integrations/supabase/client.ts` |
| `vite.config.ts` | `self-host/vite.config.ts` |
| `.env` | copy `self-host/.env.example` → `.env` and fill it in |

Keep as-is (they only read env vars and `@supabase/supabase-js`):
`src/integrations/supabase/client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`,
`types.ts`. Regenerate `types.ts` any time with
`supabase gen types typescript --linked > src/integrations/supabase/types.ts`.

Then remove the Lovable packages:

```bash
bun remove @lovable.dev/vite-tanstack-config @lovable.dev/cloud-auth-js @lovable.dev/mcp-js
bun add -d @tanstack/react-start @vitejs/plugin-react @tailwindcss/vite vite-tsconfig-paths nitro
```

### Agent integrations (MCP) — dropped for the cutover

The `/mcp` server depends on the Lovable MCP plugin and Lovable's OAuth 2.1
authorization server. Delete these when you move:

```
src/routes/mcp.ts
src/routes/[.mcp]/
src/routes/[.well-known]/oauth-protected-resource.ts
src/routes/[.lovable.oauth.consent].tsx  (the consent route)
src/lib/mcp/
```

…and the `mcpPlugin()` entry (already absent from the kit's `vite.config.ts`).
It can be rebuilt later against your own OAuth server; the four read tools are
thin wrappers around `get_survey_results` and owner-scoped selects.

### AI product matching

Already provider-agnostic in `src/lib/product-matching.functions.ts`: it reads
`AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` (any OpenAI-compatible endpoint) and only
falls back to `LOVABLE_API_KEY` when those are unset. Set your own key and it works
unchanged. Without a key, product suggestions degrade gracefully to an empty list.

## 4. Deploy on Vercel or Netlify

1. Import the GitHub repo. Build command `bun run build`, and set
   `NITRO_PRESET=vercel` (or `netlify`).
2. Add every variable from `.env.example` in the host's environment settings.
   `SUPABASE_SERVICE_ROLE_KEY` and `AI_API_KEY` are server-only — never prefix them
   with `VITE_`.
3. Deploy, verify on the host's preview domain, then point `pyp.jmikedoug.com` DNS at
   the new host and add that origin to Supabase Auth redirect URLs.

## 5. Verify after cutover

- Sign up with email; sign in with Google.
- Create a poll, open its share link in a private window, submit as a guest.
- View results, duplicate a poll, export CSV.
- With a second account, confirm you cannot see the first account's polls or profile.

## Local development

```bash
bun install
cp self-host/.env.example .env   # fill in your Supabase values
bun dev                          # http://localhost:8080
```
