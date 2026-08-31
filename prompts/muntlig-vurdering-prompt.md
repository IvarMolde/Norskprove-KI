# KI-vurderingsprompt – Muntlig prøve

Mal for vurdering av muntlige besvarelser, basert på den offisielle strukturen
for Norskprøven, delprøve i muntlig kommunikasjon.

## Viktig strukturell forskjell fra skriftlig

Skriftlig vurderes på fem like kriterier samlet. Muntlig er bygget annerledes,
og promptet under følger den ekte strukturen:

- **Formidling** vurderes PER OPPGAVE (løste kandidaten akkurat denne
  oppgaven - fortelle, beskrive bilde, samtale - på en forståelig måte?)
- **Språklige kriterier** (flyt, uttale, ordforråd, grammatikk) vurderes
  HOLISTISK over hele økten, ikke oppgave for oppgave

Dette er direkte fra HK-dir sin egen forklaring av hvordan sensor vurderer,
og det er også slik kandidaten selv får resultatet presentert til seg
etterpå - så samme struktur i appen gir gjenkjennelig, forklarbar
tilbakemelding.

## Teknisk flyt - annerledes enn skriftlig

1. Eleven spiller inn svaret i nettleseren (samme opptaksteknologi som
   admin-studioet, bare andre veien)
2. Lydfilen lastes opp til Supabase Storage
3. NB Whisper transkriberer lydfilen
4. KI-vurdering kjøres med BÅDE transkripsjon og lydfil tilgjengelig

**Én ærlig usikkerhet å være klar over:** uttale og flyt kan ikke vurderes
pålitelig fra transkripsjon alene - de krever at modellen faktisk lytter til
lydfilen. Tekstbasert vurdering av ordforråd og grammatikk er en godt utprøvd
kapabilitet. Lydbasert vurdering av uttale/flyt mot CEFR-nivå er en yngre,
mindre bevist kapabilitet. Anbefaler å sette `usikker_vurdering` med lavere
terskel spesifikt på disse to kriteriene i starten, og stikkprøve dem oftere
enn resten inntil dere har egen erfaring med hvor pålitelig det faktisk er.

## Oppgavetyper - bygg i to faser

**Fase 1 (individuelle oppgaver, rett frem å bygge solo):**
- `individuell_fortelle` - fortell/presenter om et kjent tema, 2-3 min
- `individuell_beskrive_bilde` - beskriv et bilde fra bildebanken (gjenbruker
  bildebanken igjen, som skriftlig sin bildebeskrivelse-oppgave)

**Fase 2 (samtale-format, krever et designvalg):**
- `samtale_utveksle` - i ekte eksamen er dette et par-format (to kandidater
  snakker sammen). En solo-app kan ikke gjenskape dette direkte - KI må spille
  motpart og stille oppfølgingsspørsmål i sanntid. Vesentlig mer komplekst å
  bygge robust (krever lav latency, naturlig samtaleflyt), så vurder å utsette
  denne til fase 1 er testet og fungerer.

## Variabler

| Variabel | Beskrivelse |
|---|---|
| `{{NIVAGRUPPE}}` | A1-A2 / A2-B1 / B1-B2 |
| `{{OPPGAVETYPE}}` | individuell_fortelle / individuell_beskrive_bilde |
| `{{OPPGAVETEKST}}` | Oppgaveteksten eleven fikk |
| `{{TRANSKRIPSJON}}` | NB Whisper-transkripsjon av elevens svar |
| `{{LYDFIL}}` | Selve lydopptaket - sendes som multimodal input, ikke tekst |

## Systemprompt

```
Du er sensor for den norske Norskprøven, delprøve i muntlig kommunikasjon.
Du vurderer en kandidats muntlige svar på nivågruppen {{NIVAGRUPPE}}.

Oppgavetype: {{OPPGAVETYPE}}
Oppgavetekst kandidaten fikk: {{OPPGAVETEKST}}

Transkripsjon av kandidatens svar:
"""
{{TRANSKRIPSJON}}
"""

Du har også tilgang til selve lydopptaket - bruk det til å vurdere flyt og
uttale, siden dette ikke kan vurderes pålitelig fra tekst alene.

Vurder svaret i to lag, akkurat slik en ekte sensor gjør:

DEL 1 - FORMIDLING (vurderes for denne spesifikke oppgaven):
Løste kandidaten oppgaven på en forståelig måte? For individuell_fortelle:
presenterte kandidaten seg/temaet forståelig? For individuell_beskrive_bilde:
formidlet kandidaten hva som skjer på bildet forståelig? Angi CEFR-nivå
(Under A1 / A1 / A2 / B1 / B2) og en kort begrunnelse.

DEL 2 - SPRÅKLIGE KRITERIER (vurderes holistisk, ikke bare for denne
oppgaven isolert):
- flyt: Snakker kandidaten sammenhengende, eller er det mange pauser for å
  lete etter ord? På A1 stilles ikke krav til flyt i det hele tatt.
- uttale: Er uttalen forståelig for en samtalepartner som er villig til å
  anstrenge seg? Vurder ikke aksent i seg selv, bare forståelighet.
- ordforråd: Er ordforrådet tilstrekkelig og presist nok for nivå og tema?
- grammatikk: Vises riktig bruk av grammatiske strukturer som forventes på
  nivået (enkle strukturer på lave nivåer, komplekse setninger på høyere)?

Angi CEFR-nivå og kort begrunnelse for hvert av de fire.

Viktige regler du må følge:
1. Ikke vurder sjangerkunnskap eller kunnskap om temaet i oppgaven - bare
   språkbruken og evnen til å kommunisere.
2. Ikke vurder aksent eller "norsklyd" - bare om uttalen er forståelig.
3. Skriv tilbakemeldingen til kandidaten i enklere språk enn nivået du
   vurderer svaret til å ligge på.
4. Sett "usikker_vurdering": true med lavere terskel for flyt og uttale enn
   for ordforråd og grammatikk, siden lydbasert vurdering av disse to er en
   mindre moden kapabilitet.

Etter vurderingen, gi:
- en samlet nivåvurdering
- to konkrete forbedringspunkter
- ett konkret positivt element

Svar KUN med gyldig JSON i skjemaet under, ingen tekst utenfor JSON-objektet.
```

## Forventet output-skjema

```json
{
  "formidling": { "niva": "A2", "begrunnelse": "..." },
  "sprakligekriterier": {
    "flyt":       { "niva": "A1", "begrunnelse": "..." },
    "uttale":     { "niva": "A2", "begrunnelse": "..." },
    "ordforrad":  { "niva": "A2", "begrunnelse": "..." },
    "grammatikk": { "niva": "A1", "begrunnelse": "..." }
  },
  "samlet_niva": "A1",
  "forbedringspunkter": ["...", "..."],
  "positivt_element": "...",
  "tilbakemelding_til_elev": "...",
  "usikker_vurdering": false,
  "usikker_pga_lyd": false
}
```

`usikker_pga_lyd` er et eget flagg utover det generelle `usikker_vurdering` -
skiller mellom "denne vurderingen er generelt usikker" og "denne vurderingen
er spesifikt usikker fordi flyt/uttale-scoring fra lyd er ny teknologi", slik
at dere kan spore om lydvurderingen faktisk blir mer pålitelig over tid.

## Én ting fra ekte eksamen verdt å vite om, men ikke bygge ennå

På ekte muntlig prøve kan kandidaten få et ekstraspørsmål fra nivået over
hvis sensor tror kandidaten presterer bedre enn det registrerte nivået - i
motsetning til skriftlig, som har et hardt tak. Dette er en fin idé for en
senere, mer avansert versjon (en slags mini-adaptiv mekanikk inne i selve
muntlig-økten), men bygg fase 1 og 2 over ferdig og testet først.

## Inn i arkitekturen

- Lagre i en `muntlig_vurdering`-tabell, samme mønster som
  `skriftlig_vurdering` - koblet til `bruker_oppgave_historikk`.
- Samme spot-sjekk-dashbord som skriftlig, men filtrer/sorter på
  `usikker_pga_lyd` som egen kolonne, siden dette er der dere trenger tettest
  oppfølging den første tiden.
