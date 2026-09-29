import Link from "next/link";

const lenker = [
  { href: "/admin", tekst: "Oversikt" },
  { href: "/admin/oppgaver", tekst: "Oppgaver" },
  { href: "/admin/bilder", tekst: "Bilder" },
  { href: "/admin/opptaksstudio", tekst: "Opptaksstudio" },
];

export function AdminNav() {
  return (
    <nav aria-label="Adminmeny" className="admin-nav">
      {lenker.map((lenke) => (
        <Link key={lenke.href} href={lenke.href}>
          {lenke.tekst}
        </Link>
      ))}
    </nav>
  );
}
