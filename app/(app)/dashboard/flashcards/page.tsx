import { createClient } from "@/lib/supabase/server"
import { FlashcardsReview } from "@/components/flashcards/flashcards-review"

export default async function FlashcardsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: flashcards },
    { data: progress },
    { data: modules },
  ] = await Promise.all([
    supabase
      .from("flashcards")
      .select("*, lectures(id, title, subject_id, subjects(id, name, module_id, modules(id, name)))")
      .order("order_index"),
    supabase
      .from("flashcard_progress")
      .select("*")
      .eq("user_id", user!.id),
    supabase
      .from("modules")
      .select("id, name, subjects(id, name, lectures(id, title))")
      .order("order_index"),
  ])

  const progressMap: Record<string, {
    ease_factor: number
    interval_days: number
    repetitions: number
    next_review_at: string
  }> = {}
  for (const p of progress ?? []) {
    progressMap[p.flashcard_id] = {
      ease_factor: p.ease_factor,
      interval_days: p.interval_days,
      repetitions: p.repetitions,
      next_review_at: p.next_review_at,
    }
  }

  return (
    <FlashcardsReview
      flashcards={flashcards ?? []}
      progressMap={progressMap}
      modules={modules ?? []}
      userId={user!.id}
    />
  )
}
