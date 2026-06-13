import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import MyAdviserClient from "@/components/aegis/my-adviser/MyAdviserClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyAdviserPage() {
  return (
    <AuthenticatedAppShell
      title="My Adviser"
      subtitle="Your assigned wealth architecture adviser"
    >
      <MyAdviserClient />
    </AuthenticatedAppShell>
  );
}
