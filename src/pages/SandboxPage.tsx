import { PageShell } from '../components/PageShell';
import { SandboxPlanner } from '../components/SandboxPlanner';

export function SandboxPage() {
  return (
    <PageShell title="Sandbox" subtitle="Simule cenarios financeiros hipoteticos">
      <SandboxPlanner />
    </PageShell>
  );
}
