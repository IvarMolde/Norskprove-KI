import { z } from "zod";

const nivaSchema = z.enum(["Under A1", "A1", "A2", "B1", "B2"]);

const kriteriumSchema = z.object({
  niva: nivaSchema,
  begrunnelse: z.string().trim().min(1),
});

export const muntligVurderingSchema = z.object({
  formidling: kriteriumSchema,
  sprakligekriterier: z.object({
    flyt: kriteriumSchema,
    uttale: kriteriumSchema,
    ordforrad: kriteriumSchema,
    grammatikk: kriteriumSchema,
  }),
  samlet_niva: nivaSchema,
  forbedringspunkter: z.array(z.string().trim().min(1)).length(2),
  positivt_element: z.string().trim().min(1),
  tilbakemelding_til_elev: z.string().trim().min(1),
  usikker_vurdering: z.boolean(),
  usikker_pga_lyd: z.boolean(),
});

export type MuntligVurdering = z.infer<typeof muntligVurderingSchema>;

const elevVurderingSchema = z.object({
  samlet_niva: nivaSchema,
  forbedringspunkter: z.array(z.string().min(1)).length(2),
  positivt_element: z.string().min(1),
  tilbakemelding_til_elev: z.string().min(1),
  usikker_vurdering: z.boolean(),
  usikker_pga_lyd: z.boolean(),
});

export const muntligOktSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pagaende", "fullfort", "avbrutt_lagret"]),
  oppgave: z.object({
    id: z.string().uuid(),
    tittel: z.string().min(1),
    tekst: z.string().min(1),
    oppgavetype: z.enum([
      "individuell_fortelle",
      "individuell_beskrive_bilde",
    ]),
    nivagruppe: z.enum(["A1-A2", "A2-B1", "B1-B2"]),
    svar: z.string().nullable(),
    har_lyd: z.boolean(),
    vurdering: elevVurderingSchema.nullable(),
  }),
});

export type MuntligOkt = z.infer<typeof muntligOktSchema>;
