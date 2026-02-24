"use client"

import { useState, useMemo } from "react"
import { RotateCcw, ThumbsDown, Minus, ThumbsUp, Trophy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface FlashcardsTabProps {
  flashcards: { id: string; front: string; back: string; order_index: number }[]
  flashcardProgress: Record<
    string,
    {
      ease_factor: number
      interval_days: number
      repetitions: number
      next_review_at: string
    }
  >
  userId: string
  lectureId: string
}

type CardRating = "hard" | "okay" | "easy" | null

export function FlashcardsTab({
  flashcards,
  flashcardProgress,
  userId,
  lectureId,
}: FlashcardsTabProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [ratings, setRatings] = useState<Record<string, CardRating>>({})
  const [round, setRound] = useState(1)
  const [showingEasy, setShowingEasy] = useState(false)

  // Build the current queue based on ratings
  const currentQueue = useMemo(() => {
    if (Object.keys(ratings).length === 0) {
      // Round 1: show all new cards
      return flashcards
    }

    const hardCards = flashcards.filter((c) => ratings[c.id] === "hard")
    const okayCards = flashcards.filter((c) => ratings[c.id] === "okay")
    const easyCards = flashcards.filter((c) => ratings[c.id] === "easy")

    // If showing easy review
    if (showingEasy) {
      return easyCards
    }

    // If there are hard cards, show those first
    if (hardCards.length > 0) {
      return hardCards
    }

    // If there are okay cards, show those
    if (okayCards.length > 0) {
      return okayCards
    }

    // All done - all are easy
    return []
  }, [flashcards, ratings, showingEasy])

  const allRated = flashcards.length > 0 && flashcards.every((c) => ratings[c.id])
  const hardCount = flashcards.filter((c) => ratings[c.id] === "hard").length
  const okayCount = flashcards.filter((c) => ratings[c.id] === "okay").length
  const easyCount = flashcards.filter((c) => ratings[c.id] === "easy").length
  const allEasy = allRated && hardCount === 0 && okayCount === 0

  const card = currentQueue[currentIndex]

  const handleConfidence = async (quality: number, ratingLabel: CardRating) => {
    if (!card) return
    const supabase = createClient()

    const existing = flashcardProgress[card.id]
    let newEase = existing?.ease_factor ?? 2.5
    let newInterval = existing?.interval_days ?? 0
    let newReps = existing?.repetitions ?? 0

    if (quality >= 3) {
      if (newReps === 0) newInterval = 1
      else if (newReps === 1) newInterval = 6
      else newInterval = Math.round(newInterval * newEase)
      newReps += 1
    } else {
      newReps = 0
      newInterval = 0
    }

    newEase = Math.max(1.3, newEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + newInterval)

    await supabase.from("flashcard_progress").upsert(
      {
        user_id: userId,
        flashcard_id: card.id,
        ease_factor: newEase,
        interval_days: newInterval,
        repetitions: newReps,
        next_review_at: nextReview.toISOString(),
        last_reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,flashcard_id" }
    )

    // Update rating
    setRatings((prev) => ({ ...prev, [card.id]: ratingLabel }))
    setIsFlipped(false)

    // Move to next card in queue
    if (currentIndex < currentQueue.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      // Queue exhausted - recalculate happens via useMemo
      setCurrentIndex(0)
      setRound((r) => r + 1)
    }
  }

  const restart = () => {
    setRatings({})
    setCurrentIndex(0)
    setIsFlipped(false)
    setRound(1)
    setShowingEasy(false)
  }

  if (flashcards.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <RotateCcw className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No flashcards for this lecture yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  // All cards rated as easy
  if (allEasy && !showingEasy) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold">All cards mastered!</h3>
          <p className="text-sm text-muted-foreground">
            All {flashcards.length} flashcards are rated as Easy.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowingEasy(true)}>
              Review Easy Cards
            </Button>
            <Button onClick={restart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No more cards in current queue (cycle to next difficulty)
  if (currentQueue.length === 0 && allRated) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold">All cards mastered!</h3>
          <p className="text-sm text-muted-foreground">
            All flashcards are rated as Easy. Great work!
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowingEasy(true)}>
              Review Easy Cards
            </Button>
            <Button onClick={restart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const progressPercent = allRated ? (easyCount / flashcards.length) * 100 : (Object.keys(ratings).length / flashcards.length) * 100

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">Round {round}</Badge>
        {hardCount > 0 && (
          <Badge variant="destructive" className="text-xs">{hardCount} Hard</Badge>
        )}
        {okayCount > 0 && (
          <Badge variant="secondary" className="text-xs">{okayCount} Okay</Badge>
        )}
        {easyCount > 0 && (
          <Badge className="bg-primary/10 text-primary text-xs hover:bg-primary/10">{easyCount} Easy</Badge>
        )}
        {showingEasy && (
          <Badge variant="outline" className="text-xs">Reviewing Easy</Badge>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <Progress value={progressPercent} className="h-2 flex-1" />
        <span className="text-sm text-muted-foreground">
          {showingEasy
            ? `${currentIndex + 1}/${currentQueue.length}`
            : `${easyCount}/${flashcards.length} mastered`}
        </span>
      </div>

      {/* Current difficulty label */}
      {allRated && !showingEasy && (
        <p className="text-sm font-medium text-muted-foreground">
          {hardCount > 0
            ? `Reviewing ${hardCount} Hard card${hardCount > 1 ? "s" : ""}...`
            : okayCount > 0
              ? `Reviewing ${okayCount} Okay card${okayCount > 1 ? "s" : ""}...`
              : ""}
        </p>
      )}

      {/* Card */}
      {card && (
        <>
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full text-left"
          >
            <Card className="min-h-[280px] cursor-pointer transition-all hover:border-primary/30">
              <CardContent className="flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {isFlipped ? "Answer" : "Question"} - Card {currentIndex + 1} of{" "}
                  {currentQueue.length}
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

          {/* Confidence buttons */}
          {isFlipped && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => handleConfidence(1, "hard")}
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <ThumbsDown className="h-4 w-4" />
                Hard
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfidence(3, "okay")}
                className="gap-2"
              >
                <Minus className="h-4 w-4" />
                Okay
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfidence(5, "easy")}
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <ThumbsUp className="h-4 w-4" />
                Easy
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
