-- ============================================================
-- MIGRASJON 1 av 3: Kjerneinnhold + bruker/rettigheter/økter
-- ============================================================
-- Egen, selvstendig Supabase-database for denne appen - ikke delt
-- med andre Lingx-produkter. Derfor ingen produkt_tags-felt; de
-- ble fjernet siden de forutsatte en delt database å slå opp på
-- tvers av, som vi bevisst valgte bort til fordel for separasjon
-- og fremtidig uttrekkbarhet av enkeltmoduler (f.eks. abonnement-
-- logikken) fremfor delt tilstand mellom produkter.
--
-- Dekker akkurat det som trengs for den tynne vertikale skiven:
-- innlogging (Supabase Auth) -> rettighetssjekk -> hent oppgavesett
-- -> vis oppgave -> lagre svar -> vis poengsum, for en enkel
-- leseforståelse-økt.
--
-- IKKE med i denne migrasjonen (kommer i migrasjon 2 og 3 når
-- de funksjonene faktisk bygges):
--   - adaptiv_terskler, prove_sesjon (adaptiv prøve, 899 kr)
--   - skriftlig_vurdering, muntlig_vurdering (KI-vurdering)
--
-- Designvalg: CHECK-constraints på tekstfelt i stedet for native
-- Postgres ENUM-typer for alle "valgfelt" (type, status, kilde,
-- osv). Enum-typer er plagsomme å utvide senere (ALTER TYPE er
-- ikke transaksjonssikkert på eldre Postgres-versjoner) - en
-- CHECK er en enkel ALTER TABLE å endre den dagen dere legger
-- til f.eks. en 14. oppgavetype.
-- ============================================================

-- ------------------------------------------------------------
-- ABONNEMENT / RETTIGHETER
-- Konkretiserer tier-matrisen vi låste: gratis/499/699/899
-- ------------------------------------------------------------

create table abonnement_plan (
  id text primary key check (id in ('gratis', 'plan_499', 'plan_699', 'plan_899')),
  navn text not null,
  pris_kr int not null default 0,
  okter_grense int not null,           -- antall økter tillatt
  okter_periode text not null check (okter_periode in ('totalt', 'maned')),
  opprettet_dato timestamptz not null default now()
);

insert into abonnement_plan (id, navn, pris_kr, okter_grense, okter_periode) values
  ('gratis',   'Gratis',        0,   2, 'totalt'),
  ('plan_499', 'Basis (499 kr)',   499, 15, 'maned'),
  ('plan_699', 'Pluss (699 kr)',   699, 30, 'maned'),
  ('plan_899', 'Komplett (899 kr)', 899, 60, 'maned');

-- Funksjonsrettigheter per plan - koden spør alltid "har bruker
-- rettighet X", aldri "hvilken plan har bruker".
create table plan_rettigheter (
  plan_id text not null references abonnement_plan(id),
  rettighet text not null check (rettighet in (
    'pause_gjenoppta',
    'skriftlig_ki_vurdering',
    'muntlig_ki_vurdering',
    'adaptiv_prove'
  )),
  primary key (plan_id, rettighet)
);

insert into plan_rettigheter (plan_id, rettighet) values
  ('plan_499', 'pause_gjenoppta'),
  ('plan_699', 'pause_gjenoppta'),
  ('plan_699', 'skriftlig_ki_vurdering'),
  ('plan_899', 'pause_gjenoppta'),
  ('plan_899', 'skriftlig_ki_vurdering'),
  ('plan_899', 'muntlig_ki_vurdering'),
  ('plan_899', 'adaptiv_prove');

-- ------------------------------------------------------------
-- BRUKERPROFIL
-- Utvider Supabase sin auth.users med appspesifikke felt.
-- ------------------------------------------------------------

create table brukerprofil (
  id uuid primary key references auth.users(id) on delete cascade,
  abonnement_plan_id text not null default 'gratis' references abonnement_plan(id),
  alder_bekreftet_metode text check (alder_bekreftet_metode in ('vipps', 'egenerklaert')),
  valgt_niva text check (valgt_niva in ('A1', 'A2', 'B1', 'B2')),
  opprettet_dato timestamptz not null default now()
);

-- ------------------------------------------------------------
-- BILDER
-- Egen tabell (ikke felt på oppgaver) for nivå-uavhengig gjenbruk
-- - samme bilde kan brukes i flere oppgaver på ulike nivå.
-- ------------------------------------------------------------

create table bilder (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  beskrivelse text not null,           -- dobler som alt-tekst (WCAG)
  tema text,
  kilde text not null check (kilde in ('opplastet', 'ki_generert')),

  -- Kreditering
  fotograf_navn text,
  kilde_plattform text,
  kilde_url text,
  lisens text,
  kreditering_pakrevd boolean not null default false,

  -- Godkjenningsflyt (kun for egne opplastede bilder - punkt 4 i
  -- konsistenssjekken, manglet i tidligere design)
  status text not null default 'godkjent' check (status in (
    'venter_godkjenning', 'godkjent', 'avvist'
  )),
  godkjent_av uuid references auth.users(id),
  godkjent_dato timestamptz,

  opprettet_av uuid references auth.users(id),
  opprettet_dato timestamptz not null default now()
);

-- KI-genererte bilder skal alltid være "godkjent" med en gang
-- (ingen manuell kø for dem) - kun opplastede krever godkjenning.
-- Håndheves i applikasjonslaget ved insert, ikke i skjemaet.

-- ------------------------------------------------------------
-- OPPGAVER
-- Type-agnostisk skjema: fast metadata i kolonner, type-spesifikt
-- innhold i jsonb - unngår kolonnehull når nye oppgavetyper legges
-- til (13 typer så langt, sannsynligvis flere over tid).
-- ------------------------------------------------------------

create table oppgaver (
  id uuid primary key default gen_random_uuid(),

  type text not null check (type in (
    'fyll_inn', 'synonym', 'antonym', 'dra_til_forklaring',
    'setningsstruktur', 'merk_ordet', 'pastand_korrekt',
    'rekkefolge', 'fritekst', 'diktat', 'hotspot_bilde',
    'velg_bilde', 'muntlig_opptak'
  )),
  ferdighet text not null check (ferdighet in (
    'lesing', 'lytting', 'skriving', 'muntlig'
  )),
  nivå text not null check (nivå in ('A1', 'A2', 'B1', 'B2')),
  tema text,

  kilde text not null check (kilde in ('autentisk', 'ki_generert')),
  status text not null default 'kladd' check (status in (
    'kladd', 'publisert', 'arkivert'
  )),
  kvalitetssjekket boolean not null default false,

  innhold jsonb not null,              -- type-spesifikk struktur, se docs
  bilde_id uuid references bilder(id),
  lyd_url text,
  transkripsjon text,                  -- dobler som tekstalternativ (WCAG)

  ganger_servert int not null default 0,

  opprettet_av uuid references auth.users(id),
  opprettet_dato timestamptz not null default now()
);

create index idx_oppgaver_utvalg on oppgaver (ferdighet, nivå, status)
  where status = 'publisert';

-- ------------------------------------------------------------
-- ØKTER
-- ------------------------------------------------------------

create table okt_tilstand (
  id uuid primary key default gen_random_uuid(),
  bruker_id uuid not null references auth.users(id),
  ferdighet text not null check (ferdighet in (
    'lesing', 'lytting', 'skriving', 'muntlig'
  )),
  siste_posisjon int not null default 0,
  status text not null default 'pagaende' check (status in (
    'pagaende', 'fullfort', 'avbrutt_lagret'
  )),
  startet timestamptz not null default now(),
  sist_lagret timestamptz not null default now()
);
-- Merk: har bevisst IKKE et jsonb-felt for besvarte oppgaver her
-- lenger - det ville duplisert bruker_svar under. okt_tilstand
-- holder kun selve økt-tilstanden (posisjon, status), ikke svarene.

-- Fryser oppgavesettet ved øktstart, slik at "avslutt og fortsett
-- senere" garantert møter SAMME oppgaver ved retur - løser punkt 2
-- i konsistenssjekken (push-logikken er ellers et spørring som kan
-- gi annet resultat ved gjentak).
create table okt_oppgaver (
  okt_id uuid not null references okt_tilstand(id) on delete cascade,
  oppgave_id uuid not null references oppgaver(id),
  rekkefolge int not null,
  primary key (okt_id, oppgave_id)
);

-- Elevens faktiske svar. Løser punkt 1 i konsistenssjekken - fantes
-- ingen tabell for dette før, selv om begge KI-vurderingspromptene
-- forutsetter at svaret finnes lagret et sted.
create table bruker_svar (
  id uuid primary key default gen_random_uuid(),
  bruker_id uuid not null references auth.users(id),
  oppgave_id uuid not null references oppgaver(id),
  okt_id uuid references okt_tilstand(id),
  svar_tekst text,
  svar_lyd_url text,
  innsendt_dato timestamptz not null default now()
);

-- Historikk over besvarte oppgaver, brukt til (a) rettferdig
-- rotasjon i banken og (b) å unngå at samme bruker får samme
-- oppgave to ganger. Kolonnen het opprinnelig "servert_dato", men
-- vi ble enige om at raden skal skrives ved BESVARELSE, ikke ved
-- visning - ellers "brukes opp" en oppgave for brukeren selv om de
-- pauserte økten før de faktisk svarte (punkt 5 i konsistenssjekken).
-- Navnet er derfor endret til besvart_dato for å unngå forvirring.
create table bruker_oppgave_historikk (
  bruker_id uuid not null references auth.users(id),
  oppgave_id uuid not null references oppgaver(id),
  besvart_dato timestamptz not null default now(),
  primary key (bruker_id, oppgave_id, besvart_dato)
);

-- ------------------------------------------------------------
-- RLS (Row Level Security) - grunnleggende policyer.
-- Utvid etter behov når admin-panelet bygges (der skal ansatte/deg
-- kunne se på tvers av brukere for godkjenning og stikkprøver).
-- ------------------------------------------------------------

alter table brukerprofil enable row level security;
alter table okt_tilstand enable row level security;
alter table okt_oppgaver enable row level security;
alter table bruker_svar enable row level security;
alter table bruker_oppgave_historikk enable row level security;
alter table oppgaver enable row level security;
alter table bilder enable row level security;

create policy "Bruker ser egen profil"
  on brukerprofil for select using (auth.uid() = id);

create policy "Bruker ser og oppdaterer egne økter"
  on okt_tilstand for all using (auth.uid() = bruker_id);

create policy "Bruker ser egne øktoppgaver"
  on okt_oppgaver for select using (
    exists (select 1 from okt_tilstand o where o.id = okt_id and o.bruker_id = auth.uid())
  );

create policy "Bruker ser og lagrer egne svar"
  on bruker_svar for all using (auth.uid() = bruker_id);

create policy "Bruker ser egen historikk"
  on bruker_oppgave_historikk for select using (auth.uid() = bruker_id);

create policy "Publiserte oppgaver er lesbare for innloggede brukere"
  on oppgaver for select using (auth.role() = 'authenticated' and status = 'publisert');

create policy "Godkjente bilder er lesbare for innloggede brukere"
  on bilder for select using (auth.role() = 'authenticated' and status = 'godkjent');