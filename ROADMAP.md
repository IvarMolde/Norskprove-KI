# Roadmap – Norskprøve-KI

Dette er rekkefølgen vi bygger i. Produktreglene ligger i `PROSJEKTOVERSIKT.md`.
Denne filen sier hva som kommer først, hva som er ferdig, og hva vi endrer
underveis.

Oppdater **Status** og **Logg** i samme endring som arbeidet de beskriver.
Ikke la veikartet ligge etter koden.

## Slik bruker vi den

- Vi tar neste uavkryssede punkt i aktiv fase. Vi hopper ikke til en senere
  fase fordi den er mer synlig.
- En fase er ferdig først når ferdigkriteriet er sant i appen, mot lokal
  Supabase.
- Nye beslutninger skrives inn her før koden følger dem. Avvik fra
  prosjektoversikten oppdaterer begge filer.

## Prinsipper

- Første leveranse er én ekte leseøkt: logg inn, sjekk rettighet, hent sett,
  vis oppgave, lagre svar, vis poengsum.
- Koden spør «har bruker rettighet X», aldri «hvilken plan har bruker».
- Innholdsbanken fylles med håndskrevne, publiserte oppgaver før vi genererer
  noe med KI.
- Første oppgavetype skal kunne løses med tastatur. Grensesnitt-tekst holder
  seg på A2.
- Rettighetsmodulen bygges som en avgrenset modul i denne appen. Ingen delt
  pakke på forskudd.

## Status nå

Aktiv fase: **7. Ut til brukere**. Fase 1 til 6 er ferdige.

Ferdig fra før: datamodell i produksjon, KI-promptene, Next.js-app som viser
`abonnement_plan`, og e-post/passord-innlogging.

## Fase 1. Første leseøkt

Ferdig 2026-10-03. En innlogget bruker med gratisplan gjennomførte en
leseøkt, fikk poengsum, og kunne ikke starte en ny økt da grensen på 2
økter totalt var nådd. Samme oppgave kom ikke igjen etter at den var
besvart.

1. Lås jsonb-formen for `pastand_korrekt` i avsnittet «Kontrakter» under.
2. Legg inn et lite publisert A2-lesesett (`ferdighet = lesing`,
   `type = pastand_korrekt`, `status = publisert`) som seed, ikke via admin.
3. Bygg rettighetsmodulen mot `plan_rettigheter` og `brukerprofil`. Gratis
   har ingen av rettighetene pause, KI eller adaptiv prøve, og har
   `okter_grense = 2` med `okter_periode = totalt`.
4. Start økt: skriv `okt_tilstand` og frys oppgavene i `okt_oppgaver`.
   Hopp over oppgaver som allerede ligger i `bruker_oppgave_historikk`.
5. Vis én oppgave om gangen. I fase 1 har en økt inntil 2 oppgaver, så
   grensen på 2 økter kan prøves med det lille settet. Autolagre i
   `bruker_svar`. Øk `siste_posisjon` og `sist_lagret`.
6. Ved besvarelse: skriv `bruker_oppgave_historikk` og øk
   `oppgaver.ganger_servert`.
7. Avslutt økten som `fullfort` og vis poengsum.
8. Når brukeren har to fullførte økter, skal en ny økt avvises med en
   kort forklaring på A2.

## Fase 2. Lesing som kan øves på

Ferdig 2026-10-03. En leseøkt inneholder flere oppgavetyper, uten bilder
og lyd, og har 15 oppgaver når banken har nok.

- Legg til `fyll_inn`, `synonym`, `antonym` og `rekkefolge`, én type om
  gangen, med jsonb-kontrakt i denne filen før UI.
- Hold dra-og-slipp (`dra_til_forklaring`, `merk_ordet`) til de har et
  tastaturalternativ.
- Poengsum skal tåle flere typer i samme økt.

Beslutning 2026-10-03: en leseøkt har 15 oppgaver når banken har nok,
og høyst 6 av samme type. Utvalget går på omgang mellom typene, med
minst brukte oppgave først innen hver type. Poeng er summen av delpoeng:
hver påstand, hvert hull, hvert ordvalg og hver rekkefølge.

## Fase 3. Redigere innhold uten SQL

Ferdig 2026-10-04. En innlogget redaktør opprettet, publiserte og
arkiverte en leseoppgave i appen. Eleven så den publiserte oppgaven uten
fasitordet. En ny elev fikk den ikke etter arkivering.

- Én oppgaveeditor for typene fra fase 1 og 2.
- Rolle skilles fra elev. Redaktør kan skrive oppgaver. Eleven ser
  publiserte oppgaver gjennom øktfunksjonene, uten fasit før svar.
- Bildebank og opptaksstudio venter til lyd og bilder trengs.

Beslutning 2026-10-04: `brukerprofil.rolle` er `elev` eller `redaktor`.
Eleven kan ikke endre rollen selv. Rollen settes i databasen til det
finnes et eget verktøy for det. Redaktør leser og skriver oppgaver
gjennom funksjoner, ikke ved å åpne tabellen. Eleven ser fortsatt bare
`status = publisert`, og bare uten fasit før svar.

Editoren har én form for de fem lesetypene. Formen er fast: to
påstander, ett hull mellom to tekstdeler, tre alternativer, eller tre
ledd i riktig rekkefølge. For rekkefølge settes visningen til omvendt
rekkefølge. Stemmer ikke en lagret oppgave med formen, kan den
arkiveres, men ikke endres i skjemaet. En ny oppgave lagres som kladd
eller publiseres. Typen låses etter opprettelse. `kvalitetssjekket`
settes når oppgaven publiseres. Hullets id skal ikke inneholde
fasitordet.

## Fase 4. Lytting

Ferdig 2026-10-04. En lytteøkt hadde 18 oppgaver. Hver oppgave hadde
lydfil og synlig transkripsjon. Eleven fikk 36 av 36 riktige. Besvarte
oppgaver kom ikke igjen.

- Lyd kommer fra opplastede filer. Generering med Google TTS og
  Whisper-sjekk kommer etter at avspilling og svar fungerer.
- `diktat` får egen kontrakt før den bygges.

Beslutning 2026-10-04: første lytteoppgave er `pastand_korrekt`. Innholdet
er det samme som i lesing. `lyd_url` er en fil i appen, på formen
`/lyd/navn.mp3`. `transkripsjon` vises alltid, og er teksten eleven hører.
`korrekt` sendes ikke før svar. En lytteøkt har 18 oppgaver når banken har
nok, og bare denne typen. Har banken færre, får eleven de som finnes.
Gratisgrensen teller fortsatt alle fullførte økter. Redaktør for lyd og
`diktat` venter til avspilling og svar virker.

## Fase 5. Skriftlig øving og KI-vurdering

Ferdig 2026-10-04. En bruker med rettigheten leverte en kort melding og fikk
vurderingen tilbake. Samlet nivå var A2. Tilbakemeldingen var kort, og den
ble lagret i `skriftlig_vurdering` sammen med `usikker_vurdering`. En bruker
uten rettigheten ble avvist. Besvart oppgave kom ikke igjen.

Ferdig når en bruker med rettigheten `skriftlig_ki_vurdering` kan levere en
fritekst og få vurdering tilbake ett nivå enklere enn vurdert nivå, lagret i
`skriftlig_vurdering`.

- Prompten i `prompts/skriveprove-vurdering-prompt.md` brukes som den er.
- `usikker_vurdering` lagres. Et stikkprøve-dashbord kan vente til det finnes
  flere vurderinger.
- Bank sjekkes før eventuell KI-generering av nye oppgaver. Generering er
  ikke en del av ferdigkriteriet for denne fasen.

Beslutning 2026-10-04: første skriveoppgave er én håndskrevet, publisert
A2-oppgave. `ferdighet = skriving`, `type = fritekst`, `kilde = autentisk`.
Oppgavetypen er `kort_melding` på nivågruppen `A1-A2`. Kort melding har
ikke ordkrav (`min_ord = 0`). For kort tekst setter sensoren
`usikker_vurdering`. En skriveøkt har denne ene oppgaven. Den blir
`fullfort` når vurderingen er lagret, og teller mot samme øktgrense som
lesing og lytting.

Rettigheten sjekkes i databasefunksjonen, ikke bare på siden. Uten
rettighet avvises både start og lagring med `mangler_rettighet`. Eleven
ser ikke plan-id.

Hele den utfylte systemprompten er hele modellkallet. Backend bytter bare
ut `{{NIVAGRUPPE}}`, `{{OPPGAVETYPE}}`, `{{OPPGAVETEKST}}`,
`{{MIN_ORDANTALL}}` og `{{ELEVSVAR}}`. Promptfilen endres ikke. Kallet ber
i tillegg om JSON i skjemaet prompten allerede beskriver, så svaret kan
lagres. Appen kaller et OpenAI-kompatibelt chat-API. `OPENAI_API_KEY` kreves.
`OPENAI_BASE_URL` og `OPENAI_MODEL` kan overstyres. Standard er
`gpt-4o-mini` mot `https://api.openai.com/v1`. Nøkkelen ligger i miljøet,
ikke i repo. Mangler nøkkelen, får eleven en kort forklaring, og ingen
vurdering lagres.

`tilbakemelding_til_elev` skrives ett nivå enklere av sensoren, slik
promptregel 5 sier. Appen viser den teksten. Den skriver den ikke om med
en ny modell. En setning som nevner modellens eget navn, tas bort før
lagring. Resten lagres som sensoren skrev den. Eleven ser også samlet nivå, tre forbedringspunkter og det
positive elementet. Begrunnelsene i `kriterier` lagres, men vises ikke på
siden.

Lagring skjer i `lagre_skriftlig_vurdering`, som bare `service_role` kan
kalle. Serveren leser `SUPABASE_SERVICE_ROLE_KEY`. Nøkkelen sendes ikke til
nettleseren. Eleven kan ikke sette inn i `skriftlig_vurdering`. Funksjonen
skriver `bruker_svar`, vurderingen, historikk og øktstatus. Stikkprøve-
dashbord og KI-generering av oppgaver venter.

## Fase 6. Betaling

Ferdig 2026-10-04. En gratisbruker kjøpte Basis, Pluss og deretter
Komplett. Rettighetene fulgte `plan_rettigheter`: pause etter Basis,
skriftlig vurdering etter Pluss, muntlig og adaptiv prøve etter Komplett.
Samme side, uten kode per plan. En leseøkt ble pauset og tatt opp igjen
med samme oppgave. Ingen penger ble trukket. Vipps, Stripe og
SMS-verifisering er ikke bygd.

Ferdig når en bruker kan gå fra gratis til Basis, Pluss eller Komplett, og
rettighetene følger `plan_rettigheter` uten kodeendring per plan.

- Vipps først, Stripe etterpå.
- Betalende får `pause_gjenoppta`: økten kan settes til `avbrutt_lagret` og
  tas opp igjen med samme rader i `okt_oppgaver`.
- SMS-verifisering gjelder bare gratis-registrering.

Beslutning 2026-10-04: en innlogget bruker velger Basis, Pluss eller
Komplett. Beløpet leses fra `abonnement_plan`, ikke fra nettleseren.
Ordren lagres som `venter`. Planen endres først når ordren er `betalt`.
Bekreftelsen kan bare skje fra serveren. Uten Vipps-nøkler kan lokal
utvikling bekrefte ordren når `BETALING_LOKAL_BEKREFTELSE=1` og databasen
er lokal. Da trekkes ingen penger. Samme bekreftelse skal brukes når
Vipps kobles på. Stripe og SMS-verifisering venter. De er ikke en del av
ferdigkriteriet nå.

Etter kjøpet spør siden «har bruker rettighet X». Den spør ikke hvilken
plan som ble kjøpt. `pause_okt` setter en pågående leseøkt til
`avbrutt_lagret` uten å endre `okt_oppgaver`. `gjenoppta_okt` setter den
tilbake til `pagaende`. Uten rettigheten `pause_gjenoppta` kan økten ikke
pauses. Eleven kan ikke endre egen plan.

## Fase 7. Ut til brukere

Ferdig når en ny bruker kan lese personvernerklæringen, opprette konto og
ta en leseøkt på det offentlige domenet. Det offentlige domenet er ikke
satt opp. Fasen er derfor ikke ferdig.

- Personvernerklæring og databehandleravtaler (Supabase, og senere Google,
  Vercel, Stripe, Vipps) skrives før åpen lansering. Utkast kan starte
  parallelt med fase 1.
- «Info om prøvene»-side.
- Vercel-prosjekt og domene. Supabase forblir i EU West (Irland).

Beslutning 2026-10-04: første del er et utkast på `/personvern` og en
side på `/prove`. Utkastet sier hva vi lagrer, at grunnlaget er avtale,
og at sletting av konto ikke er bygd ennå. Vi finner ikke på
organisasjonsnummer, adresse eller e-post. Databehandleravtaler skrives
ikke i denne delen.

Registrering krever to avhukinger: at personvernerklæringen er lest, og
at brukeren er 18 år. Etterpå kaller appen `bekreft_alder()`. Den setter
`alder_bekreftet_metode` til `egenerklaert`, og bare når feltet er tomt.
Innlogging krever ikke avhukingene. Vercel, domene og avtalene venter.

Beslutning 2026-10-04: en innlogget bruker kan slette egen konto på
`/konto`. Knappen er av til de har huket av at de vil slette.
`slett_egen_konto()` tar ingen bruker-id fra klienten. Den sletter svar,
økter, vurdering, historikk og bestillinger, og deretter brukeren.
Oppgaver og bilder i banken blir liggende. Feltet som pekte på brukeren
settes tomt. Fasen er fortsatt ikke ferdig.

Beslutning 2026-10-04: utkast til databehandleravtaler ligger på
`/databehandlere`. Hver leverandør har status «ikke signert». Utkastet
sier hva de skulle behandle, hvor det skal ligge, og at de bare skal
følge våre instruksjoner. Navn, organisasjonsnummer, adresse og e-post
står tomme. Avkrysningen i prosjektoversikten blir stående åpen.
Vercel og domene venter. Fasen er ikke ferdig.

## Fase 8. Muntlig og adaptiv prøve

Ferdig når Komplett-planen kan ta en muntlig fase-1-økt og en adaptiv prøve
etter reglene i prosjektoversikten.

- Muntlig fase 1 bruker `prompts/muntlig-vurdering-prompt.md` og
  `muntlig_vurdering`. Lyd slettes etter 30 dager.
- Adaptiv prøve følger `forprove1` → `forprove2_lett` eller
  `forprove2_vanskelig` → én av `hovedprove_a1a2`, `hovedprove_a2b1`,
  `hovedprove_b1b2`. Tersklene i `adaptiv_terskler` er startestimater.
- Muntlig fase 2 (sanntidssamtale) starter etter at fase 1 er i bruk.

## Kontrakter

Jsonb-former låses her før tilhørende UI bygges.

### `pastand_korrekt`

Låst 2026-10-03. Én tekst og en eller flere påstander. Eleven svarer ja
eller nei på hver påstand. Riktig svar ligger i `korrekt` og sendes ikke
til nettleseren før påstanden er besvart.

Innhold i `oppgaver.innhold`:

```json
{
  "tittel": "Bussen til jobb",
  "tekst": "Anna tar buss nummer 31 til jobb.",
  "pastander": [
    { "id": "buss-1", "tekst": "Anna kjører bil til jobb.", "korrekt": false }
  ]
}
```

Svar i `bruker_svar.svar_tekst`:

```json
{
  "valg": [{ "id": "buss-1", "svar": false }]
}
```

`id` i svaret må finnes blant påstandene. Ved besvarelse skal hver påstand
ha ett ja/nei-svar. Poeng er antall påstander der `svar` er lik `korrekt`.

Eleven leser ikke tabellen `oppgaver` direkte. Beslutning 2026-10-03:
SELECT-policyen på publiserte oppgaver er tatt bort, fordi `innhold` har
fasiten. Svar kan heller ikke skrives rett i `bruker_svar` eller
`okt_tilstand` fra nettleseren. Øktfunksjonene gjør det.

### `fyll_inn`

Låst 2026-10-03. En setning med ett eller flere hull. Eleven skriver
ordet. `fasit` sendes ikke til nettleseren før oppgaven er besvart.
Sammenligningen ignorerer store bokstaver og ekstra mellomrom.

Innhold i `oppgaver.innhold`:

```json
{
  "tittel": "Om morgenen",
  "tekst": "Per liker varm drikke til frokost.",
  "deler": [
    { "type": "tekst", "tekst": "Jeg drikker " },
    { "type": "hull", "id": "drikke-1" },
    { "type": "tekst", "tekst": " om morgenen." }
  ],
  "fasit": [{ "id": "drikke-1", "ord": ["kaffe"] }]
}
```

Svar i `bruker_svar.svar_tekst`:

```json
{ "hull": [{ "id": "drikke-1", "svar": "kaffe" }] }
```

Hvert hull er ett poeng når det normaliserte svaret finnes i `ord`.

### `synonym` og `antonym`

Låst 2026-10-03. Ett ord i en setning, og tre alternativer. Eleven velger
med tastatur. `korrekt` sendes ikke før oppgaven er besvart. `synonym`
ber om samme betydning. `antonym` ber om motsatt betydning.

```json
{
  "tittel": "Samme betydning",
  "ord": "glad",
  "setning": "Barnet er glad i dag.",
  "alternativer": [
    { "id": "glad-a", "tekst": "lykkelig" },
    { "id": "glad-b", "tekst": "trist" },
    { "id": "glad-c", "tekst": "sint" }
  ],
  "korrekt": "glad-a"
}
```

Svar:

```json
{ "valgId": "glad-a" }
```

Ett poeng når `valgId` er lik `korrekt`.

### `rekkefolge`

Låst 2026-10-03. Tre eller flere ledd som skal stå i riktig rekkefølge.
`visning` er rekkefølgen eleven ser. `riktig` sendes ikke før oppgaven
er besvart. Eleven flytter ledd med knappene Opp og Ned, ikke med
dra-og-slipp.

```json
{
  "tittel": "Morgenrutine",
  "ledd": [
    { "id": "m1", "tekst": "Først lager han kaffe." },
    { "id": "m2", "tekst": "Så spiser han brød." },
    { "id": "m3", "tekst": "Til slutt går han ut." }
  ],
  "visning": ["m3", "m1", "m2"],
  "riktig": ["m1", "m2", "m3"]
}
```

Svar:

```json
{ "rekkefolge": ["m1", "m2", "m3"] }
```

Ett poeng når listen er lik `riktig`.

### Lytting `pastand_korrekt`

Låst 2026-10-04. Samme `innhold` som lesingens `pastand_korrekt`. I tillegg
skal raden ha `lyd_url` og `transkripsjon`.

`lyd_url` peker på en lydfil appen selv har, for eksempel `/lyd/buss.mp3`.
Eleven spiller den av i nettleseren. Transkripsjonen er den samme teksten
som blir sagt, og den vises på siden. Den er ikke fasit. Fasiten er fortsatt
`korrekt` på hver påstand, og den sendes ikke før oppgaven er besvart.

Svaret er det samme som i lesing:

```json
{
  "valg": [{ "id": "buss-1", "svar": false }]
}
```

Poeng er antall påstander der `svar` er lik `korrekt`.

### `fritekst`

Låst 2026-10-04. Én oppgavetekst eleven skal svare på med fri tekst.
Fasit finnes ikke. Sensoren vurderer svaret etter prompten.

Innhold i `oppgaver.innhold`:

```json
{
  "tittel": "Sms til en kollega",
  "tekst": "Skriv en kort sms til en kollega. Si at du blir sen til møtet i dag, og si når du kommer.",
  "oppgavetype": "kort_melding",
  "nivagruppe": "A1-A2",
  "min_ord": 0
}
```

`oppgavetype` er `kort_melding`, `bildebeskrivelse`, `kjent_tema` eller
`meningsytring`. `nivagruppe` er `A1-A2`, `A2-B1` eller `B1-B2`.
`min_ord` er et heltall fra 0 og opp. `tittel` og `tekst` er ikke tomme.

Svaret er ren tekst, ikke json. Det lagres i `bruker_svar.svar_tekst`.
Vurderingen lagres i `skriftlig_vurdering` med formen fra
`prompts/skriveprove-vurdering-prompt.md`.

## Logg

Nyeste øverst.

### 2026-10-04

- Beslutning: utkast til databehandleravtaler på `/databehandlere`.
  Ingen avtale er signert. Navn, organisasjonsnummer, adresse og e-post
  står tomme. Avkrysningen i prosjektoversikten blir stående åpen.
  Fasen er ikke ferdig.
- Sletting verifisert lokalt. En ny bruker startet en leseøkt, huket av,
  og slettet kontoen. Brukeren, økten, svaret, vurderingen og
  bestillingen var borte. Oppgaven i banken ble liggende, uten peker
  til brukeren. Innlogging etterpå feilet. Anonym bruker kan ikke kalle
  funksjonen. Knappen er av uten avhuking. Fasen er ikke ferdig.
- Beslutning: innlogget bruker kan slette egen konto på `/konto`.
  Svar, økter, vurdering og bestillinger slettes. Oppgaver i banken
  blir liggende. Fasen er ikke ferdig.
- Lokal flyt verifisert. En ny bruker leste personvernutkastet, huket av
  begge boksene, og ble registrert. `alder_bekreftet_metode` ble
  `egenerklaert`. Deretter startet en leseøkt, oppgave 1 av 15. Registrer
  er av uten avhuking. Innlogging virker uten avhuking. Anonym bruker kan
  ikke kalle `bekreft_alder`. Eleven kan ikke sette metoden selv. Et felt
  som allerede er `vipps` blir ikke overskrevet. Vercel, domene og
  databehandleravtaler er ikke gjort. Fasen er ikke ferdig.
- Beslutning for fase 7: utkast til personvern på `/personvern`, info om
  prøvene på `/prove`, og registrering som lagrer alder som
  `egenerklaert`. Vercel, domene og databehandleravtaler er ikke gjort.
  Fasen er ikke ferdig. Det offentlige domenet finnes ikke ennå.
- Fase 6 verifisert. Gratisbruker ble Basis, så Pluss, så Komplett.
  Rettighetene fulgte tabellen. Leseøkten «Regn i dag» var den samme etter
  pause. Eleven kan ikke endre egen plan eller bekrefte betaling selv.
  Vipps, Stripe og SMS er ikke bygd.
- Beslutning for fase 6: planen endres først når ordren er betalt.
  Beløpet kommer fra databasen. Uten Vipps-nøkler kan lokal utvikling
  bekrefte ordren. Stripe og SMS venter.
- Fase 5 verifisert. En bruker med rettigheten skrev en sms og fikk
  vurderingen på siden. Nivået var A2. Teksten til eleven var kort.
  `usikker_vurdering` ble lagret. En bruker uten rettigheten fikk ikke
  starte. Samme oppgave kom ikke igjen. Eleven kan ikke sette inn
  vurderingen selv. Stikkprøve-dashbord og generering av oppgaver er ikke
  bygd.
- Kontrakt låst for `fritekst`. Første skriveoppgave er én håndskrevet
  kort melding. Vurderingen bruker prompten som den er, og lagres bare
  fra serveren.
- Fase 4 verifisert. En ny elev fikk 18 lytteoppgaver, med lydfil og
  transkripsjon på hver. Poengsummen ble 36 av 36. Besvarte oppgaver kom
  ikke igjen. Lydfilene er lest inn fra den skrevne teksten og lagret i
  appen.
- Redaktør for lyd og `diktat` er ikke bygd. De hører ikke til
  ferdigkriteriet for denne fasen.
- Første lytteøkt verifisert med fire A2-oppgaver. Eleven hører lydfilen,
  ser transkripsjonen, og får fasiten etter svar. Poengsummen ble 8 av 8.
  Besvarte oppgaver kom ikke igjen. Leseøkten tar ikke med lytteoppgaver.
  Lydfilene er lagret i appen. De er lest inn fra den skrevne teksten, og
  kan byttes til ekte opptak senere.
- Fase 4 er ikke ferdig. En full lytteøkt skal ha 18 oppgaver. Redaktør
  for lyd og `diktat` venter.
- Fase 3 verifisert. Redaktør lagret en fyll-inn-oppgave som kladd,
  publiserte den og arkiverte den. Kladden kom ikke med i en økt. Den
  publiserte oppgaven kom som oppgave 2, uten ordet «lampe». Etter
  arkivering kom den ikke med for en ny elev. Eleven kan ikke lese
  oppgavetabellen eller endre egen rolle.
- Beslutning: `brukerprofil.rolle` er `elev` eller `redaktor`. Editoren
  bruker faste former for de fem lesetypene.

### 2026-10-03

- Fase 2 verifisert. En ny bruker fikk 15 oppgaver, tre av hver av
  `pastand_korrekt`, `fyll_inn`, `synonym`, `antonym` og `rekkefolge`.
  Poengsummen tålte alle typene. Besvart oppgave kom ikke igjen.
- Kontrakter låst for `fyll_inn`, `synonym`, `antonym` og `rekkefolge`.
  En leseøkt har 15 oppgaver, høyst 6 av samme type.
- Fase 1 verifisert mot lokal Supabase og i nettleseren. Gratisbruker fikk
  poengsum, møtte ikke besvarte oppgaver igjen, og ble stoppet på tredje
  økt. Skjemaet nullstilles mellom oppgavene. En falsk feilmelding etter
  innsending er fjernet, så fasiten vises alene.
- Beslutning: fasit og øktgrense ligger i databasefunksjoner. Eleven leser
  ikke `oppgaver` direkte.
- Fase 1 er kodet: seed, rettigheter, øktfunksjoner og siden `/ov/lesing`.
- Veikart opprettet. Aktiv fase satt til 1, første leseøkt.
- Første oppgavetype valgt: `pastand_korrekt`, A2, lesing, håndskrevet seed.
- Personvernutkast kan starte parallelt, uten å flytte den aktive fasen.
