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
| 1. Stabiliser fundamentet | Pågår | Prosjektplan etablert. Adminpanel er implementert på egen branch, men staging- og produksjonsverifisering gjenstår. |
| 2. Datakontrakter | Ikke startet | Avventer fullført kvalitetsport for fase 1. |
| 3. Første elevflyt | Ikke startet | Avventer oppgavekontrakt for `fyll_inn`. |
| 4–9 | Ikke startet | Avventer foregående kvalitetsporter. |

### Neste handling

1. Etabler CI og dokumentert miljøkonfigurasjon.
2. Opprett `brukerprofil` automatisk og sikkert ved registrering.
3. Kjør adminmigrasjonen i staging og verifiser RLS med tre roller.

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
| 2026-09-29 | Første versjon av gjennomføringsplanen | Etablerer robust arbeidsrekkefølge og kvalitetsporter for videre utvikling |
