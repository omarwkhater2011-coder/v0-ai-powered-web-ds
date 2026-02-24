"use client"

import { useState } from "react"
import { CheckCircle2, Circle, Plus, Trash2, BookOpen, ClipboardCheck, BrainCircuit, Timer } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

interface Task {
  id: string
  title: string
  completed: boolean
  due_date: string | null
  created_at: string
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

const ACTIVITY_TYPES = [
  { value: "solving", label: "Solving (MCQs)", icon: ClipboardCheck },
  { value: "studying", label: "Studying (Notes)", icon: BookOpen },
  { value: "revision", label: "Revision (Flashcards)", icon: BrainCircuit },
  { value: "focus", label: "Focus Session", icon: Timer },
]

export function TaskList({
  initialTasks,
  userId,
  modules = [],
}: {
  initialTasks: Task[]
  userId: string
  modules?: Module[]
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [selectedModule, setSelectedModule] = useState<string>("")
  const [selectedLecture, setSelectedLecture] = useState<string>("")
  const [selectedActivity, setSelectedActivity] = useState<string>("")
  const supabase = createClient()

  const selectedModuleData = modules.find((m) => m.id === selectedModule)
  const lectures = selectedModuleData?.subjects.flatMap((s) => s.lectures) ?? []

  const addTask = async () => {
    if (!selectedModule || !selectedActivity) return

    const moduleName = modules.find((m) => m.id === selectedModule)?.name ?? ""
    const lectureName = lectures.find((l) => l.id === selectedLecture)?.title
    const activityLabel = ACTIVITY_TYPES.find((a) => a.value === selectedActivity)?.label ?? ""

    const title = lectureName
      ? `${activityLabel} - ${lectureName} (${moduleName})`
      : `${activityLabel} - ${moduleName}`

    const { data, error } = await supabase
      .from("tasks")
      .insert({ user_id: userId, title: title.trim() })
      .select()
      .single()
    if (data && !error) {
      setTasks([data, ...tasks])
      setSelectedModule("")
      setSelectedLecture("")
      setSelectedActivity("")
    }
  }

  const toggleTask = async (taskId: string, completed: boolean) => {
    await supabase.from("tasks").update({ completed: !completed }).eq("id", taskId)
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, completed: !completed } : t)))
  }

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId)
    setTasks(tasks.filter((t) => t.id !== taskId))
  }

  const canAdd = selectedModule && selectedActivity

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Study Tasks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Task creation selectors */}
        <div className="flex flex-col gap-2">
          <Select value={selectedModule} onValueChange={(v) => { setSelectedModule(v); setSelectedLecture("") }}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select module..." />
            </SelectTrigger>
            <SelectContent>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedModule && lectures.length > 0 && (
            <Select value={selectedLecture} onValueChange={setSelectedLecture}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select lecture (optional)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All lectures</SelectItem>
                {lectures.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedActivity} onValueChange={setSelectedActivity}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select activity..." />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            className="h-8 w-full gap-1.5"
            onClick={addTask}
            disabled={!canAdd}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>

        {/* Task list */}
        <div className="flex flex-col gap-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <button
                onClick={() => toggleTask(task.id, task.completed)}
                className="shrink-0"
              >
                {task.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <span
                className={`flex-1 text-sm ${
                  task.completed ? "text-muted-foreground line-through" : ""
                }`}
              >
                {task.title}
              </span>
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No tasks yet. Select a module and activity above!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
