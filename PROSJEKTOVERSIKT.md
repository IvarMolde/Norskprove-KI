# Norskprøve-KI – Prosjektoversikt

Dette dokumentet er kilden til sannhet for hvordan appen er tenkt å fungere.
Oppdater det når beslutninger endres – ikke la det bli utdatert mens koden
går videre.

## Hva dette er

En app for å øve til Norskprøven (A1–B2), under Lingx-merkevaren. Rettet
primært mot privatmarkedet, men skal også kunne selges til
voksenopplæringssentre. Helt separat fra Yrkesappen (solgt, ikke i bruk
videre) og resten av Lingx-porteføljen – eget repo, egen database, ingen
delt infrastruktur.

## Forretningsmodell

| Nivå | Pris | Økter | Ekstra |
|---|---|---|---|
| Gratis | 0 kr | 1–2 totalt | Engangssmakebit, ingen automatisk nivåtest |
| Basis | 499 kr/mnd | 15/mnd | Pause-og-fortsett |
| Pluss | 699 kr/mnd | 30/mnd | + Skriftlig KI-vurdering |
| Komplett | 899 kr/mnd | 60/mnd | + Muntlig KI-vurdering, adaptiv prøve, full eksamenssimulering |

Rettigheter styres via `plan_rettigheter`-tabellen, ikke hardkodet
plansjekk i koden – koden spør alltid «har bruker rettighet X», aldri
«hvilken plan har bruker».

## Innholdsbank

**Oppgaver** (`oppgaver`-tabellen): type-agnostisk skjema – fast metadata i
kolonner (type, ferdighet, nivå, tema, kilde, status), type-spesifikt
innhold i en `innhold jsonb`-kolonne. Unngår kolonnehull når nye
oppgavetyper legges til.

**13 oppgavetyper**, maks 5–6 per oppgavesett:
fyll inn, synonym, antonym, dra til forklaring, setningsstruktur, merk
ordet, påstand korrekt, rekkefølge, fritekst, diktat, hotspot-bilde, velg
bilde, muntlig opptak.

**Oppgavesett-størrelse** (validert mot ekte Norskprøve-struktur):
- Leseforståelse: 14–16 (basis) / større på full eksamenssimulering (899 kr)
- Lytting: 18–20
- Skriftlig: 3–4, basert på ekte oppgavetyper (kort melding – identisk hver
  periode, bildebeskrivelse, kjent tema, meningsytring/argumentasjon)

**Bilder** (`bilder`-tabellen, egen fra `oppgaver`): nivå-uavhengig
gjenbruk – samme bilde kan kobles til flere oppgaver på ulike nivå. Egne
opplastede bilder krever manuell godkjenning før publisering
(`status: venter_godkjenning`). KI-genererte bilder (Google Imagen) er
godkjent automatisk. Kreditering vises som liten tekst under bildet, kun
når `kreditering_pakrevd = true`.

**Lyd**: tre kilder til `lyd_url` – eget opptaksstudio (nettleserbasert,
MediaRecorder), opplastede mp3-er, eller Google Cloud TTS. Alle
normaliseres (volum/format) og transkriberes med NB Whisper for
kvalitetssjekk (diff mot fasit-tekst).

**Kostnadskontroll**: banken sjekkes alltid før KI-generering. Ny
generering skjer kun når banken ikke har noe passende for
nivå+tema+type+bruker. `ganger_servert`-telling sikrer rettferdig rotasjon.
`bruker_oppgave_historikk` hindrer at samme bruker får samme oppgave to
ganger (skrives ved besvarelse, ikke ved visning).

## Adaptiv prøve (899 kr)

Regelbasert forgrening, ikke ekte IRT: `forprove1` → `forprove2_lett`
eller `forprove2_vanskelig` → én av tre hovedprøve-varianter
(`hovedprove_a1a2` / `hovedprove_a2b1` / `hovedprove_b1b2`). Terskelverdier
er startestimater, ikke kalibrerte tall – juster etter faktiske brukerdata.
Genererer datagrunnlag for ekte IRT-kalibrering senere.

## KI-vurdering

**Skriftlig** (`prompts/skriveprove-vurdering-prompt.md`): fem offisielle
kriterier vurdert hver for seg – tekstoppbygging, rettskriving,
tegnsetting, ordforråd, grammatikk. CEFR-nivå per kriterium, ikke
poengsum. Ignorerer boilerplate-fraser og sjangerkunnskap.

**Muntlig** (`prompts/muntlig-vurdering-prompt.md`): to-lags struktur som
matcher ekte sensorvurdering – formidling vurderes per oppgave, språklige
kriterier (flyt, uttale, ordforråd, grammatikk) vurderes holistisk over
hele økten. Fase 1: individuelle oppgaver (fortelle, beskrive bilde). Fase
2 (utsatt): samtale-format, krever KI som sanntids-samtalepartner.

**Felles for begge**: tilbakemelding til eleven skrives ett nivå enklere
enn det vurderte nivået, slik at eleven faktisk forstår sin egen
tilbakemelding. `usikker_vurdering`-flagg (og `usikker_pga_lyd` for
muntlig spesifikt) mater et spot-sjekk-dashbord – lydbasert vurdering av
flyt/uttale er en yngre, mindre bevist kapabilitet enn tekstbasert
vurdering, og bør stikkprøves oftere i starten.

## Pålogging og sikkerhet

Supabase Auth: e-post/passord + magic link + Google, pluss valgfri
«Logg inn med Vipps». SMS-verifisering + enhets-/IP-sjekk kun ved
gratis-registrering (betaling er identitetsbeviset for betalende kunder,
ingen ekstra friksjon der). Minstealder 18 år.

## Betaling

Vipps primært, Stripe for kortbetaling.

## Øktlogikk

Autolagring av svar alltid på, uavhengig av tier. Pause-og-fortsett
(`okt_tilstand` + `okt_oppgaver`, som fryser settet ved øktstart) kun for
betalende, også under full eksamenssimulering.

## Personvern

EU/EØS-datalagring (Supabase-prosjektet kjører i Irland). Lydopptak
slettes automatisk etter 30 dager. Skriftlige besvarelser/øvingsdata
beholdes så lenge kontoen er aktiv. Ingen analytics eller
samtykkebanner – kun nødvendige cookies. Ingen institusjonsvisning av
enkeltelevers fremgang i v1. Rettslig grunnlag er avtale (ikke samtykke)
for kjernefunksjonalitet. Personvernerklæring og databehandleravtaler med
alle underleverandører (Supabase, Google, Vercel, Stripe, Vipps) er
obligatorisk og under arbeid.

## WCAG / Universell utforming

Lovkrav som privat virksomhet: WCAG 2.0 nivå A/AA. Bygges likevel til
2.1 AA, siden institusjonskunder (voksenopplæringssentre) kan kreve det.
Nøkkelpunkter: `beskrivelse`-feltet på bilder = alt-tekst,
`transkripsjon`-feltet på lyd = synlig tekstalternativ, tastaturalternativ
til alle dra/klikk-baserte oppgavetyper, grensesnitt-tekst aldri over
A2-nivå uavhengig av øvingsnivå.

## Infrastruktur

- **GitHub:** `IvarMolde/Norskprove-KI`, eget repo
- **Supabase:** prosjekt `norskprove-ki`, EU West (Irland), egen
  selvstendig database – ikke delt med andre Lingx-produkter
- **Next.js:** App Router, TypeScript, Tailwind CSS, i `web/`-mappen i
  repoet
- **Vercel:** eget prosjekt (ikke satt opp ennå)
- Kodestruktur: rettighets-/abonnementslogikk bygges som en ryddig
  avgrenset modul, klar til å kopieres inn i en fremtidig app den dagen
  det faktisk trengs – ingen delt pakke/tjeneste bygget på forskudd

## Status – hva som faktisk er bygget

- [x] Datamodell ferdig spesifisert og anvendt i produksjon (5
      migrasjoner, 13 tabeller, RLS verifisert direkte mot `pg_class`)
- [x] KI-vurderingsprompt for skriftlig ferdig
- [x] KI-vurderingsprompt for muntlig ferdig (fase 1-oppgaver)
- [x] Next.js-prosjekt initialisert
- [ ] Supabase-klient koblet til Next.js (pågår)
- [ ] Admin-panel (opptaksstudio, bildebank, oppgave-editor)
- [ ] Frontend for oppgavetypene
- [ ] KI-genereringspipeline (Gemini tekst, Google TTS, Google Imagen)
- [ ] Betalingsintegrasjon (Vipps + Stripe)
- [ ] Personvernerklæring + databehandleravtaler
- [ ] «Info om prøvene»-side
- [ ] Vercel-oppsett og domene
- [ ] Muntlig fase 2 (samtale-oppgave)

## Åpne beslutninger (ingen avklart ennå)

Ingenting kjent uavklart per nå utover det som står i statuslisten over
som ikke er bygget. Alt som har vært diskutert i planleggingssamtalen er
låst.
