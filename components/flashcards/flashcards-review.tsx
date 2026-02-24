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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { isDueForReview, calculateNextReview, type Confidence } from "@/lib/spacedRepetition"

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

interface Module {
  id: string
  name: string
  subjects: {
    id: string
    name: string
    lectures: { id: string; title: string }[]
  }[]
}

interface FlashcardsReviewProps {
  flashcards: Flashcard[]
  progressMap: Record<string, {
    ease_factor: number
    interval_days: number
    repetitions: number
    next_review_at: string
  }>
  modules: Module[]
  userId: string
}

export function FlashcardsReview({
  flashcards,
  progressMap,
  modules,
  userId,
}: FlashcardsReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [localProgress, setLocalProgress] = useState(progressMap)
  const [filterModule, setFilterModule] = useState<string>("all")
  const [filterMode, setFilterMode] = useState<string>("due")

  const filteredCards = useMemo(() => {
    let cards = flashcards

    if (filterModule !== "all") {
      cards = cards.filter(
        (c) => c.lectures?.subjects?.modules?.id === filterModule
      )
    }

    if (filterMode === "due") {
      cards = cards.filter((c) => isDueForReview(localProgress[c.id]))
    }

    return cards
  }, [flashcards, filterModule, filterMode, localProgress])

  const card = filteredCards[currentIndex]
  const progressPercent =
    filteredCards.length > 0
      ? (completed.size / filteredCards.length) * 100
      : 0

  const dueCount = flashcards.filter((c) => isDueForReview(localProgress[c.id])).length
  const masteredCount = flashcards.filter(
    (c) => localProgress[c.id] && localProgress[c.id].repetitions >= 3
  ).length

  const handleConfidence = async (confidence: Confidence) => {
    if (!card) return
    const supabase = createClient()

    const result = calculateNextReview(confidence, localProgress[card.id])

    await supabase.from("flashcard_progress").upsert(
      {
        user_id: userId,
        flashcard_id: card.id,
        ease_factor: result.ease_factor,
        interval_days: result.interval_days,
        repetitions: result.repetitions,
        next_review_at: result.next_review_at,
        last_reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,flashcard_id" }
    )

    setLocalProgress((prev) => ({
      ...prev,
      [card.id]: {
        ease_factor: result.ease_factor,
        interval_days: result.interval_days,
        repetitions: result.repetitions,
        next_review_at: result.next_review_at,
      },
    }))

    setCompleted((prev) => new Set([...prev, card.id]))
    setIsFlipped(false)

    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const restart = () => {
    setCompleted(new Set())
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Flashcard Review</h1>
        <p className="text-muted-foreground">
          Review flashcards across all your modules with spaced repetition.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cards</p>
              <p className="text-2xl font-bold">{flashcards.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due for Review</p>
              <p className="text-2xl font-bold">{dueCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
              <Trophy className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mastered</p>
              <p className="text-2xl font-bold">{masteredCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setCurrentIndex(0); setCompleted(new Set()); setIsFlipped(false) }}>
          <SelectTrigger className="w-[200px]">
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
        <Select value={filterMode} onValueChange={(v) => { setFilterMode(v); setCurrentIndex(0); setCompleted(new Set()); setIsFlipped(false) }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Due for Review" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Due for Review</SelectItem>
            <SelectItem value="all">All Cards</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Card area */}
      {filteredCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <Trophy className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-xl font-bold">
              {filterMode === "due" ? "All caught up!" : "No flashcards found"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {filterMode === "due"
                ? "No flashcards are due for review right now. Check back later or review all cards."
                : "No flashcards match your current filters."}
            </p>
            {filterMode === "due" && (
              <Button variant="outline" onClick={() => setFilterMode("all")}>
                Review All Cards
              </Button>
            )}
          </CardContent>
        </Card>
      ) : completed.size === filteredCards.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Session Complete!</h3>
            <p className="text-sm text-muted-foreground">
              {"You've reviewed all"} {filteredCards.length} flashcards in this session.
            </p>
            <Button onClick={restart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-sm text-muted-foreground">
              {completed.size}/{filteredCards.length}
            </span>
          </div>

          {/* Card label */}
          {card && card.lectures && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {card.lectures.subjects?.modules?.name}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {card.lectures.subjects?.name} &middot; {card.lectures.title}
              </span>
            </div>
          )}

          {/* Flashcard */}
          {card && (
            <button
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full text-left"
            >
              <Card className="min-h-[280px] cursor-pointer transition-all hover:border-primary/30">
                <CardContent className="flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center">
                  <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {isFlipped ? "Answer" : "Question"} &mdash; Card{" "}
                    {currentIndex + 1} of {filteredCards.length}
                  </p>
                  <p className="text-lg leading-relaxed">
                    {isFlipped ? card.back : card.front}
                  </p>
                  {!isFlipped && (
                    <p className="mt-6 text-xs text-muted-foreground">
                      Click to reveal answer
                    </p>
                  )}
                </CardContent>
              </Card>
            </button>
          )}

          {/* Confidence buttons */}
          {isFlipped && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => handleConfidence("hard")}
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <ThumbsDown className="h-4 w-4" />
                Hard
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfidence("medium")}
                className="gap-2"
              >
                <Minus className="h-4 w-4" />
                Okay
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfidence("easy")}
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <ThumbsUp className="h-4 w-4" />
                Easy
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
