import { getQuestionDistractors } from '../data/quiz-distractors'
import type { CivicsQuestion } from '../data/questions'

export type UserProfile = {
  state?: string
  stateCapital?: string
  governor?: string
  senator1?: string
  senator2?: string
  representative?: string
  president?: string
  vicePresident?: string
  speaker?: string
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
  allQuestions: CivicsQuestion[],
  optionCount = 5,
) {
  const correct = question.answers[0]

  const dedicatedDistractors = getQuestionDistractors(question)

  const fallbackDistractors = allQuestions
    .filter((q) => q.id !== question.id)
    .map((q) => q.answers[0])
    .filter((answer): answer is string => Boolean(answer) && answer !== correct)

  const uniqueDistractors = [...new Set([...dedicatedDistractors, ...fallbackDistractors])]
    .filter((candidate) => !question.answers.includes(candidate))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(0, optionCount - 1))

  const options = [correct, ...uniqueDistractors].sort(() => Math.random() - 0.5)

  return {
    options,
    correct,
  }
}

export function getDynamicAnswers(questionId: number, profile: UserProfile) {
  switch (questionId) {
    case 20:
      return [profile.senator1, profile.senator2].filter(Boolean) as string[]
    case 23:
      return profile.representative ? [profile.representative] : []
    case 28:
      return profile.president ? [profile.president] : []
    case 29:
      return profile.vicePresident ? [profile.vicePresident] : []
    case 43:
      return profile.governor ? [profile.governor] : []
    case 44:
      return profile.stateCapital ? [profile.stateCapital] : []
    case 47:
      return profile.speaker ? [profile.speaker] : []
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
