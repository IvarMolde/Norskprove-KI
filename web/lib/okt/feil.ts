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
