'use client';

// Este layout ahora es redundante ya que el principal está en src/app/admin/layout.tsx
// Se deja solo como un passthrough de children.
export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}