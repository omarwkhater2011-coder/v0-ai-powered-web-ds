"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
  PenLine,
  Eye,
  EyeOff,
  Send,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
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

interface WrittenQuestion {
  id: string
  question: string
  model_answer: string
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

type TestQuestion =
  | { type: "mcq"; mcq: MCQ; userAnswer: number | null; isCorrect: boolean | null }
  | { type: "written"; written: WrittenQuestion; userAnswer: string; selfScore: number | null; showModel: boolean }

interface SmartTestContentProps {
  modules: Module[]
  mcqs: MCQ[]
  writtenQuestions: WrittenQuestion[]
  testHistory: TestSession[]
  weakTopics: { id: string; topic: string; accuracy: number; lecture_id: string | null }[]
  userId: string
}

const SCORE_LABELS = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Weak" },
  { value: 3, label: "Average" },
  { value: 4, label: "Good" },
  { value: 5, label: "Excellent" },
]

export function SmartTestContent({
  modules,
  mcqs,
  writtenQuestions,
  testHistory,
  weakTopics,
  userId,
}: SmartTestContentProps) {
  const [mode, setMode] = useState<"setup" | "test" | "results">("setup")

  // Config
  const [filterModule, setFilterModule] = useState("all")
  const [filterLecture, setFilterLecture] = useState("all")
  const [mcqCount, setMcqCount] = useState("5")
  const [writtenCount, setWrittenCount] = useState("2")
  const [timeMode, setTimeMode] = useState<"none" | "per_question" | "total">("none")
  const [timePerQuestion, setTimePerQuestion] = useState("60")
  const [totalTimeLimit, setTotalTimeLimit] = useState("600")

  // Test state
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [writtenAnswer, setWrittenAnswer] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [startTime, setStartTime] = useState<number>(0)
  const [elapsed, setElapsed] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState(0)
  const [questionElapsed, setQuestionElapsed] = useState(0)
  const [timeUp, setTimeUp] = useState(false)

  // Available lectures for selected module
  const availableLectures = useMemo(() => {
    if (filterModule === "all") return []
    const mod = modules.find((m) => m.id === filterModule)
    return mod?.subjects.flatMap((s) => s.lectures) ?? []
  }, [filterModule, modules])

  // Timer
  useEffect(() => {
    if (mode !== "test") return
    const interval = setInterval(() => {
      const now = Date.now()
      setElapsed(Math.floor((now - startTime) / 1000))
      setQuestionElapsed(Math.floor((now - questionStartTime) / 1000))

      // Check time limits
      if (timeMode === "total" && Math.floor((now - startTime) / 1000) >= parseInt(totalTimeLimit)) {
        setTimeUp(true)
      }
      if (timeMode === "per_question" && Math.floor((now - questionStartTime) / 1000) >= parseInt(timePerQuestion)) {
        setTimeUp(true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [mode, startTime, questionStartTime, timeMode, totalTimeLimit, timePerQuestion])

  // Auto-skip on time up
  useEffect(() => {
    if (!timeUp || mode !== "test") return
    if (timeMode === "total") {
      finishTest()
    } else if (timeMode === "per_question") {
      // Auto-skip current question
      const q = questions[currentIdx]
      if (q?.type === "mcq" && !showResult) {
        handleMcqAnswer(-1) // -1 = no answer
      }
      setTimeUp(false)
    }
  }, [timeUp])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const startTest = () => {
    // Filter MCQs
    let mcqPool = mcqs
    let writtenPool = writtenQuestions
    if (filterModule !== "all") {
      const subjectIds = modules.find((m) => m.id === filterModule)?.subjects.map((s) => s.id) ?? []
      mcqPool = mcqPool.filter((q) => subjectIds.includes(q.lectures?.subject_id))
      writtenPool = writtenPool.filter((q) => subjectIds.includes(q.lectures?.subject_id))
    }
    if (filterLecture !== "all") {
      mcqPool = mcqPool.filter((q) => q.lecture_id === filterLecture)
      writtenPool = writtenPool.filter((q) => q.lecture_id === filterLecture)
    }

    // Shuffle and pick
    const shuffledMcqs = [...mcqPool].sort(() => Math.random() - 0.5)
    const shuffledWritten = [...writtenPool].sort(() => Math.random() - 0.5)
    const selectedMcqs = shuffledMcqs.slice(0, parseInt(mcqCount))
    const selectedWritten = shuffledWritten.slice(0, parseInt(writtenCount))

    const testQuestions: TestQuestion[] = [
      ...selectedMcqs.map((mcq): TestQuestion => ({ type: "mcq", mcq, userAnswer: null, isCorrect: null })),
      ...selectedWritten.map((w): TestQuestion => ({ type: "written", written: w, userAnswer: "", selfScore: null, showModel: false })),
    ].sort(() => Math.random() - 0.5) // Interleave

    if (testQuestions.length === 0) return

    setQuestions(testQuestions)
    setCurrentIdx(0)
    setSelectedAnswer(null)
    setWrittenAnswer("")
    setShowResult(false)
    setStartTime(Date.now())
    setQuestionStartTime(Date.now())
    setElapsed(0)
    setQuestionElapsed(0)
    setTimeUp(false)
    setMode("test")
  }

  const handleMcqAnswer = (answerIdx: number) => {
    if (showResult) return
    const q = questions[currentIdx]
    if (q?.type !== "mcq") return
    const isCorrect = answerIdx === q.mcq.correct_answer

    setSelectedAnswer(answerIdx)
    setShowResult(true)
    setQuestions((prev) =>
      prev.map((qq, i) =>
        i === currentIdx && qq.type === "mcq" ? { ...qq, userAnswer: answerIdx, isCorrect } : qq
      )
    )
  }

  const handleWrittenSubmit = () => {
    if (!writtenAnswer.trim()) return
    setShowResult(true)
    setQuestions((prev) =>
      prev.map((qq, i) =>
        i === currentIdx && qq.type === "written" ? { ...qq, userAnswer: writtenAnswer, showModel: true } : qq
      )
    )
  }

  const handleWrittenScore = (score: number) => {
    setQuestions((prev) =>
      prev.map((qq, i) =>
        i === currentIdx && qq.type === "written" ? { ...qq, selfScore: score } : qq
      )
    )
  }

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1)
      setSelectedAnswer(null)
      setWrittenAnswer("")
      setShowResult(false)
      setQuestionStartTime(Date.now())
      setQuestionElapsed(0)
      setTimeUp(false)
    } else {
      finishTest()
    }
  }

  const finishTest = useCallback(async () => {
    setMode("results")
    const mcqQuestions = questions.filter((q) => q.type === "mcq") as Extract<TestQuestion, { type: "mcq" }>[]
    const writtenQs = questions.filter((q) => q.type === "written") as Extract<TestQuestion, { type: "written" }>[]
    const mcqCorrect = mcqQuestions.filter((q) => q.isCorrect).length
    const writtenAvg = writtenQs.length > 0
      ? writtenQs.reduce((a, q) => a + (q.selfScore || 0), 0) / writtenQs.length
      : 0
    const total = questions.length
    const score = total > 0 ? ((mcqCorrect + (writtenAvg / 5) * writtenQs.length) / total) * 100 : 0

    const supabase = createClient()
    await supabase.from("test_sessions").insert({
      user_id: userId,
      title: `Smart Test - ${new Date().toLocaleDateString()}`,
      test_type: "mixed",
      total_questions: total,
      correct_answers: mcqCorrect,
      score: Math.round(score),
      duration_seconds: elapsed,
      completed_at: new Date().toISOString(),
    })
  }, [questions, elapsed, userId])

  const currentQ = questions[currentIdx]

  // Time remaining display
  const getTimeDisplay = () => {
    if (timeMode === "total") {
      const remaining = parseInt(totalTimeLimit) - elapsed
      return remaining > 0 ? formatTime(remaining) : "0:00"
    }
    if (timeMode === "per_question") {
      const remaining = parseInt(timePerQuestion) - questionElapsed
      return remaining > 0 ? formatTime(remaining) : "0:00"
    }
    return formatTime(elapsed)
  }

  const isTimeCritical = () => {
    if (timeMode === "total") return (parseInt(totalTimeLimit) - elapsed) < 30
    if (timeMode === "per_question") return (parseInt(timePerQuestion) - questionElapsed) < 10
    return false
  }

  // SETUP screen
  if (mode === "setup") {
    const avgScore = testHistory.length > 0
      ? Math.round(testHistory.reduce((a, t) => a + t.score, 0) / testHistory.length) : 0

    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Test</h1>
          <p className="text-muted-foreground">Generate adaptive tests from your study material.</p>
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
                <p className="text-sm text-muted-foreground">Available Questions</p>
                <p className="text-2xl font-bold">{mcqs.length + writtenQuestions.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Configure Your Test</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Module</label>
                <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setFilterLecture("all") }}>
                  <SelectTrigger><SelectValue placeholder="All Modules" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Lecture</label>
                <Select value={filterLecture} onValueChange={setFilterLecture} disabled={filterModule === "all"}>
                  <SelectTrigger><SelectValue placeholder="All Lectures" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lectures</SelectItem>
                    {availableLectures.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">MCQ Questions</label>
                <Select value={mcqCount} onValueChange={setMcqCount}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 MCQs</SelectItem>
                    <SelectItem value="3">3 MCQs</SelectItem>
                    <SelectItem value="5">5 MCQs</SelectItem>
                    <SelectItem value="10">10 MCQs</SelectItem>
                    <SelectItem value="20">20 MCQs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Written Questions</label>
                <Select value={writtenCount} onValueChange={setWrittenCount}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 Written</SelectItem>
                    <SelectItem value="1">1 Written</SelectItem>
                    <SelectItem value="2">2 Written</SelectItem>
                    <SelectItem value="3">3 Written</SelectItem>
                    <SelectItem value="5">5 Written</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Time Mode</label>
                <Select value={timeMode} onValueChange={(v) => setTimeMode(v as typeof timeMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Time Limit</SelectItem>
                    <SelectItem value="per_question">Time Per Question</SelectItem>
                    <SelectItem value="total">Total Time Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {timeMode === "per_question" && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Seconds Per Question</label>
                  <Select value={timePerQuestion} onValueChange={setTimePerQuestion}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="120">2 minutes</SelectItem>
                      <SelectItem value="180">3 minutes</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {timeMode === "total" && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Total Time</label>
                  <Select value={totalTimeLimit} onValueChange={setTotalTimeLimit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="600">10 minutes</SelectItem>
                      <SelectItem value="900">15 minutes</SelectItem>
                      <SelectItem value="1800">30 minutes</SelectItem>
                      <SelectItem value="3600">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button
              onClick={startTest}
              className="self-start gap-2"
              disabled={mcqs.length === 0 && writtenQuestions.length === 0}
            >
              <Play className="h-4 w-4" />
              Start Test
            </Button>
          </CardContent>
        </Card>

        {/* Recent Tests */}
        {testHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Test History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {testHistory.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{t.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString()} &middot; {t.total_questions} questions &middot; {formatTime(t.duration_seconds)}
                      </span>
                    </div>
                    <Badge variant={t.score >= 70 ? "default" : "destructive"} className="font-mono">
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

  // RESULTS screen
  if (mode === "results") {
    const mcqQs = questions.filter((q) => q.type === "mcq") as Extract<TestQuestion, { type: "mcq" }>[]
    const writtenQs = questions.filter((q) => q.type === "written") as Extract<TestQuestion, { type: "written" }>[]
    const mcqCorrect = mcqQs.filter((q) => q.isCorrect).length
    const totalQ = questions.length
    const pct = totalQ > 0
      ? Math.round(((mcqCorrect + writtenQs.reduce((a, q) => a + ((q.selfScore || 0) / 5), 0)) / totalQ) * 100)
      : 0

    return (
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl font-bold tracking-tight">Test Results</h1>

        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-12">
            <div className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold",
              pct >= 70 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            )}>
              {pct}%
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">
                {pct >= 90 ? "Excellent!" : pct >= 70 ? "Good job!" : pct >= 50 ? "Keep practicing" : "Needs work"}
              </h2>
              <p className="text-muted-foreground">
                {mcqQs.length > 0 && `MCQ: ${mcqCorrect}/${mcqQs.length} correct`}
                {mcqQs.length > 0 && writtenQs.length > 0 && " | "}
                {writtenQs.length > 0 && `Written: ${writtenQs.length} answered`}
                {" | "}{formatTime(elapsed)}
              </p>
            </div>
            <Button onClick={() => setMode("setup")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              New Test
            </Button>
          </CardContent>
        </Card>

        {/* Review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Question Review</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {questions.map((q, idx) => {
              if (q.type === "mcq") {
                const opts: string[] = typeof q.mcq.options === "string" ? JSON.parse(q.mcq.options) : q.mcq.options
                return (
                  <div key={idx} className={cn("rounded-lg border p-4", q.isCorrect ? "border-primary/20" : "border-destructive/20")}>
                    <div className="flex items-start gap-2">
                      {q.isCorrect ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="mb-1 w-fit text-[10px]">MCQ</Badge>
                        <p className="text-sm font-medium">{q.mcq.question}</p>
                        <p className="text-xs text-muted-foreground">
                          Your answer: {q.userAnswer !== null && q.userAnswer >= 0 ? opts[q.userAnswer] : "No answer"}
                          {!q.isCorrect && <> &middot; Correct: {opts[q.mcq.correct_answer]}</>}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              } else {
                return (
                  <div key={idx} className="rounded-lg border p-4">
                    <div className="flex items-start gap-2">
                      <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="mb-1 w-fit text-[10px]">Written</Badge>
                        <p className="text-sm font-medium">{q.written.question}</p>
                        <p className="text-xs text-muted-foreground">
                          Self-score: {q.selfScore ? `${q.selfScore}/5 - ${SCORE_LABELS.find((s) => s.value === q.selfScore)?.label}` : "Not scored"}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              }
            })}
          </CardContent>
        </Card>
      </div>
    )
  }

  // TEST IN PROGRESS
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            {currentIdx + 1}/{questions.length}
          </Badge>
          <Badge variant={currentQ?.type === "mcq" ? "default" : "secondary"} className="text-xs">
            {currentQ?.type === "mcq" ? "MCQ" : "Written"}
          </Badge>
        </div>
        <div className={cn("flex items-center gap-2 text-sm", isTimeCritical() ? "text-destructive font-medium" : "text-muted-foreground")}>
          {isTimeCritical() && <AlertTriangle className="h-4 w-4" />}
          <Clock className="h-4 w-4" />
          {getTimeDisplay()}
        </div>
      </div>

      <Progress value={((currentIdx + (showResult ? 1 : 0)) / questions.length) * 100} className="h-2" />

      {/* MCQ Question */}
      {currentQ?.type === "mcq" && (() => {
        const opts: string[] = typeof currentQ.mcq.options === "string" ? JSON.parse(currentQ.mcq.options) : currentQ.mcq.options
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium leading-relaxed">{currentQ.mcq.question}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {opts.map((option: string, idx: number) => {
                const isSelected = selectedAnswer === idx
                const isCorrect = idx === currentQ.mcq.correct_answer
                return (
                  <button
                    key={idx}
                    onClick={() => handleMcqAnswer(idx)}
                    disabled={showResult}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                      !showResult && "hover:bg-accent",
                      showResult && isCorrect && "border-primary bg-primary/5",
                      showResult && isSelected && !isCorrect && "border-destructive bg-destructive/5"
                    )}
                  >
                    <span className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                      showResult && isCorrect && "border-primary bg-primary text-primary-foreground",
                      showResult && isSelected && !isCorrect && "border-destructive bg-destructive text-destructive-foreground",
                      !showResult && "border-muted-foreground/30"
                    )}>
                      {showResult && isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : showResult && isSelected ? <XCircle className="h-3.5 w-3.5" /> : String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </button>
                )
              })}
              {showResult && currentQ.mcq.explanation && (
                <div className="mt-3 rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs font-medium text-primary">Explanation</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{currentQ.mcq.explanation}</p>
                </div>
              )}
              {showResult && (
                <Button onClick={nextQuestion} className="mt-2 self-end">
                  {currentIdx < questions.length - 1 ? "Next Question" : "See Results"}
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Written Question */}
      {currentQ?.type === "written" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium leading-relaxed">{currentQ.written.question}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Textarea
              placeholder="Write your answer here..."
              value={writtenAnswer}
              onChange={(e) => setWrittenAnswer(e.target.value)}
              className="min-h-[150px] resize-y"
              disabled={showResult}
            />
            {!showResult && (
              <Button onClick={handleWrittenSubmit} disabled={!writtenAnswer.trim()} className="self-end gap-2">
                <Send className="h-4 w-4" />
                Submit
              </Button>
            )}
            {showResult && (
              <div className="flex flex-col gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuestions((prev) =>
                      prev.map((qq, i) =>
                        i === currentIdx && qq.type === "written" ? { ...qq, showModel: !qq.showModel } : qq
                      )
                    )
                  }}
                  className="gap-2 self-start"
                >
                  {currentQ.showModel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {currentQ.showModel ? "Hide" : "Show"} Model Answer
                </Button>
                {currentQ.showModel && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="mb-2 text-xs font-medium text-primary">Model Answer</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{currentQ.written.model_answer}</p>
                  </div>
                )}
                {!currentQ.selfScore && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium">Rate your answer:</p>
                    <div className="flex flex-wrap gap-2">
                      {SCORE_LABELS.map((s) => (
                        <Button key={s.value} variant="outline" size="sm" onClick={() => handleWrittenScore(s.value)}>
                          {s.value} - {s.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {currentQ.selfScore && (
                  <>
                    <div className="rounded-lg border bg-primary/5 p-3">
                      <p className="text-sm font-medium text-primary">
                        Self-evaluation: {currentQ.selfScore}/5 - {SCORE_LABELS.find((s) => s.value === currentQ.selfScore)?.label}
                      </p>
                    </div>
                    <Button onClick={nextQuestion} className="self-end">
                      {currentIdx < questions.length - 1 ? "Next Question" : "See Results"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
