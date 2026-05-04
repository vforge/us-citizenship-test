import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QUESTIONS } from './data/questions'
import { FEDERAL_OFFICIAL_DEFAULTS } from './data/federal-officials'
import { STATE_OFFICIALS_BY_ABBR } from './data/state-officials'
import type { UserProfile } from './lib/quiz'
import {
  buildMultipleChoiceOptions,
  mergeAcceptedAnswers,
  pickRandomQuestionId,
  pickUniqueQuestionIds,
} from './lib/quiz'
import './App.css'

type Confidence = 'known' | 'review'
type Filter = 'all' | 'unrated' | 'review'
type Mode = 'practice' | 'interview' | 'quiz' | 'drill' | 'settings'

type AppBackup = {
  ratings: Record<number, Confidence>
  profile: UserProfile
  missedQuestionIds: number[]
}

const STORAGE_KEY = 'us-citizenship-test.ratings.v2'
const PROFILE_KEY = 'us-citizenship-test.profile.v1'
const MISSED_KEY = 'us-citizenship-test.missed.v1'
const GUIDE_OPEN_KEY = 'us-citizenship-test.guide-open.v1'
const MODE_KEY = 'us-citizenship-test.mode.v1'
const INTERVIEW_QUESTION_COUNT = 10
const INTERVIEW_PASS_MARK = 6

function getRandomQuestionId() {
  const randomIndex = Math.floor(Math.random() * QUESTIONS.length)
  return QUESTIONS[randomIndex]?.id ?? null
}

function App() {
  const [mode, setMode] = useState<Mode>('practice')
  const [filter, setFilter] = useState<Filter>('all')
  const [isGuideOpen, setIsGuideOpen] = useState(true)
  const [isAnswerVisible, setIsAnswerVisible] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [zipLookupStatus, setZipLookupStatus] = useState('')
  const [isZipLookupLoading, setIsZipLookupLoading] = useState(false)
  const [ratings, setRatings] = useState<Record<number, Confidence>>({})
  const [attemptCount, setAttemptCount] = useState(0)
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(() =>
    getRandomQuestionId(),
  )
  const [profile, setProfile] = useState<UserProfile>({})
  const [missedQuestionIds, setMissedQuestionIds] = useState<number[]>([])

  const [interviewQuestionIds, setInterviewQuestionIds] = useState<number[]>([])
  const [interviewIndex, setInterviewIndex] = useState(0)
  const [interviewResults, setInterviewResults] = useState<boolean[]>([])

  const [quizQuestionId, setQuizQuestionId] = useState<number | null>(() =>
    getRandomQuestionId(),
  )
  const [quizChoice, setQuizChoice] = useState<string | null>(null)
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [quizStreak, setQuizStreak] = useState(0)
  const [quizBestStreak, setQuizBestStreak] = useState(0)
  const [quizCorrectTotal, setQuizCorrectTotal] = useState(0)
  const [quizAttemptsTotal, setQuizAttemptsTotal] = useState(0)
  const [quizStartedAt] = useState(() => Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - quizStartedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [quizStartedAt])

  useEffect(() => {
    try {
      const rawRatings = localStorage.getItem(STORAGE_KEY)
      if (rawRatings) {
        const parsed = JSON.parse(rawRatings) as Record<string, Confidence>
        const sanitized = Object.fromEntries(
          Object.entries(parsed)
            .filter(([, value]) => value === 'known' || value === 'review')
            .map(([key, value]) => [Number(key), value]),
        ) as Record<number, Confidence>
        setRatings(sanitized)
      }

      const rawProfile = localStorage.getItem(PROFILE_KEY)
      if (rawProfile) {
        setProfile(JSON.parse(rawProfile) as UserProfile)
      }

      const rawMissed = localStorage.getItem(MISSED_KEY)
      if (rawMissed) {
        const parsed = JSON.parse(rawMissed) as number[]
        setMissedQuestionIds(parsed.filter((n) => Number.isInteger(n)))
      }

      const rawGuideOpen = localStorage.getItem(GUIDE_OPEN_KEY)
      if (rawGuideOpen !== null) {
        setIsGuideOpen(rawGuideOpen === 'true')
      }

      const rawMode = localStorage.getItem(MODE_KEY)
      if (
        rawMode === 'practice' ||
        rawMode === 'interview' ||
        rawMode === 'quiz' ||
        rawMode === 'drill' ||
        rawMode === 'settings'
      ) {
        setMode(rawMode)
      }
    } catch {
      // ignore invalid storage
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings))
  }, [ratings])

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    localStorage.setItem(MISSED_KEY, JSON.stringify(missedQuestionIds))
  }, [missedQuestionIds])

  useEffect(() => {
    localStorage.setItem(GUIDE_OPEN_KEY, String(isGuideOpen))
  }, [isGuideOpen])

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  const filteredQuestions = useMemo(() => {
    if (filter === 'all') return QUESTIONS
    if (filter === 'unrated') return QUESTIONS.filter((q) => !ratings[q.id])
    return QUESTIONS.filter((q) => ratings[q.id] === 'review')
  }, [filter, ratings])

  useEffect(() => {
    if (filteredQuestions.length === 0) {
      setCurrentQuestionId(null)
      return
    }

    const existsInDeck = filteredQuestions.some((q) => q.id === currentQuestionId)
    if (!existsInDeck) {
      setCurrentQuestionId(filteredQuestions[0].id)
      setIsAnswerVisible(false)
    }
  }, [filteredQuestions, currentQuestionId])

  const currentQuestion = filteredQuestions.find((q) => q.id === currentQuestionId)

  const knownCount = Object.values(ratings).filter((v) => v === 'known').length
  const reviewCount = Object.values(ratings).filter((v) => v === 'review').length
  const ratedCount = knownCount + reviewCount
  const unseenCount = QUESTIONS.length - ratedCount
  const progress = Math.round((ratedCount / QUESTIONS.length) * 100)

  const categoryStats = useMemo(() => {
    const byCategory = new Map<string, { total: number; known: number; review: number }>()

    for (const question of QUESTIONS) {
      const current = byCategory.get(question.category) ?? {
        total: 0,
        known: 0,
        review: 0,
      }

      current.total += 1
      if (ratings[question.id] === 'known') current.known += 1
      if (ratings[question.id] === 'review') current.review += 1

      byCategory.set(question.category, current)
    }

    return [...byCategory.entries()]
  }, [ratings])

  const weakCategories = useMemo(() => {
    return [...categoryStats]
      .map(([category, stats]) => ({
        category,
        knownRatio: stats.total === 0 ? 0 : stats.known / stats.total,
        ...stats,
      }))
      .sort((a, b) => a.knownRatio - b.knownRatio)
      .slice(0, 2)
  }, [categoryStats])

  const suggestedMode = useMemo(() => {
    if (reviewCount >= 12) return 'Drill mode'
    if (knownCount < 40) return 'Flashcards'
    if (knownCount < 80) return 'Quiz mode'
    return 'Mock interview'
  }, [knownCount, reviewCount])

  const announce = useCallback((message: string) => {
    setAnnouncement('')
    window.setTimeout(() => setAnnouncement(message), 20)
  }, [])

  const goToNext = useCallback(() => {
    const ids = filteredQuestions.map((q) => q.id)
    const nextId = pickRandomQuestionId(ids, currentQuestion?.id)
    setCurrentQuestionId(nextId)
    setIsAnswerVisible(false)
  }, [filteredQuestions, currentQuestion?.id])

  const rateCurrentQuestion = useCallback(
    (confidence: Confidence) => {
      if (!currentQuestion) return
      setRatings((prev) => ({ ...prev, [currentQuestion.id]: confidence }))
      setAttemptCount((prev) => prev + 1)
      announce(confidence === 'known' ? 'Marked as known.' : 'Marked as needs review.')
      goToNext()
    },
    [announce, currentQuestion, goToNext],
  )

  const startInterview = useCallback(() => {
    setInterviewQuestionIds(
      pickUniqueQuestionIds(
        QUESTIONS.map((q) => q.id),
        INTERVIEW_QUESTION_COUNT,
      ),
    )
    setInterviewIndex(0)
    setInterviewResults([])
    setIsAnswerVisible(false)
  }, [])

  const interviewQuestion = useMemo(() => {
    const id = interviewQuestionIds[interviewIndex]
    if (!id) return null
    return QUESTIONS.find((q) => q.id === id) ?? null
  }, [interviewQuestionIds, interviewIndex])

  const completeInterviewAnswer = (wasCorrect: boolean) => {
    setInterviewResults((prev) => [...prev, wasCorrect])
    setInterviewIndex((prev) => prev + 1)
    setIsAnswerVisible(false)
    announce(wasCorrect ? 'Marked as correct.' : 'Marked as missed.')
  }

  const isInterviewDone =
    interviewQuestionIds.length > 0 && interviewIndex >= interviewQuestionIds.length
  const interviewCorrectCount = interviewResults.filter(Boolean).length

  const quizQuestion = QUESTIONS.find((q) => q.id === quizQuestionId) ?? null
  const quizOptions = useMemo(() => {
    if (!quizQuestion) return { options: [] as string[], correct: '' }
    return buildMultipleChoiceOptions(quizQuestion, QUESTIONS, 5)
  }, [quizQuestion])

  const nextQuizQuestion = useCallback(() => {
    const ids = QUESTIONS.map((q) => q.id)
    const nextId = pickRandomQuestionId(ids, quizQuestionId ?? undefined)
    setQuizQuestionId(nextId)
    setQuizChoice(null)
    setQuizFeedback(null)
  }, [quizQuestionId])

  const submitQuizAnswer = (option: string) => {
    if (!quizQuestion) return
    setQuizChoice(option)
    setQuizAttemptsTotal((prev) => prev + 1)

    if (option === quizOptions.correct) {
      setQuizFeedback('correct')
      setQuizCorrectTotal((prev) => prev + 1)
      setQuizStreak((prev) => {
        const next = prev + 1
        setQuizBestStreak((best) => (next > best ? next : best))
        return next
      })
      setRatings((prev) => ({ ...prev, [quizQuestion.id]: 'known' }))
      setMissedQuestionIds((prev) => prev.filter((id) => id !== quizQuestion.id))
      announce('Correct answer.')
    } else {
      setQuizFeedback('wrong')
      setQuizStreak(0)
      setRatings((prev) => ({ ...prev, [quizQuestion.id]: 'review' }))
      setMissedQuestionIds((prev) =>
        prev.includes(quizQuestion.id) ? prev : [...prev, quizQuestion.id],
      )
      announce('Incorrect answer added to drill list.')
    }
  }

  const drillQuestions = useMemo(
    () => QUESTIONS.filter((q) => missedQuestionIds.includes(q.id)),
    [missedQuestionIds],
  )
  const drillQuestion = drillQuestions.find((q) => q.id === currentQuestionId) ?? drillQuestions[0]

  const startDrill = () => {
    setMode('drill')
    setCurrentQuestionId(drillQuestions[0]?.id ?? null)
    setIsAnswerVisible(false)
  }

  const goToNextDrill = () => {
    const ids = drillQuestions.map((q) => q.id)
    const nextId = pickRandomQuestionId(ids, drillQuestion?.id)
    setCurrentQuestionId(nextId)
    setIsAnswerVisible(false)
  }

  const clearMissed = () => {
    setMissedQuestionIds([])
    setMode('practice')
    announce('Missed-question list cleared.')
  }

  const resetProgress = () => {
    setRatings({})
    setAttemptCount(0)
    setFilter('all')
    setCurrentQuestionId(getRandomQuestionId())
    setIsAnswerVisible(false)
    setMissedQuestionIds([])
  }

  const exportBackup = () => {
    const data: AppBackup = {
      ratings,
      profile,
      missedQuestionIds,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'us-citizenship-test-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as AppBackup
    if (parsed.ratings) setRatings(parsed.ratings)
    if (parsed.profile) setProfile(parsed.profile)
    if (parsed.missedQuestionIds) setMissedQuestionIds(parsed.missedQuestionIds)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (isTyping) return

      if (event.key === 'p') setMode('practice')
      if (event.key === 'i') setMode('interview')
      if (event.key === 'q') setMode('quiz')
      if (event.key === 'd') setMode('drill')

      if (mode === 'practice' || mode === 'drill') {
        if (event.key === 'r') {
          setIsAnswerVisible((prev) => {
            const next = !prev
            announce(next ? 'Answer revealed.' : 'Answer hidden.')
            return next
          })
        }
        if (event.key === 'n') {
          ;(mode === 'drill' ? goToNextDrill : goToNext)()
          announce('Moved to next question.')
        }
        if (event.key === '1') rateCurrentQuestion('known')
        if (event.key === '2') rateCurrentQuestion('review')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [announce, goToNext, goToNextDrill, mode, rateCurrentQuestion])

  const currentDisplayQuestion = mode === 'drill' ? drillQuestion : currentQuestion

  const handleToggleAnswer = () => {
    setIsAnswerVisible((prev) => {
      const next = !prev
      announce(next ? 'Answer revealed.' : 'Answer hidden.')
      return next
    })
  }

  const handleNextQuestion = () => {
    mode === 'drill' ? goToNextDrill() : goToNext()
    announce('Moved to next question.')
  }

  const applyFederalDefaults = () => {
    setProfile((prev) => ({
      ...prev,
      president: prev.president?.trim() ? prev.president : FEDERAL_OFFICIAL_DEFAULTS.president,
      vicePresident: prev.vicePresident?.trim()
        ? prev.vicePresident
        : FEDERAL_OFFICIAL_DEFAULTS.vicePresident,
      speaker: prev.speaker?.trim() ? prev.speaker : FEDERAL_OFFICIAL_DEFAULTS.speaker,
    }))

    const message = `Filled federal offices (updated ${FEDERAL_OFFICIAL_DEFAULTS.updatedAt}).`
    setZipLookupStatus(message)
    announce(message)
  }

  const handleZipLookup = async () => {
    const normalizedZip = zipCode.trim()

    if (!/^\d{5}$/.test(normalizedZip)) {
      const message = 'Enter a valid 5-digit ZIP code.'
      setZipLookupStatus(message)
      announce(message)
      return
    }

    setIsZipLookupLoading(true)
    setZipLookupStatus('Looking up ZIP code...')

    try {
      const response = await fetch(`https://api.zippopotam.us/us/${normalizedZip}`)
      if (!response.ok) {
        throw new Error('ZIP lookup failed')
      }

      const data = (await response.json()) as {
        places?: Array<{ state?: string; 'state abbreviation'?: string }>
      }

      const place = data.places?.[0]
      const stateAbbr = place?.['state abbreviation']
      const stateName = place?.state

      if (!stateAbbr || !stateName) {
        throw new Error('No location data found')
      }

      const stateInfo = STATE_OFFICIALS_BY_ABBR[stateAbbr]

      setProfile((prev) => ({
        ...prev,
        state: stateInfo?.state ?? stateName,
        stateCapital: stateInfo?.stateCapital ?? prev.stateCapital ?? '',
        governor: stateInfo?.governor ?? prev.governor ?? '',
        senator1: stateInfo?.senators?.[0] ?? prev.senator1 ?? '',
        senator2: stateInfo?.senators?.[1] ?? prev.senator2 ?? '',
        president: prev.president?.trim() ? prev.president : FEDERAL_OFFICIAL_DEFAULTS.president,
        vicePresident: prev.vicePresident?.trim()
          ? prev.vicePresident
          : FEDERAL_OFFICIAL_DEFAULTS.vicePresident,
        speaker: prev.speaker?.trim() ? prev.speaker : FEDERAL_OFFICIAL_DEFAULTS.speaker,
      }))

      const message = stateInfo
        ? `Auto-filled profile for ${stateInfo.state} and federal offices.`
        : `Found ${stateName}; filled federal offices, but no local state profile is available.`

      setZipLookupStatus(message)
      announce(message)
    } catch {
      const message = 'Unable to fetch ZIP details. Try another ZIP or fill fields manually.'
      setZipLookupStatus(message)
      announce(message)
    } finally {
      setIsZipLookupLoading(false)
    }
  }

  const requiredProfileFields: Array<{ key: keyof UserProfile; label: string }> = [
    { key: 'state', label: 'State' },
    { key: 'stateCapital', label: 'State capital' },
    { key: 'governor', label: 'Governor' },
    { key: 'senator1', label: 'Senator 1' },
    { key: 'senator2', label: 'Senator 2' },
    { key: 'representative', label: 'Representative' },
  ]

  const missingRequiredSettings = requiredProfileFields.filter(({ key }) => {
    const value = profile[key]
    return !value || value.trim().length === 0
  })

  const modeGuide: Record<Mode, { title: string; detail: string }> = {
    practice: {
      title: 'Flashcard practice',
      detail: 'Use Reveal → self-check → mark Known or Needs review. Tap buttons or use shortcuts: R, N, 1, 2.',
    },
    interview: {
      title: 'Mock interview',
      detail: 'You will answer 10 random questions. You pass with 6 or more correct answers.',
    },
    quiz: {
      title: 'Multiple-choice quiz',
      detail: 'Pick one answer per question. Misses are added to Drill mode automatically.',
    },
    drill: {
      title: 'Missed-question drill',
      detail: 'Focus only on questions you missed in Quiz mode until they become comfortable.',
    },
    settings: {
      title: 'Personalize + backup',
      detail: 'Set state-specific answers and export/import your progress as JSON.',
    },
  }

  return (
    <main className="app">
      <a href="#content" className="skip-link">
        Skip to content
      </a>

      <header className="app__header">
        <p className="eyebrow">🇺🇸 U.S. Civics Study</p>
        <h1>U.S. Citizenship Test Practice</h1>
        <p className="subtitle">
          Study the official USCIS civics questions with flashcards, mock interview, and quiz
          drills.
        </p>
        <div className="flag-bar" role="presentation" aria-hidden="true" />
      </header>

      <nav className="mode-switch" aria-label="study modes">
        {[
          ['practice', 'Flashcards'],
          ['interview', 'Interview'],
          ['quiz', 'Quiz'],
          ['drill', `Drill (${missedQuestionIds.length})`],
          ['settings', 'Settings'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={mode === value ? 'is-active ghost' : 'ghost'}
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value as Mode)
              announce(`Switched to ${label} mode.`)
              if (value === 'interview' && interviewQuestionIds.length === 0) startInterview()
            }}
          >
            {label}
          </button>
        ))}

        {!isGuideOpen && (
          <button type="button" className="ghost" onClick={() => setIsGuideOpen(true)}>
            Show guide
          </button>
        )}
      </nav>

      <section id="content">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>

        {isGuideOpen && (
          <section className="guide card" aria-label="how to use this mode">
            <div className="guide__top">
              <p className="card__meta">How to use</p>
              <button
                type="button"
                className="ghost icon-button"
                aria-label="Hide guide"
                title="Hide guide"
                onClick={() => setIsGuideOpen(false)}
              >
                ×
              </button>
            </div>
            <h2>{modeGuide[mode].title}</h2>
            <p>{modeGuide[mode].detail}</p>

            {missingRequiredSettings.length > 0 && (
              <div className="guide-warning" role="status" aria-live="polite">
                <p>
                  Before you start, complete required Settings fields:{' '}
                  <strong>
                    {missingRequiredSettings.map((field) => field.label).join(', ')}
                  </strong>
                  .
                </p>
                {mode !== 'settings' && (
                  <button type="button" className="ghost" onClick={() => setMode('settings')}>
                    Go to Settings
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {(mode === 'practice' || mode === 'drill') && (
          <>
            <section className="stats" aria-label="practice stats">
              <div>
                <span className="stats__label">Known</span>
                <strong>{knownCount}</strong>
              </div>
              <div>
                <span className="stats__label">Needs review</span>
                <strong>{reviewCount}</strong>
              </div>
              <div>
                <span className="stats__label">Progress</span>
                <strong>{progress}%</strong>
              </div>
              <div>
                <span className="stats__label">Attempts</span>
                <strong>{attemptCount}</strong>
              </div>
            </section>

            <section className="insights card" aria-label="readiness insights">
              <p className="card__meta">Readiness insights</p>
              <div className="insights-row">
                <span className="stats__label">Unseen questions</span>
                <strong>{unseenCount}</strong>
              </div>
              <div className="insights-row">
                <span className="stats__label">Suggested next mode</span>
                <strong>{suggestedMode}</strong>
              </div>
              {weakCategories.length > 0 && (
                <p className="insights-text">
                  Focus next on{' '}
                  {weakCategories
                    .map((item) => `${item.category} (${item.known}/${item.total})`)
                    .join(', ')}
                </p>
              )}
            </section>

            {mode === 'practice' && (
              <section className="toolbar" aria-label="deck controls">
                <div className="filter-buttons" role="tablist" aria-label="question filters">
                  <button
                    type="button"
                    className={filter === 'all' ? 'is-active ghost' : 'ghost'}
                    onClick={() => setFilter('all')}
                  >
                    All ({QUESTIONS.length})
                  </button>
                  <button
                    type="button"
                    className={filter === 'unrated' ? 'is-active ghost' : 'ghost'}
                    onClick={() => setFilter('unrated')}
                  >
                    Unrated ({QUESTIONS.length - ratedCount})
                  </button>
                  <button
                    type="button"
                    className={filter === 'review' ? 'is-active ghost' : 'ghost'}
                    onClick={() => setFilter('review')}
                  >
                    Review ({reviewCount})
                  </button>
                </div>

                <div className="filter-buttons">
                  <button type="button" className="ghost" onClick={startDrill}>
                    Drill missed ({missedQuestionIds.length})
                  </button>
                  <button type="button" className="ghost" onClick={() => window.print()}>
                    Print study guide
                  </button>
                  <button type="button" className="ghost danger" onClick={resetProgress}>
                    Reset progress
                  </button>
                </div>
              </section>
            )}

            <section className="card question-card" aria-live="polite">
              {currentDisplayQuestion ? (
                <>
                  <p className="card__meta">
                    Q{currentDisplayQuestion.id} • {currentDisplayQuestion.category}
                  </p>
                  <h2>{currentDisplayQuestion.question}</h2>

                  {isAnswerVisible ? (
                    <div className="answer">
                      <p className="answer__title">Accepted answer(s)</p>
                      <ul>
                        {mergeAcceptedAnswers(currentDisplayQuestion, profile).map((answer) => (
                          <li key={answer}>{answer}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="hint">Reveal the answer when you are ready.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="card__meta">No questions in this view</p>
                  <h2>Nice work — nothing left here.</h2>
                </>
              )}
            </section>

            <section className="actions study-actions">
              <button
                type="button"
                onClick={handleToggleAnswer}
                disabled={!currentDisplayQuestion}
              >
                {isAnswerVisible ? 'Hide answer (R)' : 'Reveal answer (R)'}
              </button>
              <button
                type="button"
                onClick={handleNextQuestion}
                className="ghost"
                disabled={!currentDisplayQuestion}
              >
                Next random (N)
              </button>
              {mode === 'drill' && (
                <button type="button" className="ghost danger" onClick={clearMissed}>
                  Clear missed list
                </button>
              )}
            </section>

            <section className="actions study-actions">
              <button
                type="button"
                onClick={() => rateCurrentQuestion('known')}
                disabled={!currentDisplayQuestion}
              >
                I knew this (1)
              </button>
              <button
                type="button"
                onClick={() => rateCurrentQuestion('review')}
                className="warn"
                disabled={!currentDisplayQuestion}
              >
                Needs review (2)
              </button>
            </section>

            <section className="category-grid" aria-label="category progress">
              {categoryStats.map(([category, stats]) => (
                <article key={category} className="category-card">
                  <h3>{category}</h3>
                  <div className="category-stats-inline">
                    <span className="stats__label">Known</span>
                    <strong>{stats.known}/{stats.total}</strong>
                    <span className="stats__label">Review</span>
                    <strong>{stats.review}</strong>
                  </div>
                </article>
              ))}
            </section>

            <section className="mobile-study-bar" aria-label="quick study actions">
              <button type="button" onClick={handleToggleAnswer} disabled={!currentDisplayQuestion}>
                {isAnswerVisible ? 'Hide' : 'Reveal'}
              </button>
              <button type="button" className="ghost" onClick={handleNextQuestion} disabled={!currentDisplayQuestion}>
                Next
              </button>
              <button
                type="button"
                onClick={() => rateCurrentQuestion('known')}
                disabled={!currentDisplayQuestion}
              >
                Known
              </button>
              <button
                type="button"
                className="warn"
                onClick={() => rateCurrentQuestion('review')}
                disabled={!currentDisplayQuestion}
              >
                Review
              </button>
            </section>
          </>
        )}

        {mode === 'interview' && (
          <>
            <section className="stats" aria-label="interview stats">
              <div>
                <span className="stats__label">Question</span>
                <strong>
                  {Math.min(interviewIndex + 1, interviewQuestionIds.length)}/
                  {interviewQuestionIds.length}
                </strong>
              </div>
              <div>
                <span className="stats__label">Correct</span>
                <strong>{interviewCorrectCount}</strong>
              </div>
              <div>
                <span className="stats__label">Needed to pass</span>
                <strong>{INTERVIEW_PASS_MARK}</strong>
              </div>
              <div>
                <span className="stats__label">Status</span>
                <strong>
                  {isInterviewDone
                    ? interviewCorrectCount >= INTERVIEW_PASS_MARK
                      ? 'Pass'
                      : 'Try again'
                    : 'In progress'}
                </strong>
              </div>
            </section>

            <section className="card question-card" aria-live="polite">
              {isInterviewDone ? (
                <>
                  <p className="card__meta">Interview complete</p>
                  <h2>
                    You got {interviewCorrectCount} / {interviewQuestionIds.length}
                  </h2>
                </>
              ) : interviewQuestion ? (
                <>
                  <p className="card__meta">
                    Interview Q{interviewIndex + 1} • {interviewQuestion.category}
                  </p>
                  <h2>{interviewQuestion.question}</h2>
                  {isAnswerVisible ? (
                    <ul>
                      {mergeAcceptedAnswers(interviewQuestion, profile).map((answer) => (
                        <li key={answer}>{answer}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">Say your answer out loud, then reveal and self-score.</p>
                  )}
                </>
              ) : (
                <h2>Start a 10-question mock interview.</h2>
              )}
            </section>

            <section className="actions">
              <button type="button" onClick={() => setIsAnswerVisible((v) => !v)}>
                {isAnswerVisible ? 'Hide answer' : 'Reveal answer'}
              </button>
              <button type="button" className="ghost" onClick={startInterview}>
                Restart interview
              </button>
              <button
                type="button"
                onClick={() => completeInterviewAnswer(true)}
                disabled={!isAnswerVisible || isInterviewDone}
              >
                Correct
              </button>
              <button
                type="button"
                className="warn"
                onClick={() => completeInterviewAnswer(false)}
                disabled={!isAnswerVisible || isInterviewDone}
              >
                Missed
              </button>
            </section>
          </>
        )}

        {mode === 'quiz' && (
          <>
            <section className="stats" aria-label="quiz stats">
              <div>
                <span className="stats__label">Streak</span>
                <strong>{quizStreak}</strong>
              </div>
              <div>
                <span className="stats__label">Best streak</span>
                <strong>{quizBestStreak}</strong>
              </div>
              <div>
                <span className="stats__label">Accuracy</span>
                <strong>
                  {quizAttemptsTotal === 0
                    ? '0%'
                    : `${Math.round((quizCorrectTotal / quizAttemptsTotal) * 100)}%`}
                </strong>
              </div>
              <div>
                <span className="stats__label">Timer</span>
                <strong>{elapsedSeconds}s</strong>
              </div>
            </section>

            <section className="card question-card" aria-live="polite">
              {quizQuestion ? (
                <>
                  <p className="card__meta">
                    Quiz • Q{quizQuestion.id} • {quizQuestion.category}
                  </p>
                  <h2>{quizQuestion.question}</h2>
                  <div className="choices">
                    {quizOptions.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="ghost"
                        onClick={() => submitQuizAnswer(option)}
                        disabled={Boolean(quizChoice)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {quizFeedback && (
                    <p className={quizFeedback === 'correct' ? 'ok' : 'bad'} aria-live="polite">
                      {quizFeedback === 'correct'
                        ? '✅ Correct'
                        : `❌ Not quite. Accepted: ${quizOptions.correct}`}
                    </p>
                  )}
                </>
              ) : (
                <h2>Quiz unavailable</h2>
              )}
            </section>

            <section className="actions">
              <button type="button" onClick={nextQuizQuestion}>
                Next quiz question
              </button>
              <button type="button" className="ghost" onClick={startDrill}>
                Practice missed ({missedQuestionIds.length})
              </button>
            </section>
          </>
        )}

        {mode === 'settings' && (
          <>
            <section className="card">
              <p className="card__meta">State-specific answers</p>
              <h2>Your reference profile</h2>

              <div className="zip-lookup" role="group" aria-label="ZIP code auto-fill">
                <label htmlFor="zip-input">
                  <span>ZIP code</span>
                  <input
                    id="zip-input"
                    inputMode="numeric"
                    pattern="[0-9]{5}"
                    maxLength={5}
                    placeholder="e.g. 94110"
                    value={zipCode}
                    onChange={(event) => setZipCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
                  />
                </label>
                <div className="zip-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={handleZipLookup}
                    disabled={isZipLookupLoading}
                  >
                    {isZipLookupLoading ? 'Loading…' : 'Auto-fill from ZIP'}
                  </button>
                  <button type="button" className="ghost" onClick={applyFederalDefaults}>
                    Fill federal offices
                  </button>
                </div>
                {zipLookupStatus && (
                  <p className="zip-status" aria-live="polite">
                    {zipLookupStatus}
                  </p>
                )}
              </div>

              <div className="profile-grid">
                {[
                  ['state', 'State'],
                  ['stateCapital', 'State capital'],
                  ['governor', 'Governor'],
                  ['senator1', 'Senator 1'],
                  ['senator2', 'Senator 2'],
                  ['representative', 'Representative'],
                  ['president', 'President'],
                  ['vicePresident', 'Vice President'],
                  ['speaker', 'Speaker of the House'],
                ].map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      value={(profile[key as keyof UserProfile] as string) ?? ''}
                      onChange={(event) =>
                        setProfile((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }))
                      }
                    />
                    {key === 'representative' && (
                      <small className="field-help">
                        Find your representative at{' '}
                        <a
                          href="https://www.house.gov/representatives/find-your-representative"
                          target="_blank"
                          rel="noreferrer"
                        >
                          house.gov
                        </a>
                        .
                      </small>
                    )}
                  </label>
                ))}
              </div>
            </section>

            <section className="card">
              <p className="card__meta">Backup & restore</p>
              <h2>Export or import your progress</h2>
              <section className="actions">
                <button type="button" onClick={exportBackup}>
                  Export JSON backup
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import JSON backup
                </button>
                <input
                  ref={fileInputRef}
                  hidden
                  type="file"
                  accept="application/json"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (file) await importBackup(file)
                    event.currentTarget.value = ''
                  }}
                />
              </section>
            </section>
          </>
        )}
      </section>

      <footer className="app-footer" aria-label="site footer">
        <p>
          © 2026 Bartosz Bentkowski (vforge). This project is free and open source. I did my best
          to source the civics data, but it may contain mistakes. Corrections are welcome via
          <a href="https://github.com/vforge/us-citizenship-test" target="_blank" rel="noreferrer">
            {' '}GitHub
          </a>
          . Always verify with official USCIS resources:
          <a href="https://www.uscis.gov/citizenship/find-study-materials-and-resources" target="_blank" rel="noreferrer">
            {' '}USCIS study materials
          </a>
          .
        </p>
      </footer>

      <section className="print-sheet" aria-hidden="true">
        <h2>US Citizenship Study Sheet</h2>
        <ol>
          {QUESTIONS.map((q) => (
            <li key={q.id}>
              <p>
                <strong>{q.question}</strong>
              </p>
              <p>{mergeAcceptedAnswers(q, profile).join(' • ')}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

export default App
