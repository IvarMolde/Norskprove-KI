import { z } from "zod";

const nivaSchema = z.enum(["Under A1", "A1", "A2", "B1", "B2"]);

const kriteriumSchema = z.object({
  niva: nivaSchema,
  begrunnelse: z.string().trim().min(1),
});

export const skriveVurderingSchema = z.object({
  kriterier: z.object({
    tekstoppbygging: kriteriumSchema,
    rettskriving: kriteriumSchema,
    tegnsetting: kriteriumSchema,
    ordforrad: kriteriumSchema,
    grammatikk: kriteriumSchema,
  }),
  samlet_niva: nivaSchema,
  forbedringspunkter: z.array(z.string().trim().min(1)).length(3),
  positivt_element: z.string().trim().min(1),
  tilbakemelding_til_elev: z.string().trim().min(1),
  usikker_vurdering: z.boolean(),
});

export type SkriveVurdering = z.infer<typeof skriveVurderingSchema>;

const elevVurderingSchema = z.object({
  samlet_niva: nivaSchema,
  forbedringspunkter: z.array(z.string().min(1)).length(3),
  positivt_element: z.string().min(1),
  tilbakemelding_til_elev: z.string().min(1),
  usikker_vurdering: z.boolean(),
});

export const skriveoktSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pagaende", "fullfort", "avbrutt_lagret"]),
  oppgave: z.object({
    id: z.string().uuid(),
    tittel: z.string().min(1),
    tekst: z.string().min(1),
    oppgavetype: z.enum([
      "kort_melding",
      "bildebeskrivelse",
      "kjent_tema",
      "meningsytring",
    ]),
    nivagruppe: z.enum(["A1-A2", "A2-B1", "B1-B2"]),
    min_ord: z.number().int().nonnegative(),
    svar: z.string().nullable(),
    kladd: z.string().nullable(),
    vurdering: elevVurderingSchema.nullable(),
  }),
});

export type Skriveokt = z.infer<typeof skriveoktSchema>;
export type ElevVurdering = z.infer<typeof elevVurderingSchema>;
