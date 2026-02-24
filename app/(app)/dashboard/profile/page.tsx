import { createClient } from "@/lib/supabase/server"
import { ProfileContent } from "@/components/profile/profile-content"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: studySessions },
    { data: flashcardProgress },
    { data: mcqAttempts },
    { data: testSessions },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("study_sessions")
      .select("duration_minutes, created_at")
      .eq("user_id", user!.id),
    supabase
      .from("flashcard_progress")
      .select("id, repetitions")
      .eq("user_id", user!.id),
    supabase
      .from("mcq_attempts")
      .select("id, is_correct")
      .eq("user_id", user!.id),
    supabase
      .from("test_sessions")
      .select("id, score")
      .eq("user_id", user!.id),
  ])

  return (
    <ProfileContent
      user={user!}
      profile={profile}
      stats={{
        totalStudyMinutes: (studySessions ?? []).reduce(
          (a, s) => a + s.duration_minutes,
          0
        ),
        totalSessions: (studySessions ?? []).length,
        cardsReviewed: (flashcardProgress ?? []).length,
        cardsMastered: (flashcardProgress ?? []).filter(
          (p) => p.repetitions >= 3
        ).length,
        mcqAttempts: (mcqAttempts ?? []).length,
        mcqCorrect: (mcqAttempts ?? []).filter((a) => a.is_correct).length,
        testsTaken: (testSessions ?? []).length,
        avgTestScore:
          (testSessions ?? []).length > 0
            ? Math.round(
                (testSessions ?? []).reduce((a, t) => a + t.score, 0) /
                  (testSessions ?? []).length
              )
            : 0,
      }}
    />
  )
}
