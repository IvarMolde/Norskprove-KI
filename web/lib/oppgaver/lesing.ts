import { z } from "zod";

export const pastandSvarSchema = z
  .object({
    valg: z.array(
      z.object({
        id: z.string().min(1),
        svar: z.boolean(),
      }),
    ),
  })
  .strict();

export const fyllInnSvarSchema = z
  .object({
    hull: z.array(
      z.object({
        id: z.string().min(1),
        svar: z.string(),
      }),
    ),
  })
  .strict();

export const ordvalgSvarSchema = z
  .object({
    valgId: z.string().min(1),
  })
  .strict();

export const rekkefolgeSvarSchema = z
  .object({
    rekkefolge: z.array(z.string().min(1)),
  })
  .strict();

export const lagreSvarSchema = z.union([
  pastandSvarSchema,
  fyllInnSvarSchema,
  ordvalgSvarSchema,
  rekkefolgeSvarSchema,
]);

const oppgaveFelles = {
  id: z.string().uuid(),
  rekkefolge: z.number().int(),
  tittel: z.string(),
  tekst: z.string(),
  besvart: z.boolean(),
};

export const pastandOppgaveSchema = z.object({
  ...oppgaveFelles,
  type: z.literal("pastand_korrekt"),
  pastander: z.array(
    z.object({
      id: z.string(),
      tekst: z.string(),
    }),
  ),
  svar: pastandSvarSchema.nullable(),
  fasit: z
    .array(
      z.object({
        id: z.string(),
        korrekt: z.boolean(),
      }),
    )
    .nullable(),
});

export const fyllInnOppgaveSchema = z.object({
  ...oppgaveFelles,
  type: z.literal("fyll_inn"),
  deler: z.array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("tekst"), tekst: z.string() }),
      z.object({ type: z.literal("hull"), id: z.string() }),
    ]),
  ),
  svar: fyllInnSvarSchema.nullable(),
  fasit: z
    .array(
      z.object({
        id: z.string(),
        ord: z.array(z.string()),
      }),
    )
    .nullable(),
});

export const synonymOppgaveSchema = z.object({
  ...oppgaveFelles,
  type: z.literal("synonym"),
  ord: z.string(),
  alternativer: z.array(
    z.object({
      id: z.string(),
      tekst: z.string(),
    }),
  ),
  svar: ordvalgSvarSchema.nullable(),
  fasit: z
    .object({
      korrekt: z.string(),
    })
    .nullable(),
});

export const antonymOppgaveSchema = synonymOppgaveSchema.extend({
  type: z.literal("antonym"),
});

export const rekkefolgeOppgaveSchema = z.object({
  ...oppgaveFelles,
  type: z.literal("rekkefolge"),
  ledd: z.array(
    z.object({
      id: z.string(),
      tekst: z.string(),
    }),
  ),
  svar: rekkefolgeSvarSchema.nullable(),
  fasit: z
    .object({
      riktig: z.array(z.string()),
    })
    .nullable(),
});

export const leseoppgaveSchema = z.discriminatedUnion("type", [
  pastandOppgaveSchema,
  fyllInnOppgaveSchema,
  synonymOppgaveSchema,
  antonymOppgaveSchema,
  rekkefolgeOppgaveSchema,
]);

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

export type Leseoppgave = z.infer<typeof leseoppgaveSchema>;
export type PastandOppgave = z.infer<typeof pastandOppgaveSchema>;
export type FyllInnOppgave = z.infer<typeof fyllInnOppgaveSchema>;
export type OrdvalgOppgave = z.infer<
  typeof synonymOppgaveSchema | typeof antonymOppgaveSchema
>;
export type RekkefolgeOppgave = z.infer<typeof rekkefolgeOppgaveSchema>;
export type Poengsum = z.infer<typeof poengsumSchema>;
