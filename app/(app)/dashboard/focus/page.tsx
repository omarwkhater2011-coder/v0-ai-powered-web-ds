import { createClient } from "@/lib/supabase/server"
import { FocusTimerContent } from "@/components/focus/focus-timer-content"

export default async function FocusPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: recentSessions },
    { data: modules },
  ] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("*, subjects(name), lectures(title)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("modules")
      .select("id, name, subjects(id, name, lectures(id, title))")
      .order("order_index"),
  ])

  return (
    <FocusTimerContent
      recentSessions={recentSessions ?? []}
      modules={modules ?? []}
      userId={user!.id}
    />
  )
}
