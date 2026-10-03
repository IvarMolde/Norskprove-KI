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

Fase 1 er ferdig 2026-10-03. Neste er **2. Lesing som kan øves på**.

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

Ferdig når en leseøkt kan inneholde flere oppgavetyper, fortsatt uten bilder
og lyd, og settet er i størrelsesorden 14–16 oppgaver.

- Legg til `fyll_inn`, `synonym`, `antonym` og `rekkefolge`, én type om
  gangen, med jsonb-kontrakt i denne filen før UI.
- Hold dra-og-slipp (`dra_til_forklaring`, `merk_ordet`) til de har et
  tastaturalternativ.
- Poengsum skal tåle flere typer i samme økt.

## Fase 3. Redigere innhold uten SQL

Ferdig når en innlogget redaktør kan opprette, publisere og arkivere en
leseoppgave i appen, og en elev bare ser `status = publisert`.

- Én oppgaveeditor for typene fra fase 1 og 2.
- Rolle skilles fra elev. Redaktør kan skrive oppgaver. Eleven ser
  publiserte oppgaver gjennom øktfunksjonene, uten fasit før svar.
- Bildebank og opptaksstudio venter til lyd og bilder trengs.

## Fase 4. Lytting

Ferdig når en lytteøkt på 18–20 oppgaver kan spilles av med synlig
`transkripsjon`.

- Lyd kommer fra opplastede filer. Generering med Google TTS og
  Whisper-sjekk kommer etter at avspilling og svar fungerer.
- `diktat` får egen kontrakt før den bygges.

## Fase 5. Skriftlig øving og KI-vurdering

Ferdig når en bruker med rettigheten `skriftlig_ki_vurdering` kan levere en
fritekst og få vurdering tilbake ett nivå enklere enn vurdert nivå, lagret i
`skriftlig_vurdering`.

- Prompten i `prompts/skriveprove-vurdering-prompt.md` brukes som den er.
- `usikker_vurdering` lagres. Et stikkprøve-dashbord kan vente til det finnes
  flere vurderinger.
- Bank sjekkes før eventuell KI-generering av nye oppgaver. Generering er
  ikke en del av ferdigkriteriet for denne fasen.

## Fase 6. Betaling

Ferdig når en bruker kan gå fra gratis til Basis, Pluss eller Komplett, og
rettighetene følger `plan_rettigheter` uten kodeendring per plan.

- Vipps først, Stripe etterpå.
- Betalende får `pause_gjenoppta`: økten kan settes til `avbrutt_lagret` og
  tas opp igjen med samme rader i `okt_oppgaver`.
- SMS-verifisering gjelder bare gratis-registrering.

## Fase 7. Ut til brukere

Ferdig når en ny bruker kan lese personvernerklæringen, opprette konto og
ta en leseøkt på det offentlige domenet.

- Personvernerklæring og databehandleravtaler (Supabase, og senere Google,
  Vercel, Stripe, Vipps) skrives før åpen lansering. Utkast kan starte
  parallelt med fase 1.
- «Info om prøvene»-side.
- Vercel-prosjekt og domene. Supabase forblir i EU West (Irland).

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

## Logg

Nyeste øverst.

### 2026-10-03

- Fase 1 verifisert mot lokal Supabase og i nettleseren. Gratisbruker fikk
  poengsum, møtte ikke besvarte oppgaver igjen, og ble stoppet på tredje
  økt. Skjemaet nullstilles mellom oppgavene.
- Beslutning: fasit og øktgrense ligger i databasefunksjoner. Eleven leser
  ikke `oppgaver` direkte.
- Fase 1 er kodet: seed, rettigheter, øktfunksjoner og siden `/ov/lesing`.
- Veikart opprettet. Aktiv fase satt til 1, første leseøkt.
- Første oppgavetype valgt: `pastand_korrekt`, A2, lesing, håndskrevet seed.
- Personvernutkast kan starte parallelt, uten å flytte den aktive fasen.
