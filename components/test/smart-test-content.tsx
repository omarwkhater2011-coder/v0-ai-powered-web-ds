"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ClipboardCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Trophy,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface MCQ {
  id: string
  question: string
  options: string[]
  correct_answer: number
  explanation: string
  lecture_id: string
  lectures: { id: string; title: string; subject_id: string }
}

interface Flashcard {
  id: string
  front: string
  back: string
  lecture_id: string
  lectures: { id: string; title: string; subject_id: string }
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

interface TestSession {
  id: string
  title: string
  test_type: string
  total_questions: number
  correct_answers: number
  score: number
  duration_seconds: number
  completed_at: string | null
  created_at: string
}

interface TestQuestion {
  type: "mcq"
  mcq: MCQ
  userAnswer: number | null
  isCorrect: boolean | null
}

interface SmartTestContentProps {
  modules: Module[]
  mcqs: MCQ[]
  flashcards: Flashcard[]
  testHistory: TestSession[]
  weakTopics: { id: string; topic: string; accuracy: number; lecture_id: string | null }[]
  userId: string
}

export function SmartTestContent({
  modules,
  mcqs,
  flashcards,
  testHistory,
  weakTopics,
  userId,
}: SmartTestContentProps) {
  const [mode, setMode] = useState<"setup" | "test" | "results">("setup")
  const [questionCount, setQuestionCount] = useState("10")
  const [filterModule, setFilterModule] = useState("all")
  const [testType, setTestType] = useState("mixed")

  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [startTime, setStartTime] = useState<number>(0)
  const [elapsed, setElapsed] = useState(0)

  // Timer
  useEffect(() => {
    if (mode !== "test") return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [mode, startTime])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const startTest = () => {
    let pool = mcqs

    if (filterModule !== "all") {
      const subjectIds = modules
        .find((m) => m.id === filterModule)
        ?.subjects.map((s) => s.id) ?? []
      pool = pool.filter((q) => subjectIds.includes(q.lectures?.subject_id))
    }

    // Shuffle and pick
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const count = Math.min(parseInt(questionCount), shuffled.length)
    const selected = shuffled.slice(0, count)

    const testQuestions: TestQuestion[] = selected.map((mcq) => ({
      type: "mcq",
      mcq,
      userAnswer: null,
      isCorrect: null,
    }))

    setQuestions(testQuestions)
    setCurrentIdx(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setStartTime(Date.now())
    setElapsed(0)
    setMode("test")
  }

  const handleAnswer = (answerIdx: number) => {
    if (showResult) return
    const q = questions[currentIdx]
    const options: string[] =
      typeof q.mcq.options === "string"
        ? JSON.parse(q.mcq.options)
        : q.mcq.options
    const isCorrect = answerIdx === q.mcq.correct_answer

    setSelectedAnswer(answerIdx)
    setShowResult(true)
    setQuestions((prev) =>
      prev.map((qq, i) =>
        i === currentIdx ? { ...qq, userAnswer: answerIdx, isCorrect } : qq
      )
    )
  }

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    } else {
      finishTest()
    }
  }

  const finishTest = useCallback(async () => {
    setMode("results")
    const correct = questions.filter((q) => q.isCorrect).length
    const total = questions.length
    const score = total > 0 ? (correct / total) * 100 : 0

    const supabase = createClient()
    await supabase.from("test_sessions").insert({
      user_id: userId,
      title: `Smart Test - ${new Date().toLocaleDateString()}`,
      test_type: testType,
      total_questions: total,
      correct_answers: correct,
      score,
      duration_seconds: elapsed,
      completed_at: new Date().toISOString(),
    })
  }, [questions, elapsed, testType, userId])

  const currentQ = questions[currentIdx]
  const score = questions.filter((q) => q.isCorrect).length
  const answered = questions.filter((q) => q.userAnswer !== null).length

  // Setup screen
  if (mode === "setup") {
    const avgScore =
      testHistory.length > 0
        ? Math.round(testHistory.reduce((a, t) => a + t.score, 0) / testHistory.length)
        : 0

    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Test</h1>
          <p className="text-muted-foreground">
            Generate adaptive tests from your study material.
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tests Taken</p>
                <p className="text-2xl font-bold">{testHistory.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{avgScore}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available MCQs</p>
                <p className="text-2xl font-bold">{mcqs.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Configure Your Test
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Module</label>
                <Select value={filterModule} onValueChange={setFilterModule}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Questions</label>
                <Select value={questionCount} onValueChange={setQuestionCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Questions</SelectItem>
                    <SelectItem value="10">10 Questions</SelectItem>
                    <SelectItem value="20">20 Questions</SelectItem>
                    <SelectItem value="50">All Available</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={startTest} className="self-start gap-2" disabled={mcqs.length === 0}>
              <Play className="h-4 w-4" />
              Start Test
            </Button>
          </CardContent>
        </Card>

        {/* Recent Tests */}
        {testHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Recent Test History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {testHistory.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{t.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString()} &middot;{" "}
                        {t.total_questions} questions &middot;{" "}
                        {formatTime(t.duration_seconds)}
                      </span>
                    </div>
                    <Badge
                      variant={t.score >= 70 ? "default" : "destructive"}
                      className="font-mono"
                    >
                      {Math.round(t.score)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Results screen
  if (mode === "results") {
    const totalQ = questions.length
    const correctQ = questions.filter((q) => q.isCorrect).length
    const pct = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0

    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Results</h1>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-12">
            <div
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold",
                pct >= 70
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {pct}%
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">
                {pct >= 90
                  ? "Excellent!"
                  : pct >= 70
                    ? "Good job!"
                    : pct >= 50
                      ? "Keep practicing"
                      : "Needs work"}
              </h2>
              <p className="text-muted-foreground">
                {correctQ} correct out of {totalQ} questions in {formatTime(elapsed)}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setMode("setup")}>
                <RotateCcw className="mr-2 h-4 w-4" />
                New Test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Question review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Question Review
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {questions.map((q, idx) => {
              const opts: string[] =
                typeof q.mcq.options === "string"
                  ? JSON.parse(q.mcq.options)
                  : q.mcq.options
              return (
                <div
                  key={idx}
                  className={cn(
                    "rounded-lg border p-4",
                    q.isCorrect ? "border-primary/20" : "border-destructive/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {q.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">{q.mcq.question}</p>
                      <p className="text-xs text-muted-foreground">
                        Your answer: {opts[q.userAnswer ?? 0]}
                        {!q.isCorrect && (
                          <> &middot; Correct: {opts[q.mcq.correct_answer]}</>
                        )}
                      </p>
                      {q.mcq.explanation && !q.isCorrect && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {q.mcq.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Test in progress
  const options: string[] = currentQ
    ? typeof currentQ.mcq.options === "string"
      ? JSON.parse(currentQ.mcq.options)
      : currentQ.mcq.options
    : []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            {currentIdx + 1}/{questions.length}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Score: {score}/{answered}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {formatTime(elapsed)}
        </div>
      </div>

      <Progress
        value={((currentIdx + (showResult ? 1 : 0)) / questions.length) * 100}
        className="h-2"
      />

      {/* Question card */}
      {currentQ && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium leading-relaxed">
              {currentQ.mcq.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {options.map((option: string, idx: number) => {
              const isSelected = selectedAnswer === idx
              const isCorrect = idx === currentQ.mcq.correct_answer

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={showResult}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                    !showResult && "hover:bg-accent",
                    showResult && isCorrect && "border-primary bg-primary/5",
                    showResult &&
                      isSelected &&
                      !isCorrect &&
                      "border-destructive bg-destructive/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                      showResult &&
                        isCorrect &&
                        "border-primary bg-primary text-primary-foreground",
                      showResult &&
                        isSelected &&
                        !isCorrect &&
                        "border-destructive bg-destructive text-destructive-foreground",
                      !showResult && "border-muted-foreground/30"
                    )}
                  >
                    {showResult && isCorrect ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : showResult && isSelected ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      String.fromCharCode(65 + idx)
                    )}
                  </span>
                  <span>{option}</span>
                </button>
              )
            })}

            {showResult && currentQ.mcq.explanation && (
              <div className="mt-3 rounded-lg border bg-muted/50 p-3">
                <p className="text-xs font-medium text-primary">Explanation</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {currentQ.mcq.explanation}
                </p>
              </div>
            )}

            {showResult && (
              <Button onClick={nextQuestion} className="mt-2 self-end">
                {currentIdx < questions.length - 1
                  ? "Next Question"
                  : "See Results"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
