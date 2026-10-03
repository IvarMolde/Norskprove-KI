import { z } from "zod";

export const pastandInnholdSchema = z.object({
  tittel: z.string().min(1),
  tekst: z.string().min(1),
  pastander: z
    .array(
      z.object({
        id: z.string().min(1),
        tekst: z.string().min(1),
        korrekt: z.boolean(),
      }),
    )
    .min(1),
});

export const svarSchema = z.object({
  valg: z.array(
    z.object({
      id: z.string().min(1),
      svar: z.boolean(),
    }),
  ),
});

export const leseoppgaveSchema = z.object({
  id: z.string().uuid(),
  rekkefolge: z.number().int(),
  tittel: z.string(),
  tekst: z.string(),
  pastander: z.array(
    z.object({
      id: z.string(),
      tekst: z.string(),
    }),
  ),
  svar: svarSchema.nullable(),
  besvart: z.boolean(),
  fasit: z
    .array(
      z.object({
        id: z.string(),
        korrekt: z.boolean(),
      }),
    )
    .nullable(),
});

export const leseoktSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pagaende", "fullfort", "avbrutt_lagret"]),
  siste_posisjon: z.number().int(),
  oppgaver: z.array(leseoppgaveSchema),
});

export const poengsumSchema = z.object({
  riktige: z.number().int(),
  mulige: z.number().int(),
});

export type PastandInnhold = z.infer<typeof pastandInnholdSchema>;
export type SvarValg = z.infer<typeof svarSchema>;
export type Leseoppgave = z.infer<typeof leseoppgaveSchema>;
export type Leseokt = z.infer<typeof leseoktSchema>;
export type Poengsum = z.infer<typeof poengsumSchema>;
