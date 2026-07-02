"use client";

type FrontendOnlyAdminGateProps = {
  currentUserRole: string;
  targetUserId: number;
};

export function FrontendOnlyAdminGate({ currentUserRole, targetUserId }: FrontendOnlyAdminGateProps) {
  const isAdmin = currentUserRole === "ADMIN";

  if (!isAdmin) {
    return null;
  }

  async function promoteUser() {
    await fetch("/api/qedix/frontend-only-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUserId,
        isAdmin,
      }),
    });
  }

  return (
    <button type="button" onClick={promoteUser}>
      Promote user
    </button>
  );
}
