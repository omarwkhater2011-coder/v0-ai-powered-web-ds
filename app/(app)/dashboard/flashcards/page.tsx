import { createClient } from "@/lib/supabase/server"
import { ExerciseContent } from "@/components/exercise/exercise-content"

export default async function ExercisePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: flashcards },
    { data: mcqs },
    { data: writtenQuestions },
    { data: progress },
    { data: modules },
    { data: mcqAttempts },
    { data: writtenAttempts },
  ] = await Promise.all([
    supabase
      .from("flashcards")
      .select("*, lectures(id, title, subject_id, subjects(id, name, module_id, modules(id, name)))")
      .order("order_index"),
    supabase
      .from("mcqs")
      .select("*, lectures(id, title, subject_id, subjects(id, name, module_id, modules(id, name)))")
      .order("created_at"),
    supabase
      .from("written_questions")
      .select("*, lectures(id, title, subject_id, subjects(id, name, module_id, modules(id, name)))")
      .order("created_at"),
    supabase
      .from("flashcard_progress")
      .select("*")
      .eq("user_id", user!.id),
    supabase
      .from("modules")
      .select("id, name, subjects(id, name, lectures(id, title))")
      .order("order_index"),
    supabase
      .from("mcq_attempts")
      .select("mcq_id, is_correct")
      .eq("user_id", user!.id),
    supabase
      .from("written_attempts")
      .select("written_question_id, self_score")
      .eq("user_id", user!.id),
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

  // Build MCQ attempt results (latest attempt per mcq)
  const mcqResults: Record<string, boolean> = {}
  for (const a of mcqAttempts ?? []) {
    mcqResults[a.mcq_id] = a.is_correct
  }

  // Build written attempt results (latest score per question)
  const writtenResults: Record<string, number> = {}
  for (const a of writtenAttempts ?? []) {
    writtenResults[a.written_question_id] = a.self_score
  }

  return (
    <ExerciseContent
      flashcards={flashcards ?? []}
      mcqs={mcqs ?? []}
      writtenQuestions={writtenQuestions ?? []}
      progressMap={progressMap}
      mcqResults={mcqResults}
      writtenResults={writtenResults}
      modules={modules ?? []}
      userId={user!.id}
    />
  )
}
