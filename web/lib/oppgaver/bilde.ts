import { z } from "zod";

export const bildeAdresseSchema = z
  .string()
  .regex(
    /^(?:\/bilder\/[a-z0-9-]+\.(?:svg|png|webp)|\/bilde\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
  );

export const oppgaveBildeSchema = z
  .object({
    url: bildeAdresseSchema,
    beskrivelse: z.string().min(1),
  })
  .nullable();

export type OppgaveBilde = z.infer<typeof oppgaveBildeSchema>;
