# Norskprøve-KI – gjennomføringsplan

Dette er prosjektets prioriterte arbeidsrekkefølge. Les dokumentet sammen med
`PROSJEKTOVERSIKT.md` før nytt arbeid starter:

- `PROSJEKTOVERSIKT.md` beskriver produktet og vedtatte krav.
- `PROSJEKTPLAN.md` beskriver hva som skal bygges, i hvilken rekkefølge og
  hvilke kvalitetsporter som må passeres.

## Planen er levende

Planen er styrende, men ikke uforanderlig. Ny teknisk kunnskap, brukertesting,
regelverksendringer eller dokumenterte risikoer kan gjøre en annen rekkefølge
bedre.

Ved endring skal vi:

1. beskrive hva som er oppdaget
2. forklare hvorfor dagens plan ikke lenger er optimal
3. oppdatere berørte faser, avhengigheter og kvalitetsporter
4. føre beslutningen i endringsloggen nederst
5. holde `PROSJEKTOVERSIKT.md` synkronisert dersom produktkrav endres

Vi skal ikke endre planen bare for å tilpasse den til kode som tilfeldigvis
allerede er skrevet.

## Arbeidsregler

- Arbeid på én fase om gangen, bortsett fra nødvendige sikkerhetsrettelser.
- Ikke bygg alle varianter samtidig; fullfør en vertikal flyt først.
- Autorisasjon og forretningsregler håndheves på server/database, ikke bare i
  brukergrensesnittet.
- All ekstern input og KI-output valideres før lagring.
- Ingen fase regnes som ferdig før kvalitetsporten er dokumentert bestått.
- Endringer i skjema og API-er gjøres gjennom versjonerte migrasjoner og
  eksplisitte datakontrakter.
- Personvern og universell utforming er ferdigkriterier, ikke etterarbeid.

## Nåværende prioritet

**Fase 1: Stabiliser fundamentet.**

Adminpanelet er første leveranse, men må migrasjons- og tilgangstestes i et
stagingmiljø før det regnes som produksjonsklart. Deretter er neste
utviklingsoppgave å definere datakontraktene for oppgavetypene.

## Fremdrift

Sist oppdatert: 2026-09-29

| Fase | Status | Dokumentert resultat |
| ---- | ------ | -------------------- |
| 1. Stabiliser fundamentet | Pågår | Adminpanelet er integrert med fundamentet og den kombinerte webappen er lokalt verifisert. Databasen er CI-verifisert før adminmigrasjonen, men samlet CI- og stagingverifisering gjenstår. |
| 2. Datakontrakter | Ikke startet | Avventer fullført kvalitetsport for fase 1. |
| 3. Første elevflyt | Ikke startet | Avventer oppgavekontrakt for `fyll_inn`. |
| 4–9 | Ikke startet | Avventer foregående kvalitetsporter. |

### Fullført i fase 1

- [x] CI definert for ren installasjon, lint, genererte Next.js-rutetyper,
      TypeScript og produksjonsbygg.
- [x] Offentlig miljøkonfigurasjon dokumentert i `web/.env.example`.
- [x] Idempotent migrasjon oppretter `brukerprofil` ved registrering og
      backfiller eksisterende Auth-brukere.
- [x] Lokal verifisering: lint, typekontroll og produksjonsbygg består.
- [x] CI bygger Supabase fra tom database, kjører alle migrasjoner på nytt og
      består databaselint.
- [x] Databasen håndhever opprinnelig bildestatus, godkjenningsspor,
      kvalitetssjekk før publisering og godkjente bilder i publiserte oppgaver.

Migrasjonene til og med `20260929085500_innholdsregler.sql` er verifisert fra
tom lokal database i CI. Adminmigrasjonen
`20260929090000_admin_panel.sql` ligger etter profil- og innholdsmigrasjonene,
men er ennå ikke verifisert sammen med dem i databasejobben. Ingen av
migrasjonene regnes som stagingverifisert før de er kjørt mot et bekreftet
stagingprosjekt og registrering/RLS er testet der.

### Verifikasjonsstatus 2026-09-29

Statusene under skiller eksplisitt mellom implementert, lokalt verifisert,
CI-verifisert og stagingverifisert:

- **Implementert:** Adminpanelet fra `cursor/admin-panel-9323` er integrert med
  foundation-endringene. Migrasjonsrekkefølgen er `085000` (brukerprofil),
  `085500` (innholdsregler) og deretter `090000` (admin).
- **Lokalt verifisert:** Alle fem nødvendige miljøvariabler var tilgjengelige
  uten at verdiene ble skrevet ut. På den kombinerte commit-en `0dd1621`
  bestod en ny ren `npm ci`, `npm run lint`, `npm run typecheck` og
  `npm run build` for den integrerte webappen. Docker er ikke tilgjengelig i
  agentmiljøet, så lokal `supabase db reset`, `supabase db lint` og pgTAP kunne
  ikke kjøres.
- **CI-verifisert:** Foundation-commit `6141ab1` bestod både web- og
  databasejobben i
  [Kvalitetskontroll](https://github.com/IvarMolde/Norskprove-KI/actions/runs/36548108504).
  Denne kjøringen beviser ren databaseoppbygging, lint og pgTAP til og med
  `085500`; den beviser ikke den senere integrerte adminmigrasjonen.
- **Samlet CI-verifisert:** Nei. Det finnes ingen workflow-kjøring for den
  kombinerte admincommit-en `74eaaee` eller branchen
  `cursor/staging-verification-356b`. Foundation-kjøringen nedenfor er fortsatt
  siste dokumenterte databaseverifikasjon og omfatter ikke `090000`.
- **Stagingidentitet:** Kontroll gjentatt på commit `aa0f575`. Alle fem
  miljøvariabler var til stede, og `SUPABASE_PROJECT_ID` samsvarte med
  prosjektreferansen i `NEXT_PUBLIC_SUPABASE_URL`. Det prosjektavgrensede
  tokenet som var lagret med «Project Settings: Read», «API Keys: Read» og
  «API Key Secrets: Read», ble fortsatt avvist av `supabase projects list`
  med manglende `projects_read`. Prosjektnavnet kunne derfor ikke kontrolleres
  mot det påkrevde navnet `norskprove-ki-staging`, og miljøet kan ikke bevises
  å være staging.
- **Stagingverifisert:** Nei. Av sikkerhetshensyn ble `supabase link`,
  `supabase migration list`, `supabase db push --dry-run`, `supabase db push`,
  API-/registrerings-/RLS-testene og opprettelse av testdata ikke kjørt etter
  den mislykkede identitetskontrollen. Ingen remote data ble endret.

Statisk gjennomgang viser at adminmigrasjonen legger til adminroller,
RLS-policyer, privat medielagring, lydmetadata og en valgfri lydreferanse på
oppgaver. Dette er ikke en erstatning for migration dry-run eller testing mot
staging.

### Neste handling

1. Opprett eller juster `SUPABASE_ACCESS_TOKEN` slik at CLI-kallet
   `supabase projects list` faktisk får tillatelsen `projects_read`.
   Kombinasjonen «Project Settings: Read», «API Keys: Read» og «API Key
   Secrets: Read» på det prosjektavgrensede tokenet gir ikke denne
   tillatelsen. Ikke legg tokenet i repo eller logger.
2. Kjør identitetskontrollen på nytt og fortsett bare dersom prosjekt-ID, URL
   og et tydelig stagingnavn samsvarer.
3. Kjør `supabase link`, `supabase migration list` og
   `supabase db push --dry-run`; inspiser pending migrasjoner før en ordinær
   `supabase db push`.
4. Verifiser anvendte migrasjoner, API-health, profiltrigger og RLS for anonym,
   elev og administrator med tydelig merkede, midlertidige stagingdata. Første
   administrator må tildeles eksplisitt med en autorisert servercredential;
   tilgangskontrollen skal ikke svekkes for å automatisere dette.
5. Kjør den samlede databasejobben med adminmigrasjonen og valider eksisterende
   stagingdata før constraints senere vurderes for produksjon.

Når en leveranse fullføres, skal resultatet og verifikasjonen føres her før
arbeidet avsluttes. «Implementert» og «produksjonsverifisert» skal ikke brukes
som synonymer.

---

## Fase 1 – Stabiliser fundamentet

### Leveranser

- Eget Supabase-stagingmiljø og Vercel preview-miljø
- Adminmigrasjon testet før produksjonssetting
- Første administrator opprettet uten hardkodet identitet
- RLS verifisert for anonym bruker, elev og administrator
- Automatisk opprettelse av `brukerprofil` ved registrering
- Databaseregler for bilde­godkjenning og publisering
- CI for lint, TypeScript, produksjonsbygg og automatiske tester
- Dokumentert konfigurasjon uten hemmeligheter i repoet

### Kvalitetsport

- Migrasjoner kan kjøres fra tom database uten manuelle rettelser.
- Uautoriserte brukere kan verken lese kladder eller mutere admininnhold.
- Admin kan opprette, redigere og godkjenne innhold i staging.
- Opplasting av ugyldige filer avvises både i applikasjon og lagringslag.
- CI er grønn fra en ren installasjon.

---

## Fase 2 – Datakontrakter for oppgavetyper

Definer for hver av de 13 oppgavetypene:

- TypeScript-type og diskriminert union
- Zod-skjema
- struktur for `oppgaver.innhold`
- struktur og validering for elevsvar
- fasitformat og vurderingsregel
- tilgjengelighetskrav
- gyldige eksempeldata

Oppgave-editoren skal deretter bruke typespesifikke skjemaer og vise samme
forhåndsvisningskomponent som eleven senere møter. Fri JSON-redigering kan
beholdes som avansert verktøy, men skal ikke være primær arbeidsflate.

### Kvalitetsport

- Alle kontrakter har positive og negative tester.
- Ugyldig innhold kan ikke publiseres.
- Eksisterende innhold har en definert migreringsstrategi.
- Adminforhåndsvisning og elevkomponent tolker samme kontrakt.

---

## Fase 3 – Første komplette elevflyt

Bygg én vertikal flyt med oppgavetypen `fyll_inn`:

1. bruker logger inn
2. rettighet og øktgrense kontrolleres
3. økt opprettes atomisk
4. oppgavesettet fryses i `okt_oppgaver`
5. oppgaven vises universelt utformet
6. svar valideres og lagres
7. historikk og serveringsteller oppdateres atomisk
8. resultat vises uten å røpe mer fasit enn ønsket

Kritiske flertrinnsoperasjoner skal samles i transaksjonelle
databasefunksjoner eller tilsvarende sikre serveroperasjoner.

### Kvalitetsport

- Hele flyten består en ende-til-ende-test.
- Dobbeltinnsending skaper ikke duplikater eller feil telling.
- En bruker kan ikke lese eller endre en annen brukers økt.
- Tastatur, skjermleser og tydelige feiltilstander er verifisert.

---

## Fase 4 – Testfundament og flere oppgavetyper

Etabler:

- SQL- og RLS-tester
- enhetstester for skjema, fasit og utvalgslogikk
- komponenttester for elev- og adminvisning
- Playwright-tester for kritiske brukerreiser
- automatiserte tilgjengelighetssjekker

Utvid deretter i denne rekkefølgen:

1. synonym, antonym og påstand korrekt
2. rekkefølge og setningsstruktur
3. dra til forklaring og merk ordet
4. diktat og øvrige lytteoppgaver
5. hotspot-bilde og velg bilde
6. fritekst og muntlig opptak

Hver type må bestå samme kvalitetsport før neste gruppe påbegynnes.

---

## Fase 5 – Robust økt- og rettighetslogikk

### Leveranser

- pause og fortsett for berettigede planer
- autolagring og trygg gjenoppretting
- månedlige og totale øktgrenser
- ingen gjentatte oppgaver for samme bruker
- rettferdig oppgaverotasjon
- arkivering uten å endre aktive eller historiske økter
- serverstyrt rettighetskontroll via `plan_rettigheter`

### Kvalitetsport

- Samtidige forespørsler kan ikke omgå øktgrenser.
- Rettighetsendring får korrekt virkning uten hardkodede plansjekker.
- Avbrutt nettverk eller sideoppdatering mister ikke bekreftet arbeid.

---

## Fase 6 – Personvern og produksjonsberedskap

Dette må være ferdig før eksterne testbrukere inviteres:

- personvernerklæring og nødvendige databehandleravtaler
- sletting og eksport av brukerdata
- automatisk sletting av elevopptak etter 30 dager
- dataminimering og dokumenterte behandlingsformål
- sikkerhetslogging uten sensitive besvarelser eller hemmeligheter
- rate limiting, overvåking, backup og gjenopprettingsøvelse
- WCAG 2.1 AA-gjennomgang

### Kvalitetsport

- Dataflyt og slettetider er dokumentert og testet.
- Ingen produksjonshemmeligheter finnes i klientkode, logger eller repo.
- Kritiske alarmer og gjenopprettingsrutiner er prøvd.

---

## Fase 7 – Betaling og abonnement

Implementer én betalingsleverandør ende-til-ende før den neste:

1. Stripe som referanseintegrasjon
2. Vipps

Krav:

- signaturverifiserte webhooks
- idempotente betalingstransaksjoner
- serverstyrt aktivering og deaktivering av rettigheter
- håndtering av oppgradering, nedgradering, oppsigelse og betalingsfeil
- økonomiske hendelser lagres med revisjonsspor

### Kvalitetsport

- Repetert eller forsinket webhook gir korrekt sluttstatus.
- Klienten kan ikke gi seg selv betalte rettigheter.
- Alle sentrale abonnementsoverganger har integrasjonstester.

---

## Fase 8 – KI-funksjoner

Rekkefølge:

1. skriftlig vurdering
2. oppgavegenerering
3. TTS og lydnormalisering
4. Whisper-transkripsjon og kvalitetssjekk
5. Imagen
6. muntlig vurdering fase 1

Alle KI-svar skal struktureres, valideres og lagres med modellversjon,
promptversjon og usikkerhetsflagg. Generert innhold skal være kladd frem til
det har passert riktig kvalitetskontroll.

### Kvalitetsport

- Ugyldig eller ufullstendig KI-output avvises trygt.
- Kostnadsgrenser, timeout og retry-strategi er dokumentert.
- Evalueringssett viser akseptabel kvalitet før funksjonen åpnes for brukere.

---

## Fase 9 – Avanserte prøvefunksjoner

- full eksamenssimulering
- adaptiv prøve og datainnsamling for kalibrering
- analyse og justering av terskelverdier
- muntlig samtaleoppgave fase 2

Disse bygges først når innholdsbanken, øktmotoren og vurderingssystemet er
stabile nok til at resultatene kan tolkes pålitelig.

---

## Fast oppstartsprosedyre

Ved starten av en ny arbeidsøkt:

1. Les `PROSJEKTOVERSIKT.md` og denne planen.
2. Kontroller faktisk kode-, database- og branchstatus.
3. Finn første ufullførte kvalitetsport i nåværende fase.
4. Avgrens arbeidet til den porten eller en tydelig del av den.
5. Oppdater dokumentasjon, tester og planstatus når arbeidet avsluttes.

## Endringslogg

| Dato       | Endring | Begrunnelse |
| ---------- | ------- | ----------- |
| 2026-09-29 | Kontrollerte det nye prosjektavgrensede tokenet og stoppet før remote-operasjoner | Fem variabler og URL/ID samsvarte, men `supabase projects list` manglet fortsatt `projects_read`; stagingnavnet kunne derfor ikke bevises og ingen remote data ble endret |
| 2026-09-29 | Gjentok lokal kvalitetsport og stagingidentitetskontroll på kombinert branch; beholdt fase 1 som pågående | Webporten består, men kombinert CI mangler og det nye tokenet blir fortsatt avvist med manglende `projects_read`; ingen remote mutasjon ble utført |
| 2026-09-29 | Første versjon av gjennomføringsplanen | Etablerer robust arbeidsrekkefølge og kvalitetsporter for videre utvikling |
