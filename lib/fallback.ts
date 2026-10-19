import bank from '@/data/fallback-bank.json'
import type { Difficulty, KnowledgePoint, Question } from './types'

const baseBank = bank as Question[]

function variantOf(question: Question, variant: number): Question {
  if (variant === 0) return question
  return {
    ...question,
    id: `${question.id}-v${variant + 1}`,
    title: `${question.title} · ${variant + 1}`,
  }
}

export const FALLBACK_QUESTIONS: Question[] = baseBank.flatMap((question) =>
  Array.from({ length: 5 }, (_, index) => variantOf(question, index)),
)

export function findFallbackQuestion(id: string) {
  return FALLBACK_QUESTIONS.find((question) => question.id === id)
}

export function pickFallbackQuestion(
  difficulty: Difficulty,
  knowledgePoints: KnowledgePoint[],
  excludeId?: string,
) {
  const sameLevel = FALLBACK_QUESTIONS.filter((question) => question.difficulty === difficulty && question.id !== excludeId)
  const matching = sameLevel.filter((question) =>
    knowledgePoints.length === 0 || knowledgePoints.some((point) => question.knowledgePoints.includes(point)),
  )
  const pool = matching.length ? matching : sameLevel.length ? sameLevel : FALLBACK_QUESTIONS
  return pool[Math.floor(Math.random() * pool.length)]
}

