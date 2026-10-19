import type { Difficulty, KnowledgePoint } from './types'

export const DIFFICULTIES: Array<{ id: Difficulty; name: string; subtitle: string }> = [
  { id: 'L1', name: '入门', subtitle: '查询与过滤' },
  { id: 'L2', name: '基础', subtitle: '聚合与分组' },
  { id: 'L3', name: '进阶', subtitle: '连接与子查询' },
  { id: 'L4', name: '高级', subtitle: '窗口与复杂口径' },
  { id: 'L5', name: '专家', subtitle: '多步业务推理' },
]

export const KNOWLEDGE_POINTS: Array<{ id: KnowledgePoint; label: string; minLevel: number }> = [
  { id: 'basic_select', label: '基础查询', minLevel: 1 },
  { id: 'sort_limit', label: '排序分页', minLevel: 1 },
  { id: 'aggregate', label: '聚合函数', minLevel: 2 },
  { id: 'group_having', label: '分组筛选', minLevel: 2 },
  { id: 'case_when', label: '条件表达式', minLevel: 2 },
  { id: 'join', label: '多表连接', minLevel: 3 },
  { id: 'subquery', label: '子查询', minLevel: 3 },
  { id: 'date_func', label: '日期函数', minLevel: 3 },
  { id: 'string_func', label: '字符串', minLevel: 2 },
  { id: 'null_handling', label: 'NULL 语义', minLevel: 2 },
  { id: 'window_fn', label: '窗口函数', minLevel: 4 },
  { id: 'cte', label: 'CTE', minLevel: 4 },
  { id: 'topn_per_group', label: '分组 TopN', minLevel: 4 },
  { id: 'gaps_islands', label: '连续区间', minLevel: 5 },
  { id: 'pivot', label: '行列转置', minLevel: 5 },
  { id: 'funnel_retention', label: '漏斗留存', minLevel: 5 },
]

export const DIFFICULTY_ALLOWED: Record<Difficulty, KnowledgePoint[]> = {
  L1: ['basic_select', 'sort_limit', 'string_func', 'null_handling'],
  L2: ['basic_select', 'sort_limit', 'aggregate', 'group_having', 'case_when', 'string_func', 'null_handling'],
  L3: ['aggregate', 'group_having', 'join', 'subquery', 'case_when', 'date_func', 'string_func', 'null_handling'],
  L4: ['aggregate', 'join', 'subquery', 'case_when', 'date_func', 'window_fn', 'cte', 'topn_per_group'],
  L5: ['join', 'subquery', 'date_func', 'window_fn', 'cte', 'topn_per_group', 'gaps_islands', 'pivot', 'funnel_retention'],
}

export function knowledgeLabel(id: KnowledgePoint) {
  return KNOWLEDGE_POINTS.find((item) => item.id === id)?.label ?? id
}
