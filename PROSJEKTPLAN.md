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
| 1. Stabiliser fundamentet | Pågår | Foundation- og adminmigrasjonene er integrert, samlet CI er grønn og staging-RLS er verifisert for anonym, elev og administrator. Offentlig registrering, første varige stagingadministrator, filopplastingsporten og preview gjenstår. |
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
- [x] Samlet CI for admin og foundation består både webjobben og databasejobben
      fra tom database.

Foundation-migrasjonene er verifisert fra tom lokal database i CI.
Adminmigrasjonen er nå integrert etter profil- og innholdsmigrasjonene og
anvendt på det bekreftede stagingprosjektet. Samlet CI på commit `eefbcd9`
består med adminmigrasjonen og den nye admin-RLS-testen.

### Verifikasjonsstatus 2026-09-29

- **Implementert:** Profiltrigger, grunnskjema, innholdsregler, adminpanel,
  adminmigrasjon og en transaksjonell pgTAP-test for admin-RLS er integrert.
  Migrasjonsrekkefølgen er `085000` (profil), `085500` (innholdsregler) og
  `090000` (admin).
- **Lokalt verifisert:** `npm ci`, lint, TypeScript-typekontroll og
  produksjonsbygg består for den integrerte webappen. Docker er ikke
  tilgjengelig i agentmiljøet, så samlet lokal database-reset, lint og pgTAP
  kunne ikke kjøres.
- **CI-verifisert:** Samlet commit `eefbcd9` består webjobben og databasejobben
  fra tom database, inkludert databaselint, foundation-pgTAP,
  adminmigrasjonen og admin-RLS-testen.
- **Stagingidentitet:** Management API-kallet for eksakt
  `SUPABASE_PROJECT_ID` svarte HTTP 200 med samme ref, navnet
  `norskprove-ki-staging` og region `eu-west-1`. URL-ref samsvarte også.
- **Stagingmigrasjoner:** CLI ble linket til staging. Nettverket mangler IPv6,
  og tokenet mangler lesetilgang til pooler-konfigurasjonen, så migrasjonskall
  ble kjørt gjennom stagingprosjektets IPv4 session-pooler. Ny dry-run viste
  kun `20260929090000_admin_panel.sql` som pending. Den ble anvendt uten seed,
  roller, Vault-endringer eller reset. Etterkontrollen viser alle åtte lokale
  og remote migrasjonsversjoner i samsvar.
- **API og RLS i staging:** Auth-health svarte HTTP 200, og tabellkall gjennom
  REST svarte HTTP 200. En midlertidig serveropprettet testbruker fikk profil
  automatisk, kunne lese bare sin egen profil og bare den publiserte av to
  testoppgaver. Anonym bruker så ingen av testoppgavene, og elevens forsøk på
  å opprette en oppgave ble avvist med HTTP 403. Testbrukeren og alle
  testoppgaver ble slettet; etterkontrollen viste null gjenværende rader.
- **Admin i staging:** Tabellene `admin_brukere` og `lydfiler`, den
  `SECURITY DEFINER`-merkede funksjonen `er_admin`, to private Storage-bøtter
  og åtte adminpolicyer er verifisert. En eksplisitt SQL-transaksjon med
  midlertidig admin og elev bestod 21 pgTAP-sjekker: admin kunne lese, opprette
  og redigere kladder, godkjenne bilde, skrive lydmetadata og bruke privat
  Storage. Elev og anonym bruker kunne ikke lese kladder, lydmetadata eller
  private objekter og kunne ikke skrive admininnhold. Transaksjonen ble rullet
  tilbake; etterkontroll viste null testbrukere, adminrader, oppgaver, bilder,
  lydfiler og Storage-objekter.
- **Offentlig registrering fortsatt blokkert:** Før ett kontrollert nytt forsøk
  ble alle fem forventede miljøvariabler bekreftet som satt, URL og prosjekt-ref
  samsvarte, og et direkte Management API GET svarte HTTP 200 med refen og
  navnet `norskprove-ki-staging`. Det eneste offentlige signup-forsøket brukte
  den unike syntetiske adressen
  `norskprove-ki-staging-signup-check+20260929121337-977489dc43@example.com`,
  men Auth svarte HTTP 429 med `over_email_send_rate_limit`. En
  sertifikat- og vertsnavnverifisert TLS-forbindelse til stagingdatabasen viste
  etter forsøket null rader i `auth.users`, `public.brukerprofil` og
  `auth.identities`. Oppryddingskontrollen viste fortsatt null rader.
  Profiltriggeren er derfor ikke bekreftet gjennom offentlig signup.
- **Gjenstår i staging:** Første varige stagingadministrator er ikke opprettet,
  og ugyldig filtype og filstørrelse er ikke ende-til-ende-testet i både app og
  Storage.

### Neste handling

1. Avklar en autorisert e-postløsning for staging før et nytt offentlig
   registreringsforsøk. Neste eksterne handling bør være dedikert SMTP eller en
   eksplisitt godkjent Auth-testinnstilling; ikke svekk e-postbekreftelse,
   ratebegrensning eller andre sikkerhetsinnstillinger for å omgå sperren.
   Gjenta deretter offentlig registrering én gang og bekreft profiltriggeren.
2. Opprett den første varige stagingadministratoren med en autorisert
   servercredential og gjennomfør en UI-smoketest uten å legge privilegerte
   nøkler i klienten.
3. Test filtype- og størrelsesavvisning i både applikasjon og Storage.
4. Verifiser Vercel preview-miljøet med stagingkonfigurasjon.
5. Valider eksisterende produksjonsdata før `NOT VALID`-constraints aktiveres
   fullt senere. Ingen produksjonsendring er utført i denne verifikasjonen.

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
| 2026-09-29 | Gjentok offentlig stagingregistrering med nøyaktig ett kontrollert forsøk | Fem miljøvariabler, URL/ref og stagingidentitet ble kontrollert først; Auth svarte HTTP 429 `over_email_send_rate_limit`, databasen viste ingen opprettet bruker, profil eller identitet, og null gjenværende testrader ble bekreftet. Autorisert SMTP eller godkjent Auth-testinnstilling er neste eksterne avklaring |
| 2026-09-29 | Verifiserte samlet CI for admin og foundation | Commit `eefbcd9` består både web- og databasejobben fra tom database, inkludert adminmigrasjonen og admin-RLS-testen |
| 2026-09-29 | Integrerte adminpanelet og stagingverifiserte adminmigrasjon og RLS | Dry-run viste kun adminmigrasjonen; åtte migrasjoner samsvarer nå, adminskjemaet er verifisert og 21 transaksjonelle RLS-sjekker bestod med rollback og tom etterkontroll |
| 2026-09-29 | Verifiserte foundation-migrasjoner og grunnleggende RLS i eksakt stagingprosjekt | Direkte prosjektoppslag bekreftet stagingidentiteten; syv forventede migrasjoner ble anvendt og profil/anon/elev-RLS ble testet med full opprydding, mens registreringsrate og manglende adminmigrasjon holder fase 1 åpen |
| 2026-09-29 | Første versjon av gjennomføringsplanen | Etablerer robust arbeidsrekkefølge og kvalitetsporter for videre utvikling |
