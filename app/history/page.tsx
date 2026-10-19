import { HistoryList } from '@/components/history-list'
import { SimpleShell } from '@/components/simple-shell'

export default function HistoryPage() {
  return <SimpleShell eyebrow="Learning history" title="每一次出错都有迹可循"><HistoryList /></SimpleShell>
}
