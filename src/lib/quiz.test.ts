import { describe, expect, it } from 'vitest'
import { QUESTIONS as ALL_QUESTIONS } from '../data/questions'
import type { CivicsQuestion } from '../data/questions'
import { QUESTION_DISTRACTORS, getQuestionDistractors } from '../data/quiz-distractors'
import {
  buildMultipleChoiceOptions,
  getDynamicAnswers,
  mergeAcceptedAnswers,
  pickUniqueQuestionIds,
  requiresProfileAnswer,
} from './quiz'

describe('quiz helpers', () => {
  it('returns unique ids up to requested count', () => {
    const ids = pickUniqueQuestionIds([1, 2, 3, 4, 5], 3)
    expect(ids.length).toBe(3)
    expect(new Set(ids).size).toBe(3)
  })

  it('builds options from dedicated distractors only', () => {
    const question = ALL_QUESTIONS.find((q) => q.id === 39)
    expect(question).toBeTruthy()

    const result = buildMultipleChoiceOptions(question!, 5)
    const dedicated = new Set(getQuestionDistractors(question!))

    expect(result.options).toContain(result.correct)
    expect(result.correct).toBe('Nine (9)')

    for (const option of result.options) {
      expect(option === result.correct || dedicated.has(option)).toBe(true)
    }
  })

  it('returns dedicated distractors from separate bank', () => {
    const distractors = getQuestionDistractors({
      id: 7,
      category: 'American Government',
      question: 'How many amendments does the Constitution have?',
      answers: ['Twenty-seven (27)'],
    })

    expect(distractors.length).toBeGreaterThan(0)
    expect(distractors).not.toContain('Twenty-seven (27)')
  })

  it('covers all civics questions with linked distractor entries', () => {
    for (const question of ALL_QUESTIONS) {
      const distractors = QUESTION_DISTRACTORS[question.id] ?? []
      expect(distractors.length).toBeGreaterThanOrEqual(6)
      expect(distractors.length).toBeLessThanOrEqual(8)

      for (const accepted of question.answers) {
        expect(distractors).not.toContain(accepted)
      }
    }
  })

  it('supports dynamic accepted answers when building options', () => {
    const question: CivicsQuestion = {
      id: 44,
      category: 'American Government',
      question: 'What is the capital of your state?',
      answers: ['Varies by state'],
    }

    const result = buildMultipleChoiceOptions(question, 5, ['Sacramento', 'Varies by state'])

    expect(result.correct).toBe('Sacramento')
    expect(result.options).toContain('Sacramento')
    expect(result.options).not.toContain('Varies by state')
  })

  it('marks profile-driven questions as requiring profile answers', () => {
    expect(requiresProfileAnswer(20)).toBe(true)
    expect(requiresProfileAnswer(23)).toBe(true)
    expect(requiresProfileAnswer(47)).toBe(true)
    expect(requiresProfileAnswer(39)).toBe(false)
  })

  it('uses dynamic answers for state/profile questions', () => {
    const dynamic = getDynamicAnswers(43, { governor: 'Jane Doe' })
    expect(dynamic).toEqual(['Jane Doe'])
  })

  it('merges static and dynamic answers without duplicates', () => {
    const q: CivicsQuestion = {
      id: 44,
      category: 'American Government',
      question: 'State capital?',
      answers: ['Varies by state'],
    }

    const merged = mergeAcceptedAnswers(q, { stateCapital: 'Sacramento' })
    expect(merged).toContain('Sacramento')
    expect(merged).toContain('Varies by state')
  })
})
