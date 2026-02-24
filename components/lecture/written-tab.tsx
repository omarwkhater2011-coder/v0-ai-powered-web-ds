"use client"

import { useState, useMemo } from "react"
import {
  PenLine,
  Eye,
  EyeOff,
  Send,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface WrittenTabProps {
  writtenQuestions: {
    id: string
    question: string
    model_answer: string
  }[]
  userId: string
}

const SCORE_LABELS = [
  { value: 1, label: "Poor", color: "border-destructive/50 text-destructive hover:bg-destructive/10" },
  { value: 2, label: "Weak", color: "border-orange-500/50 text-orange-600 hover:bg-orange-500/10" },
  { value: 3, label: "Average", color: "border-muted-foreground/50 text-muted-foreground hover:bg-muted" },
  { value: 4, label: "Good", color: "border-primary/50 text-primary hover:bg-primary/10" },
  { value: 5, label: "Excellent", color: "border-primary text-primary hover:bg-primary/10" },
]

type WrittenStatus = "new" | "poor" | "weak" | "average" | "good" | "excellent"

export function WrittenTab({ writtenQuestions, userId }: WrittenTabProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [showModelAnswer, setShowModelAnswer] = useState(false)
  const [selfScore, setSelfScore] = useState<number | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Multi-select status filter
  const [activeFilters, setActiveFilters] = useState<Set<WrittenStatus>>(new Set(["new", "poor", "weak", "average", "good", "excellent"]))
  const [reattemptMode, setReattemptMode] = useState<"all" | "weak" | null>(null)

  const getQuestionStatus = (qId: string): WrittenStatus => {
    const score = scores[qId]
    if (score === undefined) return "new"
    if (score <= 1) return "poor"
    if (score <= 2) return "weak"
    if (score <= 3) return "average"
    if (score <= 4) return "good"
    return "excellent"
  }

  const filteredQuestions = useMemo(() => {
    if (reattemptMode === "weak") {
      return writtenQuestions.filter((q) => {
        const s = getQuestionStatus(q.id)
        return s === "poor" || s === "weak" || s === "average"
      })
    }
    if (reattemptMode === "all") {
      return writtenQuestions
    }
    return writtenQuestions.filter((q) => activeFilters.has(getQuestionStatus(q.id)))
  }, [writtenQuestions, activeFilters, scores, reattemptMode])

  const question = filteredQuestions[currentIndex]
  const progress = filteredQuestions.length > 0 ? (completed.size / filteredQuestions.length) * 100 : 0

  const statusCounts = useMemo(() => {
    const counts: Record<WrittenStatus, number> = { new: 0, poor: 0, weak: 0, average: 0, good: 0, excellent: 0 }
    writtenQuestions.forEach((q) => { counts[getQuestionStatus(q.id)]++ })
    return counts
  }, [writtenQuestions, scores])

  const allAttempted = statusCounts.new === 0 && writtenQuestions.length > 0
  const weakCount = statusCounts.poor + statusCounts.weak + statusCounts.average

  const toggleFilter = (status: WrittenStatus) => {
    const newFilters = new Set(activeFilters)
    if (newFilters.has(status)) {
      newFilters.delete(status)
    } else {
      newFilters.add(status)
    }
    setActiveFilters(newFilters)
    setCurrentIndex(0)
    resetState()
    setReattemptMode(null)
  }

  const handleSubmit = () => {
    if (!userAnswer.trim()) return
    setSubmitted(true)
    setShowModelAnswer(true)
  }

  const handleSelfScore = async (score: number) => {
    if (!question || !userId) return
    setSelfScore(score)
    setSaving(true)

    const supabase = createClient()
    await supabase.from("written_attempts").insert({
      user_id: userId,
      written_question_id: question.id,
      user_answer: userAnswer,
      self_score: score,
    })

    setScores((prev) => ({ ...prev, [question.id]: score }))
    setCompleted(new Set([...completed, question.id]))
    setSaving(false)
  }

  const nextQuestion = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      resetState()
    }
  }

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      resetState()
    }
  }

  const resetState = () => {
    setUserAnswer("")
    setSubmitted(false)
    setShowModelAnswer(false)
    setSelfScore(null)
  }

  const restart = () => {
    setCurrentIndex(0)
    setCompleted(new Set())
    setScores({})
    resetState()
    setReattemptMode(null)
    setActiveFilters(new Set(["new", "poor", "weak", "average", "good", "excellent"]))
  }

  const startReattempt = (mode: "all" | "weak") => {
    setReattemptMode(mode)
    setCurrentIndex(0)
    resetState()
    setCompleted(new Set())
    if (mode === "all") {
      setScores({})
    }
  }

  if (writtenQuestions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <PenLine className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No written questions for this lecture yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  // All questions completed in current filter
  if (filteredQuestions.length > 0 && completed.size >= filteredQuestions.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold">
            {reattemptMode ? "Reattempt Complete!" : "All questions answered!"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {"You've completed"} {filteredQuestions.length} written questions.
          </p>

          {allAttempted && weakCount > 0 && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => startReattempt("weak")} variant="outline" className="gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Reattempt Weak/Poor ({weakCount})
              </Button>
              <Button onClick={() => startReattempt("all")} variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reattempt All
              </Button>
            </div>
          )}
          <Button onClick={restart} variant="ghost" size="sm">
            Reset Everything
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Multi-select status filter */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: "new" as WrittenStatus, label: "New", count: statusCounts.new },
          { key: "poor" as WrittenStatus, label: "Poor", count: statusCounts.poor },
          { key: "weak" as WrittenStatus, label: "Weak", count: statusCounts.weak },
          { key: "average" as WrittenStatus, label: "Average", count: statusCounts.average },
          { key: "good" as WrittenStatus, label: "Good", count: statusCounts.good },
          { key: "excellent" as WrittenStatus, label: "Excellent", count: statusCounts.excellent },
        ]).map((f) => (
          <Button
            key={f.key}
            variant={activeFilters.has(f.key) && !reattemptMode ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFilter(f.key)}
            className="h-7 text-xs"
          >
            {f.label} ({f.count})
          </Button>
        ))}
      </div>

      {reattemptMode && (
        <Badge variant="secondary" className="self-start text-xs">
          Reattempting: {reattemptMode === "weak" ? "Weak/Poor questions" : "All questions"}
        </Badge>
      )}

      {filteredQuestions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No questions match the selected filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress */}
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-sm text-muted-foreground">
              {completed.size}/{filteredQuestions.length}
            </span>
          </div>

          {/* Question */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PenLine className="h-4 w-4 text-primary" />
                  Question {currentIndex + 1} of {filteredQuestions.length}
                </CardTitle>
                {completed.has(question?.id) && (
                  <Badge variant="secondary" className="text-xs">Completed</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm font-medium leading-relaxed">{question?.question}</p>

              <Textarea
                placeholder="Write your answer here..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="min-h-[150px] resize-y"
                disabled={submitted}
              />

              {!submitted && (
                <Button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim()}
                  className="self-end gap-2"
                >
                  <Send className="h-4 w-4" />
                  Submit Answer
                </Button>
              )}

              {submitted && (
                <div className="flex flex-col gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowModelAnswer(!showModelAnswer)}
                    className="gap-2 self-start"
                  >
                    {showModelAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showModelAnswer ? "Hide" : "Show"} Model Answer
                  </Button>

                  {showModelAnswer && (
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="mb-2 text-xs font-medium text-primary">Model Answer</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {question?.model_answer}
                      </p>
                    </div>
                  )}

                  {!selfScore && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Rate your answer:</p>
                      <div className="flex flex-wrap gap-2">
                        {SCORE_LABELS.map((s) => (
                          <Button
                            key={s.value}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelfScore(s.value)}
                            disabled={saving}
                            className={cn("gap-1.5", s.color)}
                          >
                            {s.value} - {s.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selfScore && (
                    <div className="rounded-lg border bg-primary/5 p-3">
                      <p className="text-sm font-medium text-primary">
                        Self-evaluation: {selfScore}/5 - {SCORE_LABELS.find((s) => s.value === selfScore)?.label}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={prevQuestion} disabled={currentIndex === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button variant="ghost" size="sm" onClick={nextQuestion} disabled={currentIndex === filteredQuestions.length - 1}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
