"use client"

import { useState, useMemo } from "react"
import {
  RotateCcw,
  ThumbsDown,
  Minus,
  ThumbsUp,
  Trophy,
  BrainCircuit,
  Filter,
  Clock,
  ClipboardCheck,
  PenLine,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { isDueForReview, calculateNextReview, type Confidence } from "@/lib/spacedRepetition"
import { cn } from "@/lib/utils"

interface Flashcard {
  id: string
  front: string
  back: string
  lecture_id: string
  lectures: {
    id: string
    title: string
    subject_id: string
    subjects: {
      id: string
      name: string
      module_id: string
      modules: { id: string; name: string }
    }
  }
}

interface MCQ {
  id: string
  question: string
  options: string[]
  correct_answer: number
  explanation: string
  lecture_id: string
  lectures: {
    id: string
    title: string
    subject_id: string
    subjects: {
      id: string
      name: string
      module_id: string
      modules: { id: string; name: string }
    }
  }
}

interface WrittenQuestion {
  id: string
  question: string
  model_answer: string
  lecture_id: string
  lectures: {
    id: string
    title: string
    subject_id: string
    subjects: {
      id: string
      name: string
      module_id: string
      modules: { id: string; name: string }
    }
  }
}

interface Module {
  id: string
  name: string
  subjects: {
    id: string
    name: string
    lectures: { id: string; title: string }[]
  }[]
}

interface ExerciseContentProps {
  flashcards: Flashcard[]
  mcqs: MCQ[]
  writtenQuestions: WrittenQuestion[]
  progressMap: Record<string, {
    ease_factor: number
    interval_days: number
    repetitions: number
    next_review_at: string
  }>
  mcqResults: Record<string, boolean>
  writtenResults: Record<string, number>
  modules: Module[]
  userId: string
}

const SCORE_LABELS = [
  { value: 1, label: "Poor", color: "border-destructive/50 text-destructive hover:bg-destructive/10" },
  { value: 2, label: "Weak", color: "border-orange-500/50 text-orange-600 hover:bg-orange-500/10" },
  { value: 3, label: "Average", color: "border-muted-foreground/50 text-muted-foreground hover:bg-muted" },
  { value: 4, label: "Good", color: "border-primary/50 text-primary hover:bg-primary/10" },
  { value: 5, label: "Excellent", color: "border-primary text-primary hover:bg-primary/10" },
]

export function ExerciseContent({
  flashcards,
  mcqs,
  writtenQuestions,
  progressMap,
  mcqResults: initialMcqResults,
  writtenResults: initialWrittenResults,
  modules,
  userId,
}: ExerciseContentProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exercises</h1>
        <p className="text-muted-foreground">
          Practice MCQs, written questions, and flashcards across all your modules.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Flashcards</p>
              <p className="text-2xl font-bold">{flashcards.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MCQs</p>
              <p className="text-2xl font-bold">{mcqs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <PenLine className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Written</p>
              <p className="text-2xl font-bold">{writtenQuestions.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="flashcards" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="mcqs">MCQs</TabsTrigger>
          <TabsTrigger value="written">Written</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="flashcards">
            <FlashcardsExercise
              flashcards={flashcards}
              progressMap={progressMap}
              modules={modules}
              userId={userId}
            />
          </TabsContent>
          <TabsContent value="mcqs">
            <McqExercise
              mcqs={mcqs}
              initialResults={initialMcqResults}
              modules={modules}
              userId={userId}
            />
          </TabsContent>
          <TabsContent value="written">
            <WrittenExercise
              writtenQuestions={writtenQuestions}
              initialResults={initialWrittenResults}
              modules={modules}
              userId={userId}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// ============================================================
// FLASHCARDS EXERCISE (same cycling logic as lecture tab)
// ============================================================
function FlashcardsExercise({
  flashcards,
  progressMap,
  modules,
  userId,
}: {
  flashcards: Flashcard[]
  progressMap: ExerciseContentProps["progressMap"]
  modules: Module[]
  userId: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [ratings, setRatings] = useState<Record<string, "hard" | "okay" | "easy">>({})
  const [localProgress, setLocalProgress] = useState(progressMap)
  const [filterModule, setFilterModule] = useState("all")
  const [filterLecture, setFilterLecture] = useState("all")
  const [round, setRound] = useState(1)
  const [showingEasy, setShowingEasy] = useState(false)

  const availableLectures = useMemo(() => {
    if (filterModule === "all") return []
    const mod = modules.find((m) => m.id === filterModule)
    return mod?.subjects.flatMap((s) => s.lectures) ?? []
  }, [filterModule, modules])

  const baseCards = useMemo(() => {
    let cards = flashcards
    if (filterModule !== "all") cards = cards.filter((c) => c.lectures?.subjects?.modules?.id === filterModule)
    if (filterLecture !== "all") cards = cards.filter((c) => c.lecture_id === filterLecture)
    return cards
  }, [flashcards, filterModule, filterLecture])

  const currentQueue = useMemo(() => {
    if (Object.keys(ratings).length === 0) return baseCards
    if (showingEasy) return baseCards.filter((c) => ratings[c.id] === "easy")
    const hard = baseCards.filter((c) => ratings[c.id] === "hard")
    if (hard.length > 0) return hard
    const okay = baseCards.filter((c) => ratings[c.id] === "okay")
    if (okay.length > 0) return okay
    return []
  }, [baseCards, ratings, showingEasy])

  const hardCount = baseCards.filter((c) => ratings[c.id] === "hard").length
  const okayCount = baseCards.filter((c) => ratings[c.id] === "okay").length
  const easyCount = baseCards.filter((c) => ratings[c.id] === "easy").length
  const allRated = baseCards.length > 0 && baseCards.every((c) => ratings[c.id])
  const allEasy = allRated && hardCount === 0 && okayCount === 0

  const card = currentQueue[currentIndex]

  const handleConfidence = async (confidence: Confidence) => {
    if (!card) return
    const supabase = createClient()
    const result = calculateNextReview(confidence, localProgress[card.id])

    await supabase.from("flashcard_progress").upsert({
      user_id: userId,
      flashcard_id: card.id,
      ease_factor: result.ease_factor,
      interval_days: result.interval_days,
      repetitions: result.repetitions,
      next_review_at: result.next_review_at,
      last_reviewed_at: new Date().toISOString(),
    }, { onConflict: "user_id,flashcard_id" })

    setLocalProgress((prev) => ({ ...prev, [card.id]: result }))
    const ratingMap: Record<Confidence, "hard" | "okay" | "easy"> = { hard: "hard", medium: "okay", easy: "easy" }
    setRatings((prev) => ({ ...prev, [card.id]: ratingMap[confidence] }))
    setIsFlipped(false)
    if (currentIndex < currentQueue.length - 1) setCurrentIndex(currentIndex + 1)
    else { setCurrentIndex(0); setRound((r) => r + 1) }
  }

  const resetFilters = () => {
    setRatings({})
    setCurrentIndex(0)
    setIsFlipped(false)
    setRound(1)
    setShowingEasy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setFilterLecture("all"); resetFilters() }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Modules" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterLecture} onValueChange={(v) => { setFilterLecture(v); resetFilters() }} disabled={filterModule === "all"}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Lectures" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lectures</SelectItem>
            {availableLectures.map((l) => (<SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">Round {round}</Badge>
        {hardCount > 0 && <Badge variant="destructive" className="text-xs">{hardCount} Hard</Badge>}
        {okayCount > 0 && <Badge variant="secondary" className="text-xs">{okayCount} Okay</Badge>}
        {easyCount > 0 && <Badge className="bg-primary/10 text-primary text-xs hover:bg-primary/10">{easyCount} Easy</Badge>}
      </div>

      {baseCards.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-sm text-muted-foreground">No flashcards match your filters.</p></CardContent></Card>
      ) : allEasy && !showingEasy ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Trophy className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-bold">All cards mastered!</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowingEasy(true); setCurrentIndex(0) }}>Review Easy</Button>
              <Button onClick={resetFilters}><RotateCcw className="mr-2 h-4 w-4" />Start Over</Button>
            </div>
          </CardContent>
        </Card>
      ) : currentQueue.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Trophy className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-bold">All mastered!</h3>
            <Button onClick={resetFilters}><RotateCcw className="mr-2 h-4 w-4" />Start Over</Button>
          </CardContent>
        </Card>
      ) : card ? (
        <>
          <Progress value={(easyCount / baseCards.length) * 100} className="h-2" />
          {card.lectures && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{card.lectures.subjects?.modules?.name}</Badge>
              <span className="text-xs text-muted-foreground">{card.lectures.title}</span>
            </div>
          )}
          <button onClick={() => setIsFlipped(!isFlipped)} className="w-full text-left">
            <Card className="min-h-[280px] cursor-pointer transition-all hover:border-primary/30">
              <CardContent className="flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {isFlipped ? "Answer" : "Question"} - Card {currentIndex + 1} of {currentQueue.length}
                </p>
                <p className="text-lg leading-relaxed">{isFlipped ? card.back : card.front}</p>
                {!isFlipped && <p className="mt-6 text-xs text-muted-foreground">Click to reveal answer</p>}
              </CardContent>
            </Card>
          </button>
          {isFlipped && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => handleConfidence("hard")} className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"><ThumbsDown className="h-4 w-4" />Hard</Button>
              <Button variant="outline" onClick={() => handleConfidence("medium")} className="gap-2"><Minus className="h-4 w-4" />Okay</Button>
              <Button variant="outline" onClick={() => handleConfidence("easy")} className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"><ThumbsUp className="h-4 w-4" />Easy</Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

// ============================================================
// MCQ EXERCISE (with module/lecture filter + status filters)
// ============================================================
function McqExercise({
  mcqs,
  initialResults,
  modules,
  userId,
}: {
  mcqs: MCQ[]
  initialResults: Record<string, boolean>
  modules: Module[]
  userId: string
}) {
  const [filterModule, setFilterModule] = useState("all")
  const [filterLecture, setFilterLecture] = useState("all")
  const [filterStatus, setFilterStatus] = useState<"all" | "new" | "correct" | "wrong">("all")
  const [results, setResults] = useState(initialResults)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [finished, setFinished] = useState(false)
  const [reattemptMode, setReattemptMode] = useState<"all" | "wrong" | null>(null)

  const availableLectures = useMemo(() => {
    if (filterModule === "all") return []
    const mod = modules.find((m) => m.id === filterModule)
    return mod?.subjects.flatMap((s) => s.lectures) ?? []
  }, [filterModule, modules])

  const filteredMcqs = useMemo(() => {
    let pool = mcqs
    if (filterModule !== "all") pool = pool.filter((q) => q.lectures?.subjects?.modules?.id === filterModule)
    if (filterLecture !== "all") pool = pool.filter((q) => q.lecture_id === filterLecture)
    if (reattemptMode === "wrong") return pool.filter((q) => results[q.id] === false)
    if (reattemptMode === "all") return pool
    if (filterStatus === "new") return pool.filter((q) => results[q.id] === undefined)
    if (filterStatus === "correct") return pool.filter((q) => results[q.id] === true)
    if (filterStatus === "wrong") return pool.filter((q) => results[q.id] === false)
    return pool
  }, [mcqs, filterModule, filterLecture, filterStatus, results, reattemptMode])

  const baseMcqs = useMemo(() => {
    let pool = mcqs
    if (filterModule !== "all") pool = pool.filter((q) => q.lectures?.subjects?.modules?.id === filterModule)
    if (filterLecture !== "all") pool = pool.filter((q) => q.lecture_id === filterLecture)
    return pool
  }, [mcqs, filterModule, filterLecture])

  const newCount = baseMcqs.filter((q) => results[q.id] === undefined).length
  const correctCount = baseMcqs.filter((q) => results[q.id] === true).length
  const wrongCount = baseMcqs.filter((q) => results[q.id] === false).length

  const mcq = filteredMcqs[currentIndex]

  const handleAnswer = async (answerIndex: number) => {
    if (showResult || !mcq) return
    setSelectedAnswer(answerIndex)
    setShowResult(true)
    const isCorrect = answerIndex === mcq.correct_answer
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    setResults((prev) => ({ ...prev, [mcq.id]: isCorrect }))
    const supabase = createClient()
    await supabase.from("mcq_attempts").insert({ user_id: userId, mcq_id: mcq.id, selected_answer: answerIndex, is_correct: isCorrect })
  }

  const nextQuestion = () => {
    if (currentIndex < filteredMcqs.length - 1) { setCurrentIndex(currentIndex + 1); setSelectedAnswer(null); setShowResult(false) }
    else setFinished(true)
  }

  const changeFilter = (status: typeof filterStatus) => {
    setFilterStatus(status); setCurrentIndex(0); setSelectedAnswer(null); setShowResult(false); setScore({ correct: 0, total: 0 }); setFinished(false); setReattemptMode(null)
  }

  if (finished) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    const allAttempted = newCount === 0
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className={cn("flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold", pct >= 70 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>{pct}%</div>
          <h3 className="text-xl font-bold">Complete!</h3>
          <p className="text-muted-foreground">{score.correct} out of {score.total} correct.</p>
          {allAttempted && wrongCount > 0 && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => { setReattemptMode("wrong"); setCurrentIndex(0); setSelectedAnswer(null); setShowResult(false); setScore({ correct: 0, total: 0 }); setFinished(false) }} variant="outline" className="gap-2"><XCircle className="h-4 w-4 text-destructive" />Reattempt Wrong ({wrongCount})</Button>
              <Button onClick={() => { setReattemptMode("all"); setResults({}); setCurrentIndex(0); setSelectedAnswer(null); setShowResult(false); setScore({ correct: 0, total: 0 }); setFinished(false) }} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" />Reattempt All</Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setFilterLecture("all"); changeFilter("all") }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Modules" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterLecture} onValueChange={(v) => { setFilterLecture(v); changeFilter("all") }} disabled={filterModule === "all"}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Lectures" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lectures</SelectItem>
            {availableLectures.map((l) => (<SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "new", "correct", "wrong"] as const).map((s) => (
          <Button key={s} variant={filterStatus === s && !reattemptMode ? "default" : "outline"} size="sm" onClick={() => changeFilter(s)} className="h-7 text-xs">
            {s === "all" ? `All (${baseMcqs.length})` : s === "new" ? `New (${newCount})` : s === "correct" ? `Correct (${correctCount})` : `Wrong (${wrongCount})`}
          </Button>
        ))}
      </div>
      {filteredMcqs.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No questions match filters.</p></CardContent></Card>
      ) : mcq && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Question {currentIndex + 1} of {filteredMcqs.length}</span>
            <span className="text-sm text-muted-foreground">Score: {score.correct}/{score.total}</span>
          </div>
          {mcq.lectures && <Badge variant="outline" className="self-start text-xs">{mcq.lectures.subjects?.modules?.name} - {mcq.lectures.title}</Badge>}
          <Card>
            <CardHeader><CardTitle className="text-base font-medium leading-relaxed">{mcq.question}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(typeof mcq.options === "string" ? JSON.parse(mcq.options) : mcq.options).map((option: string, idx: number) => {
                const isSelected = selectedAnswer === idx; const isCorrect = idx === mcq.correct_answer
                return (
                  <button key={idx} onClick={() => handleAnswer(idx)} disabled={showResult} className={cn("flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors", !showResult && "hover:bg-accent", showResult && isCorrect && "border-primary bg-primary/5", showResult && isSelected && !isCorrect && "border-destructive bg-destructive/5")}>
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium", showResult && isCorrect && "border-primary bg-primary text-primary-foreground", showResult && isSelected && !isCorrect && "border-destructive bg-destructive text-destructive-foreground", !showResult && "border-muted-foreground/30")}>
                      {showResult && isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : showResult && isSelected ? <XCircle className="h-3.5 w-3.5" /> : String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </button>
                )
              })}
              {showResult && mcq.explanation && (
                <div className="mt-3 rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs font-medium text-primary">Explanation</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{mcq.explanation}</p>
                </div>
              )}
              {showResult && <Button onClick={nextQuestion} className="mt-2 self-end">{currentIndex < filteredMcqs.length - 1 ? "Next Question" : "See Results"}</Button>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ============================================================
// WRITTEN EXERCISE (with multi-select status filters)
// ============================================================
function WrittenExercise({
  writtenQuestions,
  initialResults,
  modules,
  userId,
}: {
  writtenQuestions: WrittenQuestion[]
  initialResults: Record<string, number>
  modules: Module[]
  userId: string
}) {
  const [filterModule, setFilterModule] = useState("all")
  const [filterLecture, setFilterLecture] = useState("all")
  type WStatus = "new" | "poor" | "weak" | "average" | "good" | "excellent"
  const [activeFilters, setActiveFilters] = useState<Set<WStatus>>(new Set(["new", "poor", "weak", "average", "good", "excellent"]))
  const [scores, setScores] = useState(initialResults)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [showModelAnswer, setShowModelAnswer] = useState(false)
  const [selfScore, setSelfScore] = useState<number | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const availableLectures = useMemo(() => {
    if (filterModule === "all") return []
    return modules.find((m) => m.id === filterModule)?.subjects.flatMap((s) => s.lectures) ?? []
  }, [filterModule, modules])

  const getStatus = (qId: string): WStatus => {
    const s = scores[qId]; if (s === undefined) return "new"; if (s <= 1) return "poor"; if (s <= 2) return "weak"; if (s <= 3) return "average"; if (s <= 4) return "good"; return "excellent"
  }

  const filteredQuestions = useMemo(() => {
    let pool = writtenQuestions
    if (filterModule !== "all") pool = pool.filter((q) => q.lectures?.subjects?.modules?.id === filterModule)
    if (filterLecture !== "all") pool = pool.filter((q) => q.lecture_id === filterLecture)
    return pool.filter((q) => activeFilters.has(getStatus(q.id)))
  }, [writtenQuestions, filterModule, filterLecture, activeFilters, scores])

  const question = filteredQuestions[currentIndex]

  const toggleFilter = (status: WStatus) => {
    const f = new Set(activeFilters); if (f.has(status)) f.delete(status); else f.add(status); setActiveFilters(f); setCurrentIndex(0); resetState()
  }

  const resetState = () => { setUserAnswer(""); setSubmitted(false); setShowModelAnswer(false); setSelfScore(null) }

  const handleSubmit = () => { if (!userAnswer.trim()) return; setSubmitted(true); setShowModelAnswer(true) }

  const handleSelfScore = async (score: number) => {
    if (!question || !userId) return; setSelfScore(score); setSaving(true)
    const supabase = createClient()
    await supabase.from("written_attempts").insert({ user_id: userId, written_question_id: question.id, user_answer: userAnswer, self_score: score })
    setScores((prev) => ({ ...prev, [question.id]: score }))
    setCompleted(new Set([...completed, question.id])); setSaving(false)
  }

  if (filteredQuestions.length > 0 && completed.size >= filteredQuestions.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          <h3 className="text-xl font-bold">All questions answered!</h3>
          <Button onClick={() => { setCompleted(new Set()); setCurrentIndex(0); resetState() }}><RotateCcw className="mr-2 h-4 w-4" />Start Over</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setFilterLecture("all"); setCurrentIndex(0); resetState() }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Modules" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterLecture} onValueChange={(v) => { setFilterLecture(v); setCurrentIndex(0); resetState() }} disabled={filterModule === "all"}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Lectures" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lectures</SelectItem>
            {availableLectures.map((l) => (<SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["new", "poor", "weak", "average", "good", "excellent"] as WStatus[]).map((s) => (
          <Button key={s} variant={activeFilters.has(s) ? "default" : "outline"} size="sm" onClick={() => toggleFilter(s)} className="h-7 text-xs capitalize">{s}</Button>
        ))}
      </div>
      {filteredQuestions.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No questions match filters.</p></CardContent></Card>
      ) : question && (
        <>
          <Progress value={filteredQuestions.length > 0 ? (completed.size / filteredQuestions.length) * 100 : 0} className="h-2" />
          {question.lectures && <Badge variant="outline" className="self-start text-xs">{question.lectures.subjects?.modules?.name} - {question.lectures.title}</Badge>}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><PenLine className="h-4 w-4 text-primary" />Question {currentIndex + 1} of {filteredQuestions.length}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm font-medium leading-relaxed">{question.question}</p>
              <Textarea placeholder="Write your answer here..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} className="min-h-[150px] resize-y" disabled={submitted} />
              {!submitted && <Button onClick={handleSubmit} disabled={!userAnswer.trim()} className="self-end gap-2"><Send className="h-4 w-4" />Submit</Button>}
              {submitted && (
                <div className="flex flex-col gap-4">
                  <Button variant="outline" onClick={() => setShowModelAnswer(!showModelAnswer)} className="gap-2 self-start">
                    {showModelAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showModelAnswer ? "Hide" : "Show"} Model Answer
                  </Button>
                  {showModelAnswer && (
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="mb-2 text-xs font-medium text-primary">Model Answer</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{question.model_answer}</p>
                    </div>
                  )}
                  {!selfScore && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Rate your answer:</p>
                      <div className="flex flex-wrap gap-2">
                        {SCORE_LABELS.map((s) => (
                          <Button key={s.value} variant="outline" size="sm" onClick={() => handleSelfScore(s.value)} disabled={saving} className={cn("gap-1.5", s.color)}>{s.value} - {s.label}</Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selfScore && <div className="rounded-lg border bg-primary/5 p-3"><p className="text-sm font-medium text-primary">Self-evaluation: {selfScore}/5 - {SCORE_LABELS.find((s) => s.value === selfScore)?.label}</p></div>}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); resetState() }} disabled={currentIndex === 0}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
            <Button variant="ghost" size="sm" onClick={() => { setCurrentIndex(Math.min(filteredQuestions.length - 1, currentIndex + 1)); resetState() }} disabled={currentIndex === filteredQuestions.length - 1}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </>
      )}
    </div>
  )
}
