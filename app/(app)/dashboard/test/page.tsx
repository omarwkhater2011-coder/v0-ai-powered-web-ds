import { createClient } from "@/lib/supabase/server"
import { SmartTestContent } from "@/components/test/smart-test-content"

export default async function SmartTestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: modules },
    { data: mcqs },
    { data: writtenQuestions },
    { data: testSessions },
    { data: weakTopics },
  ] = await Promise.all([
    supabase
      .from("modules")
      .select("id, name, subjects(id, name, lectures(id, title))")
      .order("order_index"),
    supabase
      .from("mcqs")
      .select("*, lectures(id, title, subject_id)")
      .order("created_at"),
    supabase
      .from("written_questions")
      .select("*, lectures(id, title, subject_id)")
      .order("created_at"),
    supabase
      .from("test_sessions")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("weak_topics")
      .select("*")
      .eq("user_id", user!.id),
  ])

  return (
    <SmartTestContent
      modules={modules ?? []}
      mcqs={mcqs ?? []}
      writtenQuestions={writtenQuestions ?? []}
      testHistory={testSessions ?? []}
      weakTopics={weakTopics ?? []}
      userId={user!.id}
    />
  )
}
