# Etter veikartet

Dette er det som må ordnes etter at `ROADMAP.md` er gjennomført.
Veikartet sier hva som kommer først. Denne filen sier hva som venter
til fase 1–8 er ferdige.

Ikke start på punktene her mens fase 7 eller 8 er aktiv. Oppdater
denne filen når et punkt blir gjort, eller når et nytt punkt blir
utsatt fra veikartet.

Status er skrevet 2026-10-04.

## Status hittil

Fase 1 til 6 er ferdige mot lokal Supabase.

- Lesing: 15 oppgaver, fem typer, poeng, øktgrense og historikk.
- Redaktør: fast skjema for de fem lesetypene. Rolle er `elev` eller
  `redaktor`.
- Lytting: 18 oppgaver med lydfil og transkripsjon.
- Skriving: én kort melding, vurdering med prompten som den er.
- Betaling: plan byttes når ordren er betalt. Pause følger
  `plan_rettigheter`. Ingen penger trekkes lokalt.
- Personvern: utkast, info om prøvene, alder som egenerklæring,
  sletting av egen konto, usignerte databehandleravtaler, og siden
  `/mine-data`.

Fase 7 er ikke ferdig. Det offentlige domenet finnes ikke.
Fase 8 er startet med én muntlig økt. Adaptiv prøve er ikke startet.
Beslutning 2026-10-05: resten av fase 7 venter på domene, Vercel,
signerte avtaler og Vipps. Den aktive fasen er likevel 8, fordi
brukeren ba om å fortsette.

Avkrysningene i `PROSJEKTOVERSIKT.md` er grovere enn veikartet. Noen
står åpne selv om en del av arbeidet er gjort. Bruk veikartet for
rekkefølge, og denne filen for det som kommer etterpå.

## Fortsatt i veikartet

Disse punktene hører ikke hjemme i listen under. De skal gjøres ferdig
før denne filen tas i bruk.

Fase 7, ut til brukere:

- En ny bruker skal kunne lese personvernet, lage konto og ta en
  leseøkt på det offentlige domenet.
- Vercel-prosjekt og domene. Supabase forblir i EU West (Irland).
  Produksjon er ikke databasen på denne maskinen.
- Personvernerklæring og databehandleravtaler skal signeres.
  Navn, organisasjonsnummer, adresse og e-post skal skrives inn.
  Utkastet på `/personvern` og `/databehandlere` er ikke nok.
- Før åpen lansering skal kjøp gå gjennom Vipps. Siden skjuler
  kjøpsknappene til Vipps er koblet på. Lokal test kan fortsatt vise
  dem. `BETALING_LOKAL_BEKREFTELSE` skal ikke stå på i produksjon.
- Few-shot mot offentlige sensorsvar fra HK-dir, slik
  `prompts/skriveprove-vurdering-prompt.md` ber om før lansering.

Fase 8, muntlig og adaptiv prøve:

- Muntlig fase 1 med `prompts/muntlig-vurdering-prompt.md` og
  `muntlig_vurdering`. Første økt er `individuell_fortelle`.
  Bildeoppgave gjenstår. Adaptiv prøve finnes i lesing og lytting.
  Fasen er ikke ferdig.
- Lydadressen i databasen nullstilles etter 30 dager. Filen i
  `muntlig-opptak` slettes samtidig, og når kontoen slettes.
- Adaptiv prøve med tersklene som finnes. De er startestimater.
- Tersklene justeres når det finnes brukerdata. Ekte IRT venter til
  etter veikartet.

## Etter at veikartet er gjennomført

### Muntlig videre

- [ ] Muntlig fase 2: sanntidssamtale. Starter først når fase 1 er i
      bruk. Krever en modell som kan være samtalepartner.
- [ ] Stikkprøve oftere på flyt og uttale enn på tekst. Flagget
      `usikker_pga_lyd` finnes. Dashbordet gjør det ikke.

### Vurdering og innholdskvalitet

- [ ] Stikkprøve-dashbord for `usikker_vurdering`, så usikre
      vurderinger kan leses av et menneske.
- [ ] Visning av progresjon per kriterium over tid. Rå-JSON lagres
      allerede. Eleven har ingen side for utviklingen.
- [ ] Ekte IRT-kalibrering når den adaptive prøven har nok svar.
      Fase 8 skal bare bruke startestimatene.

### Oppgavetyper som ikke er i fasene

Bygd nå: `pastand_korrekt`, `fyll_inn`, `synonym`, `antonym`,
`rekkefolge`, `fritekst` og lytting som `pastand_korrekt`.

Venter:

- [ ] `dra_til_forklaring` og `merk_ordet`, med tastatur. Ikke
      dra-og-slipp alene.
- [ ] `setningsstruktur`.
- [ ] `diktat`, med egen kontrakt i veikartet før skjerm.
- [ ] `hotspot-bilde` og `velg bilde`.
- [ ] `muntlig opptak` som oppgavetype utover fase 8 sin første økt,
      hvis banken skal ha flere muntlige former.
- [ ] Skriftlig bank utover én kort melding: bildebeskrivelse, kjent
      tema og meningsytring. Et skriftlig sett er tenkt som 3–4
      oppgaver.
- [ ] Lytting utover 18 påstander, og ekte opptak. Lydfilene nå er
      lest inn fra den skrevne teksten.
- [ ] Full eksamenssimulering på Komplett, med større lesesett enn
      de 15 oppgavene i øvingen.

### Lyd, bilde og generering

- [ ] Bildebank, manuell godkjenning av opplastede bilder, og
      kreditering når `kreditering_pakrevd` er sant.
- [ ] Opptaksstudio i nettleseren.
- [ ] Google TTS, normalisering av lyd, og NB Whisper mot
      transkripsjonen.
- [ ] Google Imagen for bilder som kan godkjennes automatisk.
- [ ] KI-generering av oppgaver. Banken skal sjekkes først. Generering
      skjer bare når det ikke finnes en passende publisert oppgave.
- [ ] Redaktør for lyd, bilder og flere former enn de fem faste
      lesetypene.
- [ ] Et verktøy for å gi noen rollen `redaktor`. I dag settes rollen
      i databasen.

### Betaling og pålogging som ikke lukker en fase

Fase 6 er ferdig uten ekte trekk. Stripe og SMS er utsatt med vilje.

- [ ] Stripe for kort.
- [ ] SMS-verifisering ved gratis-registrering, pluss enhets- og
      IP-sjekk. Betalende skal ikke ha det ekstra steget.
- [ ] Magic link, innlogging med Google, og innlogging med Vipps.

### Etter v1

- [ ] Institusjonsvisning for voksenopplæringssentre. v1 skal ikke
      vise enkeltelevers fremgang til en skole. Å høre ett muntlig
      opptak er ikke denne visningen. Det ligger i fase 8.
- [ ] Egen gjennomgang mot WCAG 2.1 AA før salg til slike sentre.
      Kravet underveis er tastatur, alt-tekst, transkripsjon og
      tekst på A2.
- [ ] Dele rettighetsmodulen med en annen app, hvis det faktisk
      trengs. Ingen delt pakke på forskudd.

### Små hull i det som allerede er bygd

- [ ] Innsynet på `/mine-data` viser antall og øktliste, ikke selve
      svarteksten eller vurderingsteksten.
- [ ] E-post kan ikke endres i appen.
- [ ] Feil fra innlogging vises fortsatt med teksten fra
      innloggingstjenesten. Den bør være kort og på A2.
