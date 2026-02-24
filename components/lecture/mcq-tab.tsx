"use client"

import { useState, useMemo } from "react"
import { CheckCircle2, XCircle, ClipboardCheck, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface McqTabProps {
  mcqs: {
    id: string
    question: string
    options: string[]
    correct_answer: number
    explanation: string
  }[]
  userId: string
}

type McqStatus = "new" | "correct" | "wrong"

export function McqTab({ mcqs, userId }: McqTabProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [finished, setFinished] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [filterStatus, setFilterStatus] = useState<McqStatus | "all">("all")
  const [reattemptMode, setReattemptMode] = useState<"all" | "wrong" | null>(null)

  const filteredMcqs = useMemo(() => {
    if (reattemptMode === "wrong") {
      return mcqs.filter((q) => results[q.id] === false)
    }
    if (reattemptMode === "all") {
      return mcqs
    }
    if (filterStatus === "all") return mcqs
    if (filterStatus === "new") return mcqs.filter((q) => results[q.id] === undefined)
    if (filterStatus === "correct") return mcqs.filter((q) => results[q.id] === true)
    if (filterStatus === "wrong") return mcqs.filter((q) => results[q.id] === false)
    return mcqs
  }, [mcqs, filterStatus, results, reattemptMode])

  const mcq = filteredMcqs[currentIndex]

  const newCount = mcqs.filter((q) => results[q.id] === undefined).length
  const correctCount = mcqs.filter((q) => results[q.id] === true).length
  const wrongCount = mcqs.filter((q) => results[q.id] === false).length
  const allAttempted = newCount === 0 && mcqs.length > 0

  const handleAnswer = async (answerIndex: number) => {
    if (showResult || !mcq) return
    setSelectedAnswer(answerIndex)
    setShowResult(true)

    const isCorrect = answerIndex === mcq.correct_answer
    setScore((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }))
    setResults((prev) => ({ ...prev, [mcq.id]: isCorrect }))

    const supabase = createClient()
    await supabase.from("mcq_attempts").insert({
      user_id: userId,
      mcq_id: mcq.id,
      selected_answer: answerIndex,
      is_correct: isCorrect,
    })
  }

  const nextQuestion = () => {
    if (currentIndex < filteredMcqs.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    } else {
      setFinished(true)
    }
  }

  const startReattempt = (mode: "all" | "wrong") => {
    setReattemptMode(mode)
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore({ correct: 0, total: 0 })
    setFinished(false)
    if (mode === "all") {
      setResults({})
    }
  }

  const restart = () => {
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore({ correct: 0, total: 0 })
    setFinished(false)
    setResults({})
    setFilterStatus("all")
    setReattemptMode(null)
  }

  const changeFilter = (status: McqStatus | "all") => {
    setFilterStatus(status)
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore({ correct: 0, total: 0 })
    setFinished(false)
    setReattemptMode(null)
  }

  if (mcqs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No MCQs for this lecture yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (finished) {
    const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold",
              percentage >= 70
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {percentage}%
          </div>
          <h3 className="text-xl font-bold">
            {reattemptMode === "wrong" ? "Reattempt Complete!" : "Quiz Complete!"}
          </h3>
          <p className="text-muted-foreground">
            You got {score.correct} out of {score.total} correct.
          </p>

          {/* Reattempt options */}
          {allAttempted && wrongCount > 0 && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => startReattempt("wrong")} variant="outline" className="gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Reattempt Wrong Only ({wrongCount})
              </Button>
              <Button onClick={() => startReattempt("all")} variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reattempt All
              </Button>
            </div>
          )}
          {allAttempted && wrongCount === 0 && (
            <p className="text-sm text-primary font-medium">Perfect score! All answers correct.</p>
          )}
          <Button onClick={restart} variant="ghost" size="sm">
            Reset Everything
          </Button>
        </CardContent>
      </Card>
    )
  }

  const options: string[] = mcq ? (typeof mcq.options === "string" ? JSON.parse(mcq.options) : mcq.options) : []

  return (
    <div className="flex flex-col gap-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filterStatus === "all" && !reattemptMode ? "default" : "outline"}
          size="sm"
          onClick={() => changeFilter("all")}
          className="h-7 text-xs"
        >
          All ({mcqs.length})
        </Button>
        <Button
          variant={filterStatus === "new" && !reattemptMode ? "default" : "outline"}
          size="sm"
          onClick={() => changeFilter("new")}
          className="h-7 text-xs"
        >
          New ({newCount})
        </Button>
        <Button
          variant={filterStatus === "correct" && !reattemptMode ? "default" : "outline"}
          size="sm"
          onClick={() => changeFilter("correct")}
          className="h-7 text-xs gap-1"
        >
          <CheckCircle2 className="h-3 w-3 text-primary" />
          Correct ({correctCount})
        </Button>
        <Button
          variant={filterStatus === "wrong" && !reattemptMode ? "default" : "outline"}
          size="sm"
          onClick={() => changeFilter("wrong")}
          className="h-7 text-xs gap-1"
        >
          <XCircle className="h-3 w-3 text-destructive" />
          Wrong ({wrongCount})
        </Button>
      </div>

      {reattemptMode && (
        <Badge variant="secondary" className="self-start text-xs">
          Reattempting: {reattemptMode === "wrong" ? "Wrong answers only" : "All questions"}
        </Badge>
      )}

      {filteredMcqs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No questions match this filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {filteredMcqs.length}
            </span>
            <span className="text-sm text-muted-foreground">
              Score: {score.correct}/{score.total}
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium leading-relaxed">
                {mcq.question}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {options.map((option: string, idx: number) => {
                const isSelected = selectedAnswer === idx
                const isCorrect = idx === mcq.correct_answer

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={showResult}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                      !showResult && "hover:bg-accent",
                      showResult && isCorrect && "border-primary bg-primary/5",
                      showResult && isSelected && !isCorrect && "border-destructive bg-destructive/5"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                        showResult && isCorrect && "border-primary bg-primary text-primary-foreground",
                        showResult && isSelected && !isCorrect && "border-destructive bg-destructive text-destructive-foreground",
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

              {showResult && mcq.explanation && (
                <div className="mt-3 rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs font-medium text-primary">Explanation</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {mcq.explanation}
                  </p>
                </div>
              )}

              {showResult && (
                <Button onClick={nextQuestion} className="mt-2 self-end">
                  {currentIndex < filteredMcqs.length - 1 ? "Next Question" : "See Results"}
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
