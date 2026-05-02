import { redirect } from "next/navigation";

import { AppPanelShell } from "@/components/AppPanelShell";
import { PendingProducerGate } from "@/components/PendingProducerGate";
import { loadProducerPanel } from "@/lib/producer-panel-load";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const result = await loadProducerPanel();
  if (!result.ok) redirect(result.redirect);

  const { user, orgName, accountStatus } = result.ctx;
  const status = accountStatus;

  return (
    <AppPanelShell orgName={orgName} accountStatus={status}>
      {status === "approved" ? (
        children
      ) : (
        <PendingProducerGate userEmail={user.email ?? ""} status={status} />
      )}
    </AppPanelShell>
  );
}
