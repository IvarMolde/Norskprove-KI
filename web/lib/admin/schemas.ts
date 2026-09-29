import { z } from "zod";

export const OPPGAVETYPER = [
  "fyll_inn",
  "synonym",
  "antonym",
  "dra_til_forklaring",
  "setningsstruktur",
  "merk_ordet",
  "pastand_korrekt",
  "rekkefolge",
  "fritekst",
  "diktat",
  "hotspot_bilde",
  "velg_bilde",
  "muntlig_opptak",
] as const;

export const FERDIGHETER = [
  "lesing",
  "lytting",
  "skriving",
  "muntlig",
] as const;
export const NIVAER = ["A1", "A2", "B1", "B2"] as const;
export const OPPGAVESTATUSER = ["kladd", "publisert", "arkivert"] as const;

const tomTekstTilNull = z
  .string()
  .trim()
  .max(500)
  .transform((verdi) => verdi || null);

export const oppgaveSchema = z.object({
  type: z.enum(OPPGAVETYPER),
  ferdighet: z.enum(FERDIGHETER),
  nivå: z.enum(NIVAER),
  tema: tomTekstTilNull,
  kilde: z.enum(["autentisk", "ki_generert"]),
  status: z.enum(OPPGAVESTATUSER),
  kvalitetssjekket: z.boolean(),
  innhold: z.record(z.string(), z.unknown()),
  bilde_id: z.uuid().nullable(),
  lydfil_id: z.uuid().nullable(),
});

export const bildeMetadataSchema = z.object({
  beskrivelse: z.string().trim().min(3).max(500),
  tema: tomTekstTilNull,
  fotograf_navn: tomTekstTilNull,
  kilde_plattform: tomTekstTilNull,
  kilde_url: z
    .union([z.url().max(2000), z.literal("")])
    .transform((verdi) => verdi || null),
  lisens: tomTekstTilNull,
  kreditering_pakrevd: z.boolean(),
});

export const lydMetadataSchema = z.object({
  navn: z.string().trim().min(2).max(150),
  transkripsjon: z
    .string()
    .trim()
    .max(10000)
    .transform((verdi) => verdi || null),
  kilde: z.enum(["opptak", "opplastet"]),
});

export const bildeRadSchema = z.object({
  id: z.uuid(),
  url: z.string().min(1),
  beskrivelse: z.string(),
  tema: z.string().nullable(),
  status: z.enum(["venter_godkjenning", "godkjent", "avvist"]),
  opprettet_dato: z.string(),
});

export const lydRadSchema = z.object({
  id: z.uuid(),
  storage_path: z.string().min(1),
  navn: z.string(),
  transkripsjon: z.string().nullable(),
  kilde: z.enum(["opptak", "opplastet", "tts"]),
  mime_type: z.string(),
  opprettet_dato: z.string(),
});

export const oppgaveRadSchema = oppgaveSchema.extend({
  id: z.uuid(),
  opprettet_dato: z.string(),
});

export type OppgaveRad = z.infer<typeof oppgaveRadSchema>;
export type BildeRad = z.infer<typeof bildeRadSchema> & { signertUrl: string };
export type LydRad = z.infer<typeof lydRadSchema> & { signertUrl: string };
