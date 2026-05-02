import { redirect } from "next/navigation";

import { AppPanelShell } from "@/components/AppPanelShell";
import { loadProducerPanel } from "@/lib/producer-panel-load";

export default async function ProducerPerfilLayout({ children }: { children: React.ReactNode }) {
  const result = await loadProducerPanel();
  if (!result.ok) redirect(result.redirect);

  const { orgName, accountStatus } = result.ctx;

  return (
    <AppPanelShell orgName={orgName} accountStatus={accountStatus}>
      {children}
    </AppPanelShell>
  );
}
