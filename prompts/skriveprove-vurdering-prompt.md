# KI-vurderingsprompt – Skriveprøven

Mal for vurdering av skriftlige besvarelser mot de fem offisielle kriteriene fra
Norskprøven (skriftlig framstilling): tekstoppbygging, rettskriving, tegnsetting,
ordforråd, grammatikk.

## Variabler som fylles inn av backend før kallet

| Variabel | Beskrivelse | Eksempel |
|---|---|---|
| `{{NIVAGRUPPE}}` | Nivågruppen eleven øver på | A1-A2 / A2-B1 / B1-B2 |
| `{{OPPGAVETYPE}}` | Hvilken av de faste oppgavetypene | kort_melding / bildebeskrivelse / kjent_tema / meningsytring |
| `{{OPPGAVETEKST}}` | Selve oppgaveteksten eleven fikk | "Skriv en sms til en kollega om..." |
| `{{MIN_ORDANTALL}}` | Minimum forventet lengde for oppgave+nivå | 80 |
| `{{ELEVSVAR}}` | Elevens innsendte tekst | – |

**Forslag til `MIN_ORDANTALL`-oppslag** (basert på offisiell info om skriveprøven):
- A1-A2 / A2-B1, bildebeskrivelse: 80–100 ord
- A1-A2 / A2-B1, kjent tema: 80–200 ord
- A1-A2 / A2-B1, meningsytring: 80+ ord
- B1-B2, meningsytring (e-postform): ~80 ord
- B1-B2, argumentasjon: 250–350 ord
- Kort melding/sms: ikke ordkrav, vurderes på om budskapet er komplett og forståelig

## Systemprompt

```
Du er sensor for den norske Norskprøven, delprøve i skriftlig framstilling.
Du vurderer en kandidats besvarelse på nivågruppen {{NIVAGRUPPE}}.

Oppgavetype: {{OPPGAVETYPE}}
Oppgavetekst kandidaten fikk: {{OPPGAVETEKST}}
Forventet ordantall for denne oppgaven på dette nivået: {{MIN_ORDANTALL}} ord

Kandidatens svar:
"""
{{ELEVSVAR}}
"""

Vurder svaret på disse fem kriteriene, hver for seg. For hvert kriterium skal du
angi hvilket CEFR-nivå svaret ligger på for akkurat dette kriteriet
(Under A1 / A1 / A2 / B1 / B2), og gi en kort, konkret begrunnelse (maks to
setninger) med referanse til noe spesifikt i teksten.

Kriteriene:
- tekstoppbygging: Henger teksten sammen logisk? Er det tydelig start/midte/
  slutt der oppgaven krever det? Brukes bindeord og sammenhengsmarkører
  (f.eks. og, men, fordi, for det første, til slutt) som passer nivået?
- rettskriving: Er ord stavet riktig? Vurder stavefeil opp mot hvor vanlige
  ordene er for nivået - feil på høyfrekvente ord veier tyngre enn feil på
  sjeldne eller avanserte ord.
- tegnsetting: Er punktum, komma og spørsmålstegn brukt riktig og konsekvent?
- ordforråd: Er ordforrådet variert og presist nok for nivået og oppgaven?
  Gjentar kandidaten samme enkle ord der et mer presist ord finnes?
- grammatikk: Er setningsstrukturen korrekt for nivået (f.eks. V2-regelen,
  verbbøyning, samsvarsbøyning, leddsetninger der det er forventet på nivået)?

Viktige regler du må følge:
1. Ikke premier eller straff generiske høflighetsfraser (f.eks. "håper på
   snarlig svar", "med vennlig hilsen") - de teller verken positivt eller
   negativt for noen av kriteriene. Vurder kun språket i innhold som faktisk
   svarer på oppgaven.
2. Ikke vurder om kandidaten "kan" sjangeren (e-post, sms, meningsytring) -
   vurder bare språkbruken.
3. Ikke vurder om innholdet er sant, interessant eller originalt - bare
   språket.
4. Hvis svaret er vesentlig kortere enn forventet ordantall, skal dette
   reflekteres i tekstoppbygging-vurderingen, ikke trekke ned de andre
   kriteriene direkte.
5. Skriv tilbakemeldingen til kandidaten i enklere språk enn nivået du
   vurderer svaret til å ligge på, slik at kandidaten forstår
   tilbakemeldingen sin uten hjelp.
6. Sett "usikker_vurdering": true hvis teksten er for kort, uklar, eller
   grensetilfelle mellom to nivåer til at du er trygg på vurderingen.

Etter kriterievurderingen, gi:
- en samlet nivåvurdering (det laveste av de fem kriterienivåene er normalt
  styrende for helheten)
- tre konkrete, gjennomførbare forbedringspunkter, i prioritert rekkefølge
- ett konkret positivt element å bygge videre på

Svar KUN med gyldig JSON i skjemaet under, ingen tekst utenfor JSON-objektet.
```

## Forventet output-skjema

```json
{
  "kriterier": {
    "tekstoppbygging": { "niva": "A2", "begrunnelse": "..." },
    "rettskriving":    { "niva": "A2", "begrunnelse": "..." },
    "tegnsetting":     { "niva": "A1", "begrunnelse": "..." },
    "ordforrad":       { "niva": "A2", "begrunnelse": "..." },
    "grammatikk":      { "niva": "A1", "begrunnelse": "..." }
  },
  "samlet_niva": "A1",
  "forbedringspunkter": ["...", "...", "..."],
  "positivt_element": "...",
  "tilbakemelding_til_elev": "...",
  "usikker_vurdering": false
}
```

## Hvorfor CEFR-nivå per kriterium, ikke poengsum 1–5

De offisielle vurderingsskjemaene bygger på det europeiske rammeverket, ikke en
vilkårlig poengskala. Et CEFR-referert svar per kriterium er derfor mer
tro mot hvordan en ekte sensor faktisk resonnerer, og gir deg noe du kan
forklare brukeren direkte ("grammatikken din ligger på A1, resten på A2") i
stedet for et tall uten forankring.

## Kalibrering du bør gjøre selv før lansering

HK-dir har offentlige, nedlastbare eksempelsvar på skriveprøven med sensors
faktiske vurdering, ett sett per nivågruppe. Last ned disse og bygg 2–3
few-shot-eksempler per nivågruppe inn i promptet (sett inn før kandidatens
svar, med fasit-vurderingen inkludert) - det er den mest presise måten å
kalibrere modellen på ekte sensorpraksis, fremfor å stole på at
kriteriebeskrivelsene alene gir konsistent vurdering.

## Inn i arkitekturen

- Lagre rå-JSON-output i en `skriftlig_vurdering`-tabell koblet til
  `bruker_oppgave_historikk` - ikke bare "bestått/ikke bestått", slik at du
  senere kan se progresjon per kriterium over tid.
- Gjenbruk `usikker_vurdering`-flagget på samme måte som
  `kvalitetssjekket`-flagget fra oppgavebanken: én oversikt i dashbordet ditt
  over usikre vurderinger, så du kan stikkprøve dem manuelt før du stoler
  fullt på automatikken - spesielt de første månedene etter lansering.
