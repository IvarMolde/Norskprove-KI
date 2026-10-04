export const nivaer = ["A1", "A2", "B1", "B2"] as const;

export type Niva = (typeof nivaer)[number];

export function erNiva(verdi: string): verdi is Niva {
  return nivaer.some((niva) => niva === verdi);
}

export function alderTekst(metode: string | null): string {
  if (metode === "egenerklaert") {
    return "Du har sagt at du er 18 år.";
  }
  if (metode === "vipps") {
    return "Alder er bekreftet med Vipps.";
  }
  return "Alder er ikke bekreftet.";
}

export function ferdighetTekst(ferdighet: string): string {
  if (ferdighet === "lesing") return "Lesing";
  if (ferdighet === "lytting") return "Lytting";
  if (ferdighet === "skriving") return "Skriving";
  if (ferdighet === "muntlig") return "Muntlig";
  return "Økt";
}

export function oktStatusTekst(status: string): string {
  if (status === "pagaende") return "Pågår";
  if (status === "fullfort") return "Ferdig";
  if (status === "avbrutt_lagret") return "Pauset";
  return "Ukjent";
}
