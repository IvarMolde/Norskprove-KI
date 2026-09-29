# Norskprøve-KI

Next.js-appen for Norskprøve-KI.

## Lokal oppstart

Opprett `web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<prosjekt-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Installer og start:

```bash
npm ci
npm run dev
```

## Admin-panel

Admin-panelet ligger på `/admin`. Tilgang gis i databasen, ikke med en
hardkodet e-postadresse. Etter at migrasjonene er kjørt, opprettes første
administrator med service role:

```sql
insert into public.admin_brukere (bruker_id, rolle)
values ('<id-fra-auth.users>', 'admin');
```

Alle adminoperasjoner kontrolleres både i serverlaget og med RLS. Bilder og
lyd lagres i private Supabase Storage-bøtter og vises med kortvarige, signerte
URL-er.
