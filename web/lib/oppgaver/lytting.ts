import { z } from "zod";
import { pastandOppgaveSchema } from "@/lib/oppgaver/lesing";

export const lyttePastandSchema = pastandOppgaveSchema.extend({
  lyd_url: z.string().regex(/^\/lyd\/[a-z0-9-]+\.mp3$/),
  transkripsjon: z.string().trim().min(1),
});

export const lytteoktSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pagaende", "fullfort", "avbrutt_lagret"]),
  siste_posisjon: z.number().int(),
  oppgaver: z.array(lyttePastandSchema),
});

export type LyttePastand = z.infer<typeof lyttePastandSchema>;
export type Lytteokt = z.infer<typeof lytteoktSchema>;
