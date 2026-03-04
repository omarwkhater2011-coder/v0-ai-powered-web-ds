"use client"

import { useState } from "react"
import type { User } from "@supabase/supabase-js"
import {
  User as UserIcon,
  Clock,
  BrainCircuit,
  Target,
  ClipboardCheck,
  Save,
  Mail,
  Calendar,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"

interface ProfileContentProps {
  user: User
  profile: { display_name: string; avatar_url: string | null } | null
  stats: {
    totalStudyMinutes: number
    totalSessions: number
    cardsReviewed: number
    cardsMastered: number
    mcqAttempts: number
    mcqCorrect: number
    testsTaken: number
    avgTestScore: number
  }
}

export function ProfileContent({ user, profile, stats }: ProfileContentProps) {
  const [displayName, setDisplayName] = useState(
    profile?.display_name || user.email?.split("@")[0] || ""
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: displayName })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const totalHours = Math.round((stats.totalStudyMinutes / 60) * 10) / 10
  const mcqAccuracy =
    stats.mcqAttempts > 0
      ? Math.round((stats.mcqCorrect / stats.mcqAttempts) * 100)
      : 0
  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account and view your study statistics.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <UserIcon className="h-10 w-10 text-primary" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold">{displayName || "Student"}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Member since {memberSince}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit profile */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={user.email ?? ""}
                    disabled
                    className="max-w-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed.
                </p>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Label htmlFor="displayName">Display Name</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="max-w-sm"
                  />
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : saved ? "Saved!" : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Study stats */}
      <h2 className="text-lg font-semibold">Your Study Statistics</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Study Time</p>
              <p className="text-2xl font-bold">{totalHours}h</p>
              <p className="text-xs text-muted-foreground">
                {stats.totalSessions} sessions
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Flashcards</p>
              <p className="text-2xl font-bold">{stats.cardsMastered}</p>
              <p className="text-xs text-muted-foreground">
                mastered of {stats.cardsReviewed} reviewed
              </p>
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
              <p className="text-xs text-muted-foreground">
                {stats.mcqCorrect}/{stats.mcqAttempts} correct
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tests</p>
              <p className="text-2xl font-bold">{stats.testsTaken}</p>
              <p className="text-xs text-muted-foreground">
                avg score: {stats.avgTestScore}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
