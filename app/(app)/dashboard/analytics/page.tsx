import { createClient } from "@/lib/supabase/server"
import { AnalyticsContent } from "@/components/analytics/analytics-content"

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: studySessions },
    { data: mcqAttempts },
    { data: flashcardProgress },
    { data: testSessions },
    { data: weakTopics },
    { data: modules },
  ] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("*, subjects(name), lectures(title)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("mcq_attempts")
      .select("*, mcqs(question, lecture_id, lectures(title, subject_id, subjects(name)))")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("flashcard_progress")
      .select("*, flashcards(front, lecture_id, lectures(title))")
      .eq("user_id", user!.id),
    supabase
      .from("test_sessions")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("weak_topics")
      .select("*, subjects(name), lectures(title)")
      .eq("user_id", user!.id),
    supabase
      .from("modules")
      .select("id, name, subjects(id, name)")
      .order("order_index"),
  ])

  return (
    <AnalyticsContent
      studySessions={studySessions ?? []}
      mcqAttempts={mcqAttempts ?? []}
      flashcardProgress={flashcardProgress ?? []}
      testSessions={testSessions ?? []}
      weakTopics={weakTopics ?? []}
      modules={modules ?? []}
    />
  )
}
