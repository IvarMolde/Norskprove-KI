import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: brukerfeil,
  } = await supabase.auth.getUser();

  if (brukerfeil || !user) {
    return null;
  }

  const { data: erAdmin, error: rollefeil } = await supabase.rpc("er_admin");
  if (rollefeil || erAdmin !== true) {
    return null;
  }

  return { user, supabase };
});

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) {
    redirect("/logg-inn?retur=/admin");
  }
  return admin;
}
