<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local development

Run commands from `web/`. The Cloud Agent environment starts Docker, a local Supabase stack, and `npm run dev` on boot.

Open the app at http://localhost:3000. Next.js blocks dev client assets when the host is `127.0.0.1`, so use `localhost` for the browser. Local API is http://127.0.0.1:54321 and Studio is http://127.0.0.1:54323.

The start script writes `web/.env.local` from `supabase status` and exports `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for that process. Those local values must win over any hosted Supabase variables already present in the environment, so the dev server does not read or write the hosted project. Do not commit `.env.local`.

- Install: `npm ci`
- Lint: `npm run lint`
- Dev server: `npm run dev -- --hostname 0.0.0.0 --port 3000`
