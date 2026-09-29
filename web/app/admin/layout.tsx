import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireAdmin();

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Lingx</p>
          <h1>Innholdsadministrasjon</h1>
        </div>
        <p className="admin-user">{user.email}</p>
      </header>
      <AdminNav />
      <main className="admin-main">{children}</main>
    </div>
  );
}
