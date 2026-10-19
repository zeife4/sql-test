'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from 'react'
import { EditorState, Compartment, Prec } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, hoverTooltip } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { sql as sqlLanguage, SQLite } from '@codemirror/lang-sql'
import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  completionStatus,
  snippetCompletion,
  startCompletion,
  type Completion,
  type CompletionContext,
} from '@codemirror/autocomplete'
import { Play, Send } from 'lucide-react'
import { completionSchema, parseSchema } from '@/lib/sql-schema'

export interface SqlEditorHandle {
  insertText: (text: string, cursorBack?: number) => void
  focus: () => void
}

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  ddl: string[]
  fontSize: number
  onRun: () => void
  onSubmit: () => void
}

const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'ON', 'AS', 'DISTINCT', 'WITH', 'UNION ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'IS NULL']

function createCompletionSource(schema: Record<string, string[]>) {
  const tables = Object.keys(schema)
  const allColumns = [...new Set(Object.values(schema).flat())]
  const keywordOptions: Completion[] = KEYWORDS.map((label) => ({ label, type: 'keyword', detail: 'SQL 关键字', boost: 1 }))
  const tableOptions: Completion[] = tables.map((label) => ({ label, type: 'class', detail: '表', boost: 3 }))
  const columnOptions: Completion[] = allColumns.map((label) => ({ label, type: 'property', detail: '列', boost: 2 }))
  const snippets: Completion[] = [
    snippetCompletion('COALESCE(${value}, ${fallback})', { label: 'coalesce', type: 'function', detail: '空值兜底' }),
    snippetCompletion('CASE WHEN ${condition} THEN ${value} ELSE ${fallback} END', { label: 'case_when', type: 'keyword', detail: '条件表达式' }),
    snippetCompletion("${column} >= '${start}' AND ${column} < '${end}'", { label: 'date_range', type: 'keyword', detail: '半开日期区间' }),
    snippetCompletion('LEFT JOIN ${table} ON ${left_key} = ${right_key}', { label: 'left_join', type: 'keyword', detail: '左连接模板' }),
    snippetCompletion('COUNT(${column})', { label: 'COUNT', type: 'function', detail: 'COUNT(expr) → integer' }),
    snippetCompletion('SUM(${column})', { label: 'SUM', type: 'function', detail: 'SUM(expr) → number' }),
    snippetCompletion('AVG(${column})', { label: 'AVG', type: 'function', detail: 'AVG(expr) → number' }),
  ]

  return (context: CompletionContext) => {
    const node = syntaxTree(context.state).resolveInner(context.pos, -1)
    if (/String|Comment/i.test(node.name)) return null
    const before = context.state.sliceDoc(Math.max(0, context.pos - 100), context.pos)
    const qualified = before.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/)
    if (qualified && schema[qualified[1]]) {
      const partial = qualified[2] ?? ''
      return {
        from: context.pos - partial.length,
        options: schema[qualified[1]].map((label) => ({ label, type: 'property', detail: `${qualified[1]} 的列`, boost: 10 })),
        validFor: /^\w*$/,
      }
    }
    const word = context.matchBefore(/[A-Za-z_]\w*/)
    if (!context.explicit && (!word || word.text.length < 1)) return null
    return {
      from: word?.from ?? context.pos,
      options: [...keywordOptions, ...tableOptions, ...columnOptions, ...snippets],
      validFor: /^\w*$/,
    }
  }
}

export const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(function SqlEditor(
  { value, onChange, ddl, fontSize, onRun, onSubmit },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const runRef = useRef(onRun)
  const submitRef = useRef(onSubmit)
  const fontCompartment = useRef(new Compartment())
  const languageCompartment = useRef(new Compartment())
  const completionCompartment = useRef(new Compartment())
  const [focused, setFocused] = useState(false)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [contextTable, setContextTable] = useState<string | null>(null)
  const schema = useMemo(() => completionSchema(ddl), [ddl])
  const parsedTables = useMemo(() => parseSchema(ddl), [ddl])

  onChangeRef.current = onChange
  runRef.current = onRun
  submitRef.current = onSubmit

  useImperativeHandle(ref, () => ({
    insertText(text, cursorBack = 0) {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length - cursorBack } })
      view.focus()
    },
    focus() { viewRef.current?.focus() },
  }), [])

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return
    const editor = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          languageCompartment.current.of(sqlLanguage({ dialect: SQLite, schema, upperCaseKeywords: true })),
          completionCompartment.current.of(autocompletion({
            activateOnTyping: true,
            maxRenderedOptions: 20,
            icons: true,
            override: [createCompletionSource(schema)],
          })),
          fontCompartment.current.of(EditorView.theme({
            '&': { fontSize: 'var(--editor-font-size)' },
          })),
          EditorView.theme({
            '&': { height: '100%', color: 'var(--ink)', backgroundColor: 'transparent' },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
            '.cm-content': { padding: '18px 0 28px', caretColor: 'var(--accent)' },
            '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--muted)', border: 'none', paddingLeft: '8px' },
            '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
            '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
            '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)' },
            '.cm-tooltip': { backgroundColor: 'var(--panel-strong)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' },
            '.cm-tooltip-autocomplete > ul': { maxHeight: '280px', fontFamily: 'var(--font-sans)' },
            '.cm-tooltip-autocomplete > ul > li': { minHeight: '34px', padding: '7px 10px' },
            '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' },
            '.cm-completionDetail': { marginLeft: '20px', color: 'var(--muted)', fontSize: '11px' },
          }),
          hoverTooltip((view, pos) => {
            const word = view.state.wordAt(pos)
            if (!word) return null
            const name = view.state.sliceDoc(word.from, word.to)
            const column = parsedTables.flatMap((table) => table.columns.map((item) => ({ ...item, table: table.name }))).find((item) => item.name === name)
            if (!column) return null
            return {
              pos: word.from,
              end: word.to,
              above: true,
              create() {
                const dom = document.createElement('div')
                dom.className = 'cm-column-tooltip'
                dom.textContent = `${column.table}.${column.name} · ${column.type}${column.nullable ? ' · 可为空' : ''}`
                return { dom }
              },
            }
          }, { hoverTime: 500 }),
          Prec.high(keymap.of([
            {
              key: 'Tab',
              run(view) {
                if (completionStatus(view.state) === 'active') return acceptCompletion(view)
                const range = view.state.selection.main
                view.dispatch({ changes: { from: range.from, to: range.to, insert: '  ' }, selection: { anchor: range.from + 2 } })
                return true
              },
            },
            { key: 'Mod-Space', run: startCompletion },
            { key: 'Mod-Enter', run: () => { runRef.current(); return true } },
            { key: 'Mod-Shift-Enter', run: () => { submitRef.current(); return true } },
          ])),
          keymap.of([...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
            if (update.selectionSet || update.docChanged) {
              const before = update.state.sliceDoc(Math.max(0, update.state.selection.main.head - 80), update.state.selection.main.head)
              const match = before.match(/([A-Za-z_]\w*)\.[A-Za-z_\w]*$/)
              setContextTable(match?.[1] && schema[match[1]] ? match[1] : null)
            }
            if (update.focusChanged) setFocused(update.view.hasFocus)
          }),
        ],
      }),
    })
    viewRef.current = editor
    return () => {
      editor.destroy()
      viewRef.current = null
    }
    // The instance is intentionally created once; schema and font updates use compartments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        languageCompartment.current.reconfigure(sqlLanguage({ dialect: SQLite, schema, upperCaseKeywords: true })),
        completionCompartment.current.reconfigure(autocompletion({ activateOnTyping: true, maxRenderedOptions: 20, icons: true, override: [createCompletionSource(schema)] })),
      ],
    })
  }, [schema])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: fontCompartment.current.reconfigure(EditorView.theme({ '&': { fontSize: 'var(--editor-font-size)' } })) })
  }, [fontSize])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setKeyboardOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  const contextualColumns = contextTable ? schema[contextTable] ?? [] : []
  const mobileChips = [...(contextualColumns.length ? contextualColumns.slice(0, 8) : KEYWORDS.slice(0, 10)), ...Object.keys(schema).slice(0, 4), '()', "''", ',', '*', '--']
  const insertChip = (chip: string) => {
    let text = chip
    let cursorBack = 0
    if (chip === '()') { text = '()'; cursorBack = 1 }
    else if (chip === "''") { text = "''"; cursorBack = 1 }
    else if (KEYWORDS.includes(chip)) text = `${chip} `
    else if (Object.hasOwn(schema, chip)) text = `${chip} `
    else if (!/[,'*]/.test(chip)) text = `${chip} `
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length - cursorBack } })
    view.focus()
  }

  return (
    <>
      <div
        ref={hostRef}
        className="sql-editor-host h-full min-h-0 overflow-hidden"
        style={{ '--editor-user-font-size': `${fontSize}px` } as CSSProperties}
        aria-label="SQL 编辑器"
      />
      <div
        className={`mobile-sql-toolbar ${focused ? 'is-focused' : ''}`}
        style={{ bottom: keyboardOffset > 0 ? keyboardOffset : 'calc(76px + env(safe-area-inset-bottom))' }}
        aria-label="SQL 快捷输入"
      >
        <div className="flex min-w-max items-center gap-2 px-3 py-2">
          {mobileChips.map((chip, index) => (
            <button
              key={`${chip}-${index}`}
              type="button"
              className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 font-mono text-sm font-semibold text-[var(--ink)] shadow-sm"
              onPointerDown={(event) => { event.preventDefault(); insertChip(chip) }}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 border-l border-[var(--line)] bg-[var(--panel-strong)] px-2">
          <button className="size-10 text-[var(--accent)]" type="button" aria-label="运行" onPointerDown={(event) => { event.preventDefault(); onRun() }}><Play className="mx-auto size-4" /></button>
          <button className="size-10 text-[var(--accent)]" type="button" aria-label="提交" onPointerDown={(event) => { event.preventDefault(); onSubmit() }}><Send className="mx-auto size-4" /></button>
        </div>
      </div>
      <style jsx global>{`
        .cm-column-tooltip { padding: 8px 10px; font: 12px var(--font-sans); }
        .sql-editor-host { --editor-font-size: var(--editor-user-font-size, 14px); }
        .mobile-sql-toolbar { display: none; position: fixed; left: 0; right: 0; z-index: 60; overflow-x: auto; border-top: 1px solid var(--line); background: color-mix(in srgb, var(--panel) 94%, transparent); backdrop-filter: blur(14px); }
        @media (max-width: 1023px) {
          .sql-editor-host { --editor-font-size: max(16px, var(--editor-user-font-size, 16px)); }
          .mobile-sql-toolbar.is-focused { display: flex; }
        }
      `}</style>
    </>
  )
})
