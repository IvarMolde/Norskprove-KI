export function normaliserOrd(tekst: string): string {
  return tekst.trim().replace(/\s+/g, " ").toLocaleLowerCase("nb");
}

export function ordErGodkjent(svar: string, godkjente: string[]): boolean {
  const normalisert = normaliserOrd(svar);
  return godkjente.some((ord) => normaliserOrd(ord) === normalisert);
}
