import { SimpleShell } from '@/components/simple-shell'
import { Card } from '@/components/ui/card'

const shortcuts = [
  ['运行查询', 'Ctrl / ⌘ + Enter'], ['提交判题', 'Ctrl / ⌘ + Shift + Enter'], ['主动补全', 'Ctrl / ⌘ + Space'],
  ['确认补全', 'Tab / Enter'], ['关闭补全', 'Esc'], ['快捷键面板', '?'],
]

export default function AboutPage() {
  return (
    <SimpleShell eyebrow="How it works" title="写 SQL，真实运行，立刻知道差在哪">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6"><h2 className="text-lg font-black">不是字符串匹配</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">每道题都携带独立的 SQLite 数据集。浏览器会在隔离线程中分别执行你的 SQL 和参考 SQL，再按列、行、数值精度、NULL 与排序要求比较结果集。大模型只负责出题，不参与判分。</p></Card>
        <Card className="p-6"><h2 className="text-lg font-black">离线也能练</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">内置题库覆盖 L1 到 L5。配置阿里云函数地址后，可按所选难度和知识点调用 DeepSeek 生成新题；接口不可用时会自动回到内置题库。</p></Card>
        <Card className="p-6 lg:col-span-2"><h2 className="text-lg font-black">键盘快捷键</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{shortcuts.map(([label, key]) => <div key={label} className="flex items-center justify-between rounded-xl bg-[var(--canvas)] px-4 py-3 text-sm"><span className="text-[var(--muted)]">{label}</span><kbd className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 font-mono text-xs">{key}</kbd></div>)}</div></Card>
      </div>
    </SimpleShell>
  )
}
