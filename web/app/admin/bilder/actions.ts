"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdmin } from "@/lib/admin/auth";

const endreStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["godkjent", "avvist"]),
});

export async function endreBildestatus(id: string, status: string) {
  try {
    const resultat = endreStatusSchema.safeParse({ id, status });
    if (!resultat.success) {
      return;
    }

    const admin = await getAdmin();
    if (!admin) {
      return;
    }
    const { user, supabase } = admin;
    const { error } = await supabase
      .from("bilder")
      .update({
        status: resultat.data.status,
        godkjent_av: resultat.data.status === "godkjent" ? user.id : null,
        godkjent_dato:
          resultat.data.status === "godkjent" ? new Date().toISOString() : null,
      })
      .eq("id", resultat.data.id);

    if (error) {
      console.error("Kunne ikke endre bildestatus", { code: error.code });
      return;
    }
    revalidatePath("/admin");
    revalidatePath("/admin/bilder");
  } catch (error) {
    console.error("Uventet feil ved endring av bildestatus", error);
  }
}
