"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Target,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

interface Module {
  id: string
  name: string
  subjects: {
    id: string
    name: string
    lectures: { id: string; title: string }[]
  }[]
}

interface Session {
  id: string
  duration_minutes: number
  session_type: string
  created_at: string
  subjects: { name: string } | null
  lectures: { title: string } | null
}

interface FocusTimerContentProps {
  recentSessions: Session[]
  modules: Module[]
  userId: string
}

const PRESETS = [
  { label: "25 min", value: 25, description: "Pomodoro" },
  { label: "45 min", value: 45, description: "Deep focus" },
  { label: "60 min", value: 60, description: "Extended" },
  { label: "90 min", value: 90, description: "Marathon" },
]

export function FocusTimerContent({
  recentSessions,
  modules,
  userId,
}: FocusTimerContentProps) {
  const [selectedPreset, setSelectedPreset] = useState(25)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string>("none")
  const [sessions, setSessions] = useState(recentSessions)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const totalMinutesToday = sessions
    .filter((s) => {
      const d = new Date(s.created_at)
      const now = new Date()
      return d.toDateString() === now.toDateString()
    })
    .reduce((a, s) => a + s.duration_minutes, 0)

  const totalSessions = sessions.length
  const avgDuration =
    totalSessions > 0
      ? Math.round(sessions.reduce((a, s) => a + s.duration_minutes, 0) / totalSessions)
      : 0

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            setIsFinished(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, timeLeft])

  const saveSession = useCallback(async () => {
    const elapsed = selectedPreset * 60 - timeLeft
    const minutes = Math.max(1, Math.round(elapsed / 60))

    const supabase = createClient()

    const insertData: Record<string, unknown> = {
      user_id: userId,
      session_type: "focus",
      duration_minutes: minutes,
    }

    if (selectedSubject !== "none") {
      // Find if it's a subject or lecture
      for (const mod of modules) {
        for (const sub of mod.subjects) {
          if (sub.id === selectedSubject) {
            insertData.subject_id = sub.id
            break
          }
          for (const lec of sub.lectures) {
            if (lec.id === selectedSubject) {
              insertData.lecture_id = lec.id
              insertData.subject_id = sub.id
              break
            }
          }
        }
      }
    }

    const { data } = await supabase
      .from("study_sessions")
      .insert(insertData)
      .select("*, subjects(name), lectures(title)")
      .single()

    if (data) {
      setSessions([data, ...sessions])
    }
  }, [selectedPreset, timeLeft, selectedSubject, modules, userId, sessions])

  useEffect(() => {
    if (isFinished) {
      saveSession()
    }
  }, [isFinished, saveSession])

  const startTimer = () => {
    if (!isRunning && !isFinished) {
      startTimeRef.current = Date.now()
      setIsRunning(true)
    }
  }

  const pauseTimer = () => {
    setIsRunning(false)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setIsFinished(false)
    setTimeLeft(selectedPreset * 60)
    startTimeRef.current = null
  }

  const changePreset = (value: number) => {
    setSelectedPreset(value)
    setTimeLeft(value * 60)
    setIsRunning(false)
    setIsFinished(false)
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const progressPercent = ((selectedPreset * 60 - timeLeft) / (selectedPreset * 60)) * 100

  const allSubjectsAndLectures: { id: string; label: string; type: string }[] = []
  for (const mod of modules) {
    for (const sub of mod.subjects) {
      allSubjectsAndLectures.push({
        id: sub.id,
        label: `${mod.name} - ${sub.name}`,
        type: "subject",
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Focus Timer</h1>
        <p className="text-muted-foreground">
          Stay focused with timed study sessions using the Pomodoro technique.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-2xl font-bold">{totalMinutesToday}m</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
              <p className="text-2xl font-bold">{totalSessions}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Duration</p>
              <p className="text-2xl font-bold">{avgDuration}m</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timer */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col items-center gap-8 py-12">
              {/* Presets */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    variant={selectedPreset === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => changePreset(p.value)}
                    disabled={isRunning}
                    className="gap-1"
                  >
                    {p.label}
                    <span className="text-xs opacity-70">({p.description})</span>
                  </Button>
                ))}
              </div>

              {/* Timer display */}
              <div className="relative flex h-52 w-52 items-center justify-center">
                {/* Progress ring */}
                <svg
                  className="absolute inset-0 -rotate-90"
                  viewBox="0 0 208 208"
                >
                  <circle
                    cx="104"
                    cy="104"
                    r="96"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                  />
                  <circle
                    cx="104"
                    cy="104"
                    r="96"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 96}
                    strokeDashoffset={
                      2 * Math.PI * 96 * (1 - progressPercent / 100)
                    }
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="flex flex-col items-center">
                  <span className="font-mono text-5xl font-bold tabular-nums">
                    {minutes.toString().padStart(2, "0")}:
                    {seconds.toString().padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {isFinished
                      ? "Complete!"
                      : isRunning
                        ? "Focusing..."
                        : "Ready"}
                  </span>
                </div>
              </div>

              {/* Subject selector */}
              <Select
                value={selectedSubject}
                onValueChange={setSelectedSubject}
                disabled={isRunning}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select a subject (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject</SelectItem>
                  {allSubjectsAndLectures.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Controls */}
              <div className="flex items-center gap-3">
                {isFinished ? (
                  <Button onClick={resetTimer} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    New Session
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={isRunning ? pauseTimer : startTimer}
                      className="gap-2"
                    >
                      {isRunning ? (
                        <>
                          <Pause className="h-4 w-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Start
                        </>
                      )}
                    </Button>
                    {(isRunning || timeLeft !== selectedPreset * 60) && (
                      <Button variant="outline" onClick={resetTimer} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Session history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Timer className="h-4 w-4 text-primary" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {sessions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sessions yet. Start a focus timer!
              </p>
            ) : (
              sessions.slice(0, 10).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {s.subjects?.name || s.lectures?.title || "General Study"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {s.duration_minutes}m
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
