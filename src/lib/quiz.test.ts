import { describe, expect, it } from 'vitest'
import { QUESTIONS as ALL_QUESTIONS } from '../data/questions'
import type { CivicsQuestion } from '../data/questions'
import { QUESTION_DISTRACTORS, getQuestionDistractors } from '../data/quiz-distractors'
import {
  buildMultipleChoiceOptions,
  getDynamicAnswers,
  mergeAcceptedAnswers,
  pickUniqueQuestionIds,
} from './quiz'

const QUESTIONS: CivicsQuestion[] = [
  { id: 1, category: 'American Government', question: 'Q1', answers: ['A1'] },
  { id: 2, category: 'American Government', question: 'Q2', answers: ['A2'] },
  { id: 3, category: 'American Government', question: 'Q3', answers: ['A3'] },
  { id: 4, category: 'American Government', question: 'Q4', answers: ['A4'] },
  { id: 5, category: 'American Government', question: 'Q5', answers: ['A5'] },
]

describe('quiz helpers', () => {
  it('returns unique ids up to requested count', () => {
    const ids = pickUniqueQuestionIds([1, 2, 3, 4, 5], 3)
    expect(ids.length).toBe(3)
    expect(new Set(ids).size).toBe(3)
  })

  it('builds options including the correct answer', () => {
    const result = buildMultipleChoiceOptions(QUESTIONS[0], QUESTIONS, 5)
    expect(result.options.length).toBe(5)
    expect(result.options).toContain(result.correct)
    expect(result.correct).toBe('A1')
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
