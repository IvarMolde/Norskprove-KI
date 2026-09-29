import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";

export default async function Adminside() {
  const { supabase } = await requireAdmin();
  const [oppgaver, bilder, lydfiler] = await Promise.all([
    supabase.from("oppgaver").select("*", { count: "exact", head: true }),
    supabase
      .from("bilder")
      .select("*", { count: "exact", head: true })
      .eq("status", "venter_godkjenning"),
    supabase.from("lydfiler").select("*", { count: "exact", head: true }),
  ]);

  if (oppgaver.error || bilder.error || lydfiler.error) {
    console.error("Kunne ikke hente adminoversikt", {
      oppgaver: oppgaver.error?.code,
      bilder: bilder.error?.code,
      lydfiler: lydfiler.error?.code,
    });
  }

  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Oversikt</p>
          <h2>Innholdsbanken</h2>
        </div>
        <p>Opprett og kvalitetssikre innhold før publisering.</p>
      </div>

      <div className="stat-grid">
        <Link className="stat-card" href="/admin/oppgaver">
          <span>Oppgaver</span>
          <strong>{oppgaver.count ?? 0}</strong>
          <small>Åpne oppgave-editor</small>
        </Link>
        <Link className="stat-card" href="/admin/bilder">
          <span>Venter på bilde­godkjenning</span>
          <strong>{bilder.count ?? 0}</strong>
          <small>Gå til bildebanken</small>
        </Link>
        <Link className="stat-card" href="/admin/opptaksstudio">
          <span>Lydfiler</span>
          <strong>{lydfiler.count ?? 0}</strong>
          <small>Åpne opptaksstudio</small>
        </Link>
      </div>
    </section>
  );
}
