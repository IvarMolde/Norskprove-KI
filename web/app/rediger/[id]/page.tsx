import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import {
  STATUS_ETIKETT,
  TYPE_ETIKETT,
  innholdTilSkjema,
  type Lesetype,
} from "@/lib/oppgaver/innhold";
import { hentRedaktorOppgave } from "@/lib/oppgaver/redaktor";
import { ArkiverSkjema, OppgaveSkjema } from "../skjema";
import { redaktorAvvist } from "../tilgang";

export default async function EndreOppgavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const avvist = await redaktorAvvist();
  if (avvist) {
    return avvist;
  }

  const { id } = await params;
  const resultat = await hentRedaktorOppgave(id);
  if (!resultat.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Rediger oppgaver</h1>
        <p role="alert">{resultat.feil}</p>
        <Link className="underline" href="/rediger">
          Til listen
        </Link>
      </Ramme>
    );
  }

  const oppgave = resultat.data;
  const skjema = innholdTilSkjema(oppgave.type, oppgave.innhold);
  const navn = visningsnavn(oppgave.type, oppgave.innhold);

  return (
    <Ramme>
      <Link className="underline" href="/rediger">
        Til listen
      </Link>
      <h1 className="text-2xl font-semibold">{navn}</h1>
      <p>
        {TYPE_ETIKETT[oppgave.type]} — {oppgave.niva} —{" "}
        {STATUS_ETIKETT[oppgave.status]}
      </p>
      {skjema ? (
        <OppgaveSkjema
          id={oppgave.id}
          innhold={skjema}
          niva={oppgave.niva}
          tema={oppgave.tema ?? ""}
        />
      ) : (
        <p>Denne oppgaven kan ikke endres her. Du kan arkivere den.</p>
      )}
      {oppgave.status === "arkivert" ? (
        <p>Oppgaven er arkivert.</p>
      ) : (
        <ArkiverSkjema id={oppgave.id} />
      )}
    </Ramme>
  );
}

function visningsnavn(type: Lesetype, innhold: unknown): string {
  if (typeof innhold !== "object" || innhold === null) {
    return TYPE_ETIKETT[type];
  }

  const kilde = type === "synonym" || type === "antonym" ? "ord" : "tittel";
  const verdi = (innhold as Record<string, unknown>)[kilde];
  return typeof verdi === "string" && verdi.trim() ? verdi : TYPE_ETIKETT[type];
}
