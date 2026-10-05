const TEKSTER: Record<string, string> = {
  okt_grense: "Du har brukt alle øktene dine. Du kan ikke starte en ny økt.",
  ingen_oppgaver: "Det finnes ingen nye oppgaver nå.",
  ikke_innlogget: "Du må logge inn først.",
  okt_ikke_funnet: "Vi fant ikke økten.",
  okt_ikke_aktiv: "Denne økten er ferdig.",
  oppgave_ikke_i_okt: "Oppgaven er ikke i denne økten.",
  ikke_ferdig: "Svar på alle oppgavene før du avslutter.",
  mangler_profil: "Noe gikk galt. Prøv igjen.",
  ugyldig_svar: "Svaret er ikke gyldig. Prøv igjen.",
  allerede_besvart: "Du har allerede svart på denne oppgaven.",
  ikke_redaktor: "Du kan ikke redigere oppgaver.",
  ugyldig_innhold: "Oppgaven er ikke ferdig utfylt.",
  oppgave_ikke_funnet: "Vi fant ikke oppgaven.",
  mangler_rettighet: "Du kan ikke få vurdering av teksten.",
  vurdering_utilgjengelig: "Vurdering er ikke klar nå. Prøv igjen senere.",
  vurdering_feilet: "Vi fikk ikke vurdert teksten. Prøv igjen.",
  betaling_utilgjengelig: "Betaling er ikke klar nå. Prøv igjen senere.",
  betaling_ikke_funnet: "Vi fant ikke betalingen.",
  ugyldig_plan: "Velg en plan.",
  ingen_pause: "Du kan ikke pause økten.",
  okt_pauset: "Økten er pauset.",
  konto_ikke_slettet: "Vi fikk ikke slettet kontoen. Prøv igjen.",
  ugyldig_niva: "Velg A1, A2, B1 eller B2.",
  mangler_muntlig: "Du kan ikke øve på muntlig.",
  bilde_mangler: "Vi fant ikke bildet.",
  mangler_lyd: "Ta opp svaret ditt først.",
  transkripsjon_mangler: "Skriv teksten du sa.",
  ikke_larer: "Du kan ikke høre elevsvar.",
  kan_ikke_lage_oppgave: "Du kan ikke lage oppgaver.",
  bilde_pakrevd: "Legg inn et bilde og skriv hva som er på det.",
  ugyldig_bilde: "Bildet må være png, pdf, svg eller webp.",
  bilde_utilgjengelig: "Bildet kunne ikke lagres nå. Prøv igjen.",
  innlevering_mangler: "Vi fant ikke innleveringen.",
  ugyldig_larerniva: "Velg et nivå.",
  kommentar_mangler: "Skriv en kommentar til eleven.",
  mangler_adaptiv: "Du kan ikke ta den adaptive prøven.",
  terskel_mangler: "Vi fant ikke neste del av prøven.",
  adaptiv_pagaar: "Denne økten er en adaptiv prøve.",
  ugyldig_ferdighet: "Velg lesing eller lytting.",
};

const GENERELL = "Noe gikk galt. Prøv igjen.";

export function oktFeilTekst(message: string | undefined): string {
  if (!message) {
    return GENERELL;
  }

  if (/jwt|permission denied|not authorized/i.test(message)) {
    return TEKSTER.ikke_innlogget;
  }

  const kode = Object.keys(TEKSTER).find(
    (kandidat) =>
      message === kandidat ||
      message.endsWith(` ${kandidat}`) ||
      message.includes(kandidat),
  );

  return kode ? TEKSTER[kode] : GENERELL;
}
