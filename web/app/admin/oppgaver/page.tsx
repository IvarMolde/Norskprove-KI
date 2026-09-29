import { z } from "zod";
import { OppgaveEditor } from "@/components/admin/oppgave-editor";
import { requireAdmin } from "@/lib/admin/auth";
import {
  bildeRadSchema,
  lydRadSchema,
  oppgaveRadSchema,
} from "@/lib/admin/schemas";

export default async function Oppgaveside() {
  const { supabase } = await requireAdmin();
  const [oppgaverSvar, bilderSvar, lydSvar] = await Promise.all([
    supabase.from("oppgaver").select("*").order("opprettet_dato", {
      ascending: false,
    }),
    supabase
      .from("bilder")
      .select("id,url,beskrivelse,tema,status,opprettet_dato")
      .eq("status", "godkjent")
      .order("opprettet_dato", { ascending: false }),
    supabase.from("lydfiler").select("*").order("opprettet_dato", {
      ascending: false,
    }),
  ]);

  if (oppgaverSvar.error || bilderSvar.error || lydSvar.error) {
    console.error("Kunne ikke hente oppgave-editor", {
      oppgaver: oppgaverSvar.error?.code,
      bilder: bilderSvar.error?.code,
      lyd: lydSvar.error?.code,
    });
    return <p className="error-message">Innholdsbanken kunne ikke lastes.</p>;
  }

  const oppgaver = z.array(oppgaveRadSchema).safeParse(oppgaverSvar.data);
  const bilder = z.array(bildeRadSchema).safeParse(bilderSvar.data);
  const lydfiler = z.array(lydRadSchema).safeParse(lydSvar.data);
  if (!oppgaver.success || !bilder.success || !lydfiler.success) {
    console.error("Ugyldig respons fra innholdsbanken");
    return <p className="error-message">Innholdsbanken har ugyldige data.</p>;
  }

  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Oppgaver</p>
          <h2>Oppgave-editor</h2>
        </div>
        <p>Alle publiserte oppgaver bør være kvalitetssjekket.</p>
      </div>
      <OppgaveEditor
        bilder={bilder.data.map((bilde) => ({ ...bilde, signertUrl: "" }))}
        lydfiler={lydfiler.data.map((lyd) => ({ ...lyd, signertUrl: "" }))}
        oppgaver={oppgaver.data}
      />
    </section>
  );
}
