import { getQuestionDistractors } from '../data/quiz-distractors'
import type { CivicsQuestion } from '../data/questions'

export type UserProfile = {
  state?: string
  stateCapital?: string
  governor?: string
  senator1?: string
  senator2?: string
  representative?: string
}

export function pickRandomQuestionId(ids: number[], currentId?: number) {
  if (ids.length === 0) return null
  if (ids.length === 1) return ids[0]

  let nextId = currentId
  while (nextId === currentId) {
    nextId = ids[Math.floor(Math.random() * ids.length)]
  }

  return nextId ?? ids[0]
}

export function pickUniqueQuestionIds(ids: number[], count: number) {
  const shuffled = [...ids].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function buildMultipleChoiceOptions(
  question: CivicsQuestion,
  optionCount = 5,
  acceptedAnswers: string[] = question.answers,
) {
  const normalizedAccepted = new Set(acceptedAnswers.map((answer) => answer.trim().toLowerCase()))
  const correct = acceptedAnswers[0] ?? question.answers[0]

  const uniqueDistractors = [...new Set(getQuestionDistractors(question))]
    .filter((candidate) => !normalizedAccepted.has(candidate.trim().toLowerCase()))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(0, optionCount - 1))

  const options = [correct, ...uniqueDistractors].sort(() => Math.random() - 0.5)

  return {
    options,
    correct,
  }
}

export const DYNAMIC_PROFILE_QUESTION_IDS = [20, 23, 43, 44] as const

export function requiresProfileAnswer(questionId: number) {
  return DYNAMIC_PROFILE_QUESTION_IDS.includes(
    questionId as (typeof DYNAMIC_PROFILE_QUESTION_IDS)[number],
  )
}

export function getDynamicAnswers(questionId: number, profile: UserProfile) {
  switch (questionId) {
    case 20:
      return [profile.senator1, profile.senator2].filter(Boolean) as string[]
    case 23:
      return profile.representative ? [profile.representative] : []
    case 43:
      return profile.governor ? [profile.governor] : []
    case 44:
      return profile.stateCapital ? [profile.stateCapital] : []
    default:
      return []
  }
}

export function mergeAcceptedAnswers(
  question: CivicsQuestion,
  profile: UserProfile,
): string[] {
  const dynamic = getDynamicAnswers(question.id, profile)
  if (dynamic.length === 0) return question.answers
  return [...new Set([...dynamic, ...question.answers])]
}
