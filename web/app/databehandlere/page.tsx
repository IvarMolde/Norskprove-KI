import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import { databehandlere } from "@/lib/personvern/databehandlere";

const tommeFelt = ["Navn", "Organisasjonsnummer", "Adresse", "E-post"] as const;

export default function Databehandlere() {
  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Databehandleravtaler</h1>
      <p className="text-base">Utkast. Ingen avtale er signert.</p>
      <p>
        En databehandler er et firma som behandler data for oss. Avtalen
        gjelder ikke før den er signert. Den skal være signert før vi
        åpner for alle.
      </p>
      <h2 className="text-xl font-semibold">Vi som ber om behandlingen</h2>
      <ul className="list-disc pl-6">
        {tommeFelt.map((felt) => (
          <li key={felt}>
            {felt}: ikke skrevet
          </li>
        ))}
      </ul>
      <h2 className="text-xl font-semibold">Det avtalen skal si</h2>
      <ul className="list-disc pl-6">
        <li>De behandler bare det som står under firmaet.</li>
        <li>De følger bare våre instruksjoner.</li>
        <li>De hjelper oss når en bruker sletter kontoen.</li>
        <li>De sier fra hvis noe går galt.</li>
      </ul>
      {databehandlere.map((firma) => (
        <section key={firma.navn} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{firma.navn}</h2>
          <p>Status: Ikke signert.</p>
          <p>{firma.iBruk ? "I bruk i utviklingen." : "Ikke i bruk."}</p>
          <p>{firma.hva}</p>
          <p>{firma.hvor}</p>
        </section>
      ))}
      <p>
        <Link className="underline" href="/personvern">
          Personvern
        </Link>
      </p>
    </Ramme>
  );
}
