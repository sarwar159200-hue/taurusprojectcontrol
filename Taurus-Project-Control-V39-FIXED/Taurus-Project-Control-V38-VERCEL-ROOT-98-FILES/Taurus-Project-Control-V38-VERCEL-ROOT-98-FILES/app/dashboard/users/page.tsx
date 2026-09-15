import { UserManagement } from "@/components/user-management";
import { listManagedUsers } from "@/lib/admin/users";
import { requireSection } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import type { ManagedUser } from "@/lib/types";

export default async function UsersPage() {
  const user = await requireSection("user_access");
  let users: ManagedUser[] = [];
  let loadError = "";

  try {
    users = await listManagedUsers();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Users could not be loaded.";
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCESS CONTROL</span>
          <h1>Users and section permissions</h1>
          <p>Create accounts with temporary passwords, control every portal section, and remove access when required.</p>
        </div>
      </div>
      {loadError ? <div className="validation-error">{loadError}</div> : null}
      <UserManagement
        canManage={canAccessSection(user, "user_access", "manage")}
        currentUserId={user.id}
        currentUserRole={user.role}
        initialUsers={users}
      />
    </>
  );
}
