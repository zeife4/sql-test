import { SettingsPanel } from '@/components/settings-panel'
import { SimpleShell } from '@/components/simple-shell'

export default function SettingsPage() {
  return <SimpleShell eyebrow="Preferences" title="把练习场调成顺手的样子"><SettingsPanel /></SimpleShell>
}
