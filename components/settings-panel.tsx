'use client'

import { useEffect, useState } from 'react'
import { CloudCog, Monitor, Moon, ShieldCheck, Sun, Type } from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'

const SETTINGS_KEY = 'querydojo-settings-v1'
type Theme = 'system' | 'light' | 'dark'

export function SettingsPanel() {
  const [aiEndpoint, setAiEndpoint] = useState('')
  const [theme, setTheme] = useState<Theme>('system')
  const [fontSize, setFontSize] = useState(14)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { aiEndpoint?: string; theme?: Theme; fontSize?: number }
    setAiEndpoint(settings.aiEndpoint ?? '')
    setTheme(settings.theme ?? 'system')
    setFontSize(settings.fontSize ?? 14)
  }, [])

  const applyTheme = (next: Theme) => {
    const dark = next === 'dark' || (next === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  }

  const save = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ aiEndpoint: aiEndpoint.trim(), theme, fontSize }))
    applyTheme(theme)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><CloudCog className="size-5" /></div><div><h2 className="font-black">AI 出题接口</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">可选。填写阿里云函数的 HTTPS 地址后启用 AI 出题；留空时只使用内置题库。</p></div></div>
          <label className="mt-5 block text-xs font-bold text-[var(--muted)]" htmlFor="ai-endpoint">函数地址</label>
          <input id="ai-endpoint" type="url" value={aiEndpoint} onChange={(event) => setAiEndpoint(event.target.value)} placeholder="https://example.cn-hangzhou.fcapp.run/generate" autoComplete="url" spellCheck={false} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-4 font-mono text-sm outline-none focus:border-[var(--accent)]" />
          <p className="mt-3 flex gap-2 text-xs leading-5 text-[var(--muted)]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />这里只保存接口地址。DeepSeek Key 应放在阿里云函数的环境变量中，不会进入网页代码或浏览器。</p>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Sun className="size-5" /></div><div><h2 className="font-black">外观</h2><p className="mt-1 text-sm text-[var(--muted)]">深色模式下编辑器、结果表和差异提示会同步换色。</p></div></div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {([{ id: 'system', label: '跟随系统', icon: Monitor }, { id: 'light', label: '浅色', icon: Sun }, { id: 'dark', label: '深色', icon: Moon }] as const).map((item) => <button key={item.id} type="button" onClick={() => { setTheme(item.id); applyTheme(item.id) }} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm font-bold ${theme === item.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--canvas)] text-[var(--muted)]'}`}><item.icon className="size-4" />{item.label}</button>)}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Type className="size-5" /></div><div><h2 className="font-black">编辑器字号</h2><p className="mt-1 text-sm text-[var(--muted)]">手机建议保持 16px，避免 iOS 输入时自动缩放。</p></div></div>
          <div className="mt-6 flex items-center gap-4"><span className="font-mono text-xs">14</span><input type="range" min="14" max="20" step="1" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} className="h-2 flex-1 accent-[var(--accent)]" aria-label="编辑器字号" /><span className="min-w-12 rounded-lg bg-[var(--canvas)] px-2 py-1 text-center font-mono text-sm font-bold">{fontSize}px</span></div>
        </Card>
      </div>
      <aside>
        <Card className="sticky top-6 p-5">
          <p className="text-sm font-black">设置只属于这台设备</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">草稿、做题记录、主题和布局都保存在浏览器中。清除网站数据会同时清除这些内容。</p>
          <Button className="mt-6 w-full" onClick={save}>{saved ? '已保存' : '保存设置'}</Button>
        </Card>
      </aside>
    </div>
  )
}
