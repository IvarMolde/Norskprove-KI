import { createAdminClient } from "@/lib/supabase/admin";

const BOETTE = "muntlig-opptak";

async function fjernOpptak(
  navn: string[],
): Promise<void> {
  if (navn.length === 0) {
    return;
  }

  const admin = createAdminClient();
  if (!admin) {
    return;
  }

  const fjernet = await admin.storage.from(BOETTE).remove(navn);
  if (fjernet.error) {
    console.error("fjernOpptak", fjernet.error.message);
  }
}

/** Sletter alle opptak som hører til kontoen, før kontoen selv slettes. */
export async function slettOpptakForBruker(brukerId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    return;
  }

  for (let side = 0; side < 10; side += 1) {
    const liste = await admin.storage.from(BOETTE).list(brukerId, {
      limit: 100,
    });
    if (liste.error) {
      console.error("slettOpptakForBruker", liste.error.message);
      throw new Error("konto_ikke_slettet");
    }

    const navn = (liste.data ?? [])
      .map((fil) => fil.name)
      .filter((navn) => navn.length > 0)
      .map((navn) => `${brukerId}/${navn}`);

    if (navn.length === 0) {
      return;
    }

    const fjernet = await admin.storage.from(BOETTE).remove(navn);
    if (fjernet.error) {
      console.error("slettOpptakForBruker", fjernet.error.message);
      throw new Error("konto_ikke_slettet");
    }

    if ((liste.data ?? []).length < 100) {
      return;
    }
  }
}

/** Fjerner lydadresser eldre enn 30 dager, og opptaksfilen hvis den finnes. */
export async function slettGammelLyd(): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return;
    }

    const { data, error } = await admin.rpc("slett_gammel_lyd");
    if (error) {
      console.error("slettGammelLyd", error.code);
      return;
    }

    if (!Array.isArray(data)) {
      return;
    }

    const navn = data
      .filter(
        (adresse): adresse is string =>
          typeof adresse === "string" && adresse.startsWith(`${BOETTE}/`),
      )
      .map((adresse) => adresse.slice(BOETTE.length + 1))
      .filter((adresse) => adresse.length > 0);

    await fjernOpptak(navn);
  } catch (error) {
    console.error("slettGammelLyd", error);
  }
}
