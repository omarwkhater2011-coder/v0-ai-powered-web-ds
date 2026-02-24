"use client"

import { useMemo } from "react"
import {
  Clock,
  Target,
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

interface AnalyticsContentProps {
  studySessions: {
    id: string
    duration_minutes: number
    session_type: string
    created_at: string
    subjects: { name: string } | null
    lectures: { title: string } | null
  }[]
  mcqAttempts: {
    id: string
    is_correct: boolean
    created_at: string
    mcqs: {
      question: string
      lecture_id: string
      lectures: { title: string; subject_id: string; subjects: { name: string } }
    }
  }[]
  flashcardProgress: {
    id: string
    repetitions: number
    ease_factor: number
    interval_days: number
    flashcards: { front: string; lecture_id: string; lectures: { title: string } }
  }[]
  testSessions: {
    id: string
    title: string
    score: number
    total_questions: number
    correct_answers: number
    duration_seconds: number
    created_at: string
  }[]
  weakTopics: {
    id: string
    topic: string
    accuracy: number
    subjects: { name: string } | null
    lectures: { title: string } | null
  }[]
  modules: { id: string; name: string; subjects: { id: string; name: string }[] }[]
}

export function AnalyticsContent({
  studySessions,
  mcqAttempts,
  flashcardProgress,
  testSessions,
  weakTopics,
  modules,
}: AnalyticsContentProps) {
  const totalStudyMinutes = studySessions.reduce(
    (a, s) => a + s.duration_minutes,
    0
  )
  const totalHours = Math.round((totalStudyMinutes / 60) * 10) / 10
  const mcqAccuracy =
    mcqAttempts.length > 0
      ? Math.round(
          (mcqAttempts.filter((a) => a.is_correct).length / mcqAttempts.length) *
            100
        )
      : 0
  const masteredCards = flashcardProgress.filter(
    (p) => p.repetitions >= 3
  ).length
  const avgTestScore =
    testSessions.length > 0
      ? Math.round(
          testSessions.reduce((a, t) => a + t.score, 0) / testSessions.length
        )
      : 0

  // Study time by day (last 7 days)
  const dailyStudy = useMemo(() => {
    const days: Record<string, number> = {}
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString("en-US", { weekday: "short" })
      days[key] = 0
    }
    for (const s of studySessions) {
      const d = new Date(s.created_at)
      const diff = Math.floor(
        (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diff < 7) {
        const key = d.toLocaleDateString("en-US", { weekday: "short" })
        if (key in days) {
          days[key] += s.duration_minutes
        }
      }
    }
    return Object.entries(days).map(([name, minutes]) => ({ name, minutes }))
  }, [studySessions])

  // MCQ accuracy by subject
  const subjectAccuracy = useMemo(() => {
    const bySubject: Record<string, { correct: number; total: number }> = {}
    for (const a of mcqAttempts) {
      const name = a.mcqs?.lectures?.subjects?.name || "Unknown"
      if (!bySubject[name]) bySubject[name] = { correct: 0, total: 0 }
      bySubject[name].total++
      if (a.is_correct) bySubject[name].correct++
    }
    return Object.entries(bySubject).map(([name, data]) => ({
      name: name.length > 15 ? name.slice(0, 15) + "..." : name,
      accuracy: Math.round((data.correct / data.total) * 100),
    }))
  }, [mcqAttempts])

  // Test score trend
  const scoreTrend = useMemo(() => {
    return [...testSessions]
      .reverse()
      .map((t, i) => ({
        name: `Test ${i + 1}`,
        score: Math.round(t.score),
      }))
  }, [testSessions])

  // Flashcard mastery distribution
  const flashcardDist = useMemo(() => {
    const newCards = flashcardProgress.filter((p) => p.repetitions === 0).length
    const learning = flashcardProgress.filter(
      (p) => p.repetitions > 0 && p.repetitions < 3
    ).length
    const mastered = flashcardProgress.filter(
      (p) => p.repetitions >= 3
    ).length
    return [
      { name: "New", value: newCards, fill: "hsl(var(--chart-4))" },
      { name: "Learning", value: learning, fill: "hsl(var(--chart-2))" },
      { name: "Mastered", value: mastered, fill: "hsl(var(--chart-1))" },
    ].filter((d) => d.value > 0)
  }, [flashcardProgress])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Track your study progress and identify areas for improvement.
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Study Time</p>
              <p className="text-2xl font-bold">{totalHours}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MCQ Accuracy</p>
              <p className="text-2xl font-bold">{mcqAccuracy}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cards Mastered</p>
              <p className="text-2xl font-bold">{masteredCards}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Test Score</p>
              <p className="text-2xl font-bold">{avgTestScore}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily study time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Study Time This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyStudy.some((d) => d.minutes > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyStudy}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value} min`, "Study Time"]}
                  />
                  <Bar
                    dataKey="minutes"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No study sessions this week. Start a focus timer!
              </div>
            )}
          </CardContent>
        </Card>

        {/* MCQ accuracy by subject */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Target className="h-4 w-4 text-primary" />
              MCQ Accuracy by Subject
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectAccuracy.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={subjectAccuracy} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value}%`, "Accuracy"]}
                  />
                  <Bar
                    dataKey="accuracy"
                    fill="hsl(var(--chart-2))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No MCQ attempts yet. Take a quiz!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test score trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Test Score Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={scoreTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value}%`, "Score"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No tests taken yet. Try a Smart Test!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flashcard mastery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BrainCircuit className="h-4 w-4 text-primary" />
              Flashcard Mastery
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flashcardDist.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={flashcardDist}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                    >
                      {flashcardDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2">
                  {flashcardDist.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="text-sm">
                        {d.name}: {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[140px] items-center justify-center text-sm text-muted-foreground">
                No flashcard reviews yet. Start reviewing!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weak Topics */}
      {weakTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Weak Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {weakTopics.map((wt) => (
              <div key={wt.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{wt.topic}</span>
                    {wt.subjects && (
                      <Badge variant="outline" className="text-xs">
                        {wt.subjects.name}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(wt.accuracy * 100)}%
                  </span>
                </div>
                <Progress value={wt.accuracy * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
