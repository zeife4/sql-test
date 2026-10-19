const { randomUUID } = require('node:crypto')

const DIFFICULTY_POINTS = {
  L1: ['basic_select', 'sort_limit', 'string_func', 'null_handling'],
  L2: ['basic_select', 'sort_limit', 'aggregate', 'group_having', 'case_when', 'string_func', 'null_handling'],
  L3: ['aggregate', 'group_having', 'join', 'subquery', 'case_when', 'date_func', 'string_func', 'null_handling'],
  L4: ['aggregate', 'join', 'subquery', 'case_when', 'date_func', 'window_fn', 'cte', 'topn_per_group'],
  L5: ['join', 'subquery', 'date_func', 'window_fn', 'cte', 'topn_per_group', 'gaps_islands', 'pivot', 'funnel_retention'],
}

const SYSTEM_PROMPT = `你是一位资深 SQL 教学出题专家。请生成一道能在 SQLite 真实执行的中文练习题，并且只输出严格 JSON。
硬性规则：场景来自真实行业；表与列使用英文 snake_case；所有引用必须存在；L1 单表基础，L2 聚合分组，L3 JOIN/子查询，L4 窗口函数或 CTE，L5 多步业务推理；参考答案必须是单条 SELECT 或 WITH 查询且结果非空；种子数据包含 NULL 和边界行；不要输出 Markdown。
JSON 必须包含 title,difficulty,knowledgePoints,businessContext,schema,question,requirements,hints,referenceSql,explanation,traps,industry。schema 格式为 {"ddl":[...],"seed":[...]}，总数据量控制在 8–40 行。`

function corsHeaders(origin) {
  const allowed = process.env.ALLOWED_ORIGIN || '*'
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : origin === allowed ? origin : allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '3600',
    'Cache-Control': 'no-store',
  }
}

function reply(statusCode, body, origin) {
  return { statusCode, headers: corsHeaders(origin), body: body ? JSON.stringify(body) : '' }
}

function validQuestion(question, difficulty, knowledgePoints) {
  return question && typeof question === 'object'
    && typeof question.title === 'string'
    && typeof question.businessContext === 'string'
    && typeof question.question === 'string'
    && typeof question.referenceSql === 'string'
    && /^(SELECT|WITH)\b/i.test(question.referenceSql.trim())
    && question.schema && Array.isArray(question.schema.ddl) && question.schema.ddl.length > 0
    && Array.isArray(question.schema.seed) && question.schema.seed.length > 0
    && Array.isArray(question.requirements) && Array.isArray(question.hints) && Array.isArray(question.traps)
    && question.difficulty === difficulty
    && Array.isArray(question.knowledgePoints)
    && question.knowledgePoints.every((point) => knowledgePoints.includes(point))
}

async function generateQuestion(apiKey, difficulty, knowledgePoints) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        response_format: { type: 'json_object' },
        temperature: 1,
        max_tokens: 6000,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `难度：${difficulty}。知识点只能从这些值中选择并至少选择一个：${knowledgePoints.join(', ')}。生成完整题目和可执行数据集。` },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`DeepSeek 返回 ${response.status}`)
    const payload = await response.json()
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek 没有返回题目。')
    return JSON.parse(content)
  } finally {
    clearTimeout(timer)
  }
}

exports.handler = async (event, context, callback) => {
  let request
  try {
    request = JSON.parse(Buffer.isBuffer(event) ? event.toString('utf8') : event)
  } catch {
    callback(null, reply(400, { message: '无法解析请求。' }, ''))
    return
  }

  const method = request.requestContext?.http?.method || request.httpMethod || 'POST'
  const origin = request.headers?.origin || request.headers?.Origin || ''
  const allowedOrigin = process.env.ALLOWED_ORIGIN
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    callback(null, reply(403, { message: '当前来源不在允许列表中。' }, origin))
    return
  }
  if (method === 'OPTIONS') {
    callback(null, reply(204, null, origin))
    return
  }
  if (method !== 'POST') {
    callback(null, reply(405, { message: '只支持 POST 请求。' }, origin))
    return
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    callback(null, reply(500, { message: '函数尚未配置 DEEPSEEK_API_KEY。' }, origin))
    return
  }

  try {
    const bodyText = request.isBase64Encoded
      ? Buffer.from(request.body || '', 'base64').toString('utf8')
      : request.body || '{}'
    const body = typeof bodyText === 'string' ? JSON.parse(bodyText) : bodyText
    const difficulty = Object.hasOwn(DIFFICULTY_POINTS, body.difficulty) ? body.difficulty : 'L2'
    const allowedPoints = DIFFICULTY_POINTS[difficulty]
    const selected = Array.isArray(body.knowledgePoints)
      ? body.knowledgePoints.filter((point) => allowedPoints.includes(point)).slice(0, 3)
      : []
    const effectivePoints = selected.length ? selected : allowedPoints.slice(0, 2)
    const generated = await generateQuestion(apiKey, difficulty, effectivePoints)
    if (!validQuestion(generated, difficulty, effectivePoints)) throw new Error('AI 返回的题目结构不完整。')
    const ordered = /(排序|升序|降序|从高到低|从低到高|前\s*\d+|Top\s*\d+)/i.test(generated.question)
    callback(null, reply(200, {
      question: { ...generated, id: `ai-${randomUUID()}`, ordered, source: 'llm' },
      message: 'AI 新题已生成，浏览器将执行参考答案后再展示。',
    }, origin))
  } catch (error) {
    callback(null, reply(502, { message: error instanceof Error ? error.message : 'AI 出题失败。' }, origin))
  }
}
