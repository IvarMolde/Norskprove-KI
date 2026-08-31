-- ============================================================
-- MIGRASJON 4: RLS på konfigurasjonstabeller (rettelse)
-- ============================================================
-- abonnement_plan, plan_rettigheter og adaptiv_terskler manglet
-- RLS i opprinnelig migrasjon - fanget opp ved visuell sjekk i
-- Table Editor ("Unrestricted"-merket), som betydde full lese-
-- OG skrivetilgang for enhver API-kall med anon-nøkkel.
-- ============================================================

alter table abonnement_plan enable row level security;
alter table plan_rettigheter enable row level security;
alter table adaptiv_terskler enable row level security;

create policy "Alle kan lese abonnementsplaner"
  on abonnement_plan for select using (true);

create policy "Alle kan lese planrettigheter"
  on plan_rettigheter for select using (true);

-- adaptiv_terskler: RLS aktivert, ingen policy = kun service role
-- har tilgang. Ingen grunn til at klienten skal lese denne direkte.