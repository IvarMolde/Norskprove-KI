import { z } from "zod";

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

const mineSvarRadSchema = z.object({
  id: z.string().uuid(),
  ferdighet: z.string(),
  tittel: z.string(),
  er_kladd: z.boolean(),
  svar: z.array(z.string()),
  niva: z.string().nullable(),
  tilbakemelding: z.string().nullable(),
  positivt: z.string().nullable(),
  forbedring: z.array(z.string()).nullable(),
  usikker: z.boolean(),
  usikker_lyd: z.boolean(),
  formidling_niva: z.string().nullable(),
  formidling_tekst: z.string().nullable(),
  flyt_niva: z.string().nullable(),
  flyt_tekst: z.string().nullable(),
  uttale_niva: z.string().nullable(),
  uttale_tekst: z.string().nullable(),
  ord_niva: z.string().nullable(),
  ord_tekst: z.string().nullable(),
  grammatikk_niva: z.string().nullable(),
  grammatikk_tekst: z.string().nullable(),
  larer_niva: z.string().nullable(),
  larer_tekst: z.string().nullable(),
});

export type MineSvarRad = z.infer<typeof mineSvarRadSchema>;

export function lesMineSvar(data: unknown): MineSvarRad[] | null {
  const lest = z.array(mineSvarRadSchema).safeParse(data);
  return lest.success ? lest.data : null;
}
