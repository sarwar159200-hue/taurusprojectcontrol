import { requireSuperAdmin } from "@/lib/mccs/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return children;
}
