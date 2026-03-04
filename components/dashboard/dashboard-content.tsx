"use client"

import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import {
  BookOpen,
  Clock,
  BrainCircuit,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Circle,
  Plus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TaskList } from "@/components/dashboard/task-list"

interface Module {
  id: string
  name: string
  code: string
  description: string
  subjects: {
    id: string
    name: string
    lectures: { id: string; title: string }[]
  }[]
}

interface DashboardContentProps {
  user: User
  profile: { display_name: string } | null
  modules: Module[]
  recentSessions: {
    id: string
    duration_minutes: number
    session_type: string
    created_at: string
    subjects: { name: string } | null
    lectures: { title: string } | null
  }[]
  tasks: {
    id: string
    title: string
    completed: boolean
    due_date: string | null
    created_at: string
  }[]
  weakTopics: {
    id: string
    topic: string
    accuracy: number
    subjects: { name: string } | null
    lectures: { title: string } | null
  }[]
}

export function DashboardContent({
  user,
  profile,
  modules,
  recentSessions,
  tasks,
  weakTopics,
}: DashboardContentProps) {
  const displayName = profile?.display_name || user.email?.split("@")[0] || "Student"
  const totalSubjects = modules.reduce((a, m) => a + m.subjects.length, 0)
  const totalLectures = modules.reduce(
    (a, m) => a + m.subjects.reduce((b, s) => b + s.lectures.length, 0),
    0
  )
  const totalMinutes = recentSessions.reduce((a, s) => a + s.duration_minutes, 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {displayName}
        </h1>
        <p className="text-muted-foreground">
          {"Here's an overview of your medical studies."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Modules</p>
              <p className="text-2xl font-bold">{modules.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subjects</p>
              <p className="text-2xl font-bold">{totalSubjects}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lectures</p>
              <p className="text-2xl font-bold">{totalLectures}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Study Time</p>
              <p className="text-2xl font-bold">{totalMinutes}m</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Modules overview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Your Modules</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/modules">
                  View all
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {modules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/modules/${mod.id}`}
                  className="group flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {mod.code}
                      </Badge>
                      <span className="font-medium">{mod.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {mod.subjects.length} subjects,{" "}
                      {mod.subjects.reduce((a, s) => a + s.lectures.length, 0)} lectures
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
              {modules.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No modules found. Seed data may still be loading.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-6">
          {/* Tasks */}
          <TaskList initialTasks={tasks} userId={user.id} modules={modules} />

          {/* Weak Topics */}
          {weakTopics.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Weak Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {weakTopics.map((wt) => (
                  <div key={wt.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{wt.topic}</span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(wt.accuracy * 100)}%
                      </span>
                    </div>
                    <Progress value={wt.accuracy * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {wt.subjects?.name}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
