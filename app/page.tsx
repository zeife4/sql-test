import { PracticeShell } from '@/components/practice-shell'
import { FALLBACK_QUESTIONS } from '@/lib/fallback'

export default function HomePage() {
  const initial = FALLBACK_QUESTIONS.find((question) => question.difficulty === 'L2') ?? FALLBACK_QUESTIONS[0]
  return <PracticeShell initialQuestion={initial} />
}
