"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FileText,
  Sparkles,
  Loader2,
  Highlighter,
  Save,
  BookOpen,
  Plus,
  Bold,
  Heading1,
  Heading2,
  Type,
  X,
  PenLine,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface NotesTabProps {
  notes: { id: string; title: string; content: Record<string, unknown> }[]
  lectureId: string
  userId: string
}

interface Highlight {
  noteId: string
  text: string
  color: string
  createdAt: string
}

interface Annotation {
  noteId: string
  text: string
  note: string
  createdAt: string
}

interface OwnNoteBlock {
  id: string
  type: "heading1" | "heading2" | "paragraph"
  text: string
  bold?: boolean
  highlight?: boolean
}

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "bg-yellow-200/60 dark:bg-yellow-500/30" },
  { name: "Green", value: "bg-emerald-200/60 dark:bg-emerald-500/30" },
  { name: "Blue", value: "bg-blue-200/60 dark:bg-blue-500/30" },
  { name: "Pink", value: "bg-pink-200/60 dark:bg-pink-500/30" },
]

export function NotesTab({ notes, lectureId, userId }: NotesTabProps) {
  const [aiOutput, setAiOutput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAction, setAiAction] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState("")
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value)
  const [highlights, setHighlights] = useState<Record<string, Highlight[]>>({})
  const [annotations, setAnnotations] = useState<Record<string, Annotation[]>>({})
  const [annotationInput, setAnnotationInput] = useState<{ noteId: string; text: string } | null>(null)
  const [annotationText, setAnnotationText] = useState("")
  const [saving, setSaving] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)

  // Own notes editor state
  const [showOwnNotes, setShowOwnNotes] = useState(false)
  const [ownNoteBlocks, setOwnNoteBlocks] = useState<OwnNoteBlock[]>([
    { id: "1", type: "heading1", text: "", bold: false, highlight: false },
  ])
  const [activeBlockType, setActiveBlockType] = useState<OwnNoteBlock["type"]>("paragraph")
  const [ownNotesSaving, setOwnNotesSaving] = useState(false)

  // Load saved annotations from Supabase
  useEffect(() => {
    if (!userId || notes.length === 0) return
    const supabase = createClient()
    const loadAnnotations = async () => {
      const { data } = await supabase
        .from("user_notes_annotations")
        .select("*")
        .eq("user_id", userId)
        .in("note_id", notes.map((n) => n.id))
      if (data) {
        const hMap: Record<string, Highlight[]> = {}
        const aMap: Record<string, Annotation[]> = {}
        for (const row of data) {
          hMap[row.note_id] = (row.highlights as Highlight[]) || []
          aMap[row.note_id] = (row.annotations as Annotation[]) || []
        }
        setHighlights(hMap)
        setAnnotations(aMap)
      }
    }
    loadAnnotations()
  }, [userId, notes])

  const saveAnnotationsToDb = useCallback(
    async (noteId: string, newHighlights: Highlight[], newAnnotations: Annotation[]) => {
      if (!userId) return
      setSaving(true)
      const supabase = createClient()
      await supabase.from("user_notes_annotations").upsert(
        {
          user_id: userId,
          note_id: noteId,
          highlights: newHighlights,
          annotations: newAnnotations,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,note_id" }
      )
      setSaving(false)
    },
    [userId]
  )

  const handleTextSelection = (noteId: string) => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (text && text.length > 0) {
      setSelectedText(text)
      setActiveNoteId(noteId)
    }
  }

  const addHighlight = () => {
    if (!selectedText || !activeNoteId) return
    const newHighlight: Highlight = {
      noteId: activeNoteId,
      text: selectedText,
      color: highlightColor,
      createdAt: new Date().toISOString(),
    }
    const noteHighlights = [...(highlights[activeNoteId] || []), newHighlight]
    const updated = { ...highlights, [activeNoteId]: noteHighlights }
    setHighlights(updated)
    saveAnnotationsToDb(activeNoteId, noteHighlights, annotations[activeNoteId] || [])
    setSelectedText("")
    window.getSelection()?.removeAllRanges()
  }

  const addAnnotation = () => {
    if (!annotationInput || !annotationText.trim()) return
    const newAnnotation: Annotation = {
      noteId: annotationInput.noteId,
      text: annotationInput.text,
      note: annotationText,
      createdAt: new Date().toISOString(),
    }
    const noteAnnotations = [...(annotations[annotationInput.noteId] || []), newAnnotation]
    const updated = { ...annotations, [annotationInput.noteId]: noteAnnotations }
    setAnnotations(updated)
    saveAnnotationsToDb(
      annotationInput.noteId,
      highlights[annotationInput.noteId] || [],
      noteAnnotations
    )
    setAnnotationInput(null)
    setAnnotationText("")
    setSelectedText("")
  }

  // Parse note content into sections for PDF-style rendering
  const parseNoteContent = (content: Record<string, unknown>) => {
    if (typeof content === "string") {
      try {
        return JSON.parse(content)
      } catch {
        return { raw: content }
      }
    }
    return content
  }

  const renderNoteContentPDF = (note: { id: string; content: Record<string, unknown> }) => {
    const parsed = parseNoteContent(note.content)
    const noteHighlights = highlights[note.id] || []

    const applyHighlights = (text: string) => {
      if (noteHighlights.length === 0) return <span>{text}</span>
      const parts: { text: string; className?: string }[] = []
      let remaining = text
      for (const h of noteHighlights) {
        const idx = remaining.indexOf(h.text)
        if (idx >= 0) {
          if (idx > 0) parts.push({ text: remaining.slice(0, idx) })
          parts.push({ text: h.text, className: h.color })
          remaining = remaining.slice(idx + h.text.length)
        }
      }
      if (remaining) parts.push({ text: remaining })
      return (
        <>
          {parts.map((part, i) =>
            part.className ? (
              <mark key={i} className={cn("rounded px-0.5", part.className)}>{part.text}</mark>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </>
      )
    }

    // If the content has sections (our standard format)
    if (parsed.sections && Array.isArray(parsed.sections)) {
      return (
        <div className="flex flex-col gap-4">
          {parsed.sections.map((section: { heading: string; body: string }, i: number) => (
            <div key={i} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-foreground">{applyHighlights(section.heading)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{applyHighlights(section.body)}</p>
            </div>
          ))}
        </div>
      )
    }

    // Fallback: raw text
    const raw = typeof note.content === "string" ? note.content : JSON.stringify(note.content, null, 2)
    return <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{applyHighlights(raw)}</p>
  }

  const handleAiAction = async (action: string, text?: string) => {
    const inputText = text || ""
    if (!inputText.trim()) return
    setAiLoading(true)
    setAiAction(action)
    try {
      const res = await fetch("/api/ai/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, action }),
      })
      const data = await res.json()
      setAiOutput(data.result || "No response from AI.")
    } catch {
      setAiOutput("Error processing your request.")
    } finally {
      setAiLoading(false)
      setAiAction(null)
    }
  }

  // Own notes editor functions
  const addBlock = () => {
    const newBlock: OwnNoteBlock = {
      id: Date.now().toString(),
      type: activeBlockType,
      text: "",
      bold: false,
      highlight: false,
    }
    setOwnNoteBlocks([...ownNoteBlocks, newBlock])
  }

  const updateBlock = (id: string, updates: Partial<OwnNoteBlock>) => {
    setOwnNoteBlocks(ownNoteBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)))
  }

  const removeBlock = (id: string) => {
    if (ownNoteBlocks.length <= 1) return
    setOwnNoteBlocks(ownNoteBlocks.filter((b) => b.id !== id))
  }

  const saveOwnNotes = async () => {
    setOwnNotesSaving(true)
    const supabase = createClient()
    const content = { blocks: ownNoteBlocks }
    await supabase.from("notes").insert({
      lecture_id: lectureId,
      title: `My Notes - ${new Date().toLocaleDateString()}`,
      content,
      order_index: notes.length + 1,
    })
    setOwnNotesSaving(false)
    setShowOwnNotes(false)
    // Refresh page to show new note
    window.location.reload()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Highlight toolbar */}
      {selectedText && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <span className="text-xs font-medium text-muted-foreground">Selected:</span>
            <span className="max-w-xs truncate text-sm font-medium">
              {'"'}{selectedText.slice(0, 60)}{selectedText.length > 60 ? "..." : ""}{'"'}
            </span>
            <div className="flex items-center gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setHighlightColor(c.value)}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-transform",
                    c.value.replace("/60", "").replace("/30", ""),
                    highlightColor === c.value ? "scale-125 border-foreground" : "border-transparent"
                  )}
                  aria-label={`Highlight ${c.name}`}
                />
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={addHighlight} className="gap-1.5">
              <Highlighter className="h-3.5 w-3.5" />
              Highlight
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (activeNoteId) setAnnotationInput({ noteId: activeNoteId, text: selectedText })
              }}
              className="gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Comment
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAiAction("explain", selectedText)}
              disabled={aiLoading}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Explain
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAiAction("simplify", selectedText)}
              disabled={aiLoading}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Simplify
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Annotation input */}
      {annotationInput && (
        <Card className="border-primary/30">
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-xs text-muted-foreground">
              Add comment for: <strong>{'"'}{annotationInput.text.slice(0, 80)}{'"'}</strong>
            </p>
            <Textarea
              placeholder="Write your comment..."
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addAnnotation} disabled={!annotationText.trim()}>
                <Save className="mr-1 h-3.5 w-3.5" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAnnotationInput(null); setAnnotationText("") }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Output */}
      {aiOutput && (
        <Card className="border-primary/20">
          <CardContent className="flex flex-col gap-2 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-primary">AI Response</p>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setAiOutput("")}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{aiOutput}</p>
          </CardContent>
        </Card>
      )}

      {/* Add own notes button */}
      {!showOwnNotes && (
        <Button
          variant="outline"
          onClick={() => setShowOwnNotes(true)}
          className="gap-2 self-start"
        >
          <Plus className="h-4 w-4" />
          Add Your Own Notes
        </Button>
      )}

      {/* Own notes editor */}
      {showOwnNotes && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <PenLine className="h-4 w-4 text-primary" />
                Your Notes
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowOwnNotes(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Formatting toolbar */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/50 p-1.5">
              <Button
                size="sm"
                variant={activeBlockType === "heading1" ? "default" : "ghost"}
                onClick={() => setActiveBlockType("heading1")}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Heading1 className="h-3.5 w-3.5" />
                H1
              </Button>
              <Button
                size="sm"
                variant={activeBlockType === "heading2" ? "default" : "ghost"}
                onClick={() => setActiveBlockType("heading2")}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Heading2 className="h-3.5 w-3.5" />
                H2
              </Button>
              <Button
                size="sm"
                variant={activeBlockType === "paragraph" ? "default" : "ghost"}
                onClick={() => setActiveBlockType("paragraph")}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Type className="h-3.5 w-3.5" />
                Text
              </Button>
              <Separator orientation="vertical" className="mx-1 h-5" />
              <Button
                size="sm"
                variant="ghost"
                onClick={addBlock}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Block
              </Button>
            </div>

            {/* Blocks */}
            <div className="flex flex-col gap-2">
              {ownNoteBlocks.map((block) => (
                <div key={block.id} className="group relative flex items-start gap-2">
                  <div className="flex-1">
                    {block.type === "heading1" ? (
                      <input
                        type="text"
                        placeholder="Heading 1..."
                        value={block.text}
                        onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                        className={cn(
                          "w-full border-none bg-transparent text-xl font-bold outline-none placeholder:text-muted-foreground/50",
                          block.bold && "font-extrabold",
                          block.highlight && "bg-yellow-200/60 dark:bg-yellow-500/30"
                        )}
                      />
                    ) : block.type === "heading2" ? (
                      <input
                        type="text"
                        placeholder="Heading 2..."
                        value={block.text}
                        onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                        className={cn(
                          "w-full border-none bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/50",
                          block.bold && "font-extrabold",
                          block.highlight && "bg-yellow-200/60 dark:bg-yellow-500/30"
                        )}
                      />
                    ) : (
                      <Textarea
                        placeholder="Write your notes here..."
                        value={block.text}
                        onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                        className={cn(
                          "min-h-[60px] resize-y border-none bg-transparent text-sm shadow-none focus-visible:ring-0",
                          block.bold && "font-bold",
                          block.highlight && "bg-yellow-200/60 dark:bg-yellow-500/30"
                        )}
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant={block.bold ? "default" : "ghost"}
                      className="h-6 w-6 p-0"
                      onClick={() => updateBlock(block.id, { bold: !block.bold })}
                    >
                      <Bold className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={block.highlight ? "default" : "ghost"}
                      className="h-6 w-6 p-0"
                      onClick={() => updateBlock(block.id, { highlight: !block.highlight })}
                    >
                      <Highlighter className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeBlock(block.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={saveOwnNotes} disabled={ownNotesSaving} className="gap-2 self-end">
              {ownNotesSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              Save Notes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing lecture notes - PDF style */}
      {notes.length > 0 ? (
        notes.map((note) => {
          const parsed = parseNoteContent(note.content)
          const isOwnNote = parsed.blocks && Array.isArray(parsed.blocks)

          return (
            <Card key={note.id} className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  {note.title}
                  {(highlights[note.id]?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {highlights[note.id].length} highlights
                    </Badge>
                  )}
                  {saving && activeNoteId === note.id && (
                    <Loader2 className="ml-1 h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {isOwnNote ? (
                  // Render own notes blocks
                  <div className="flex flex-col gap-3">
                    {parsed.blocks.map((block: OwnNoteBlock, i: number) => (
                      <div key={i}>
                        {block.type === "heading1" && (
                          <h2 className={cn("text-xl font-bold", block.bold && "font-extrabold", block.highlight && "bg-yellow-200/60 dark:bg-yellow-500/30 inline")}>{block.text}</h2>
                        )}
                        {block.type === "heading2" && (
                          <h3 className={cn("text-lg font-semibold", block.bold && "font-extrabold", block.highlight && "bg-yellow-200/60 dark:bg-yellow-500/30 inline")}>{block.text}</h3>
                        )}
                        {block.type === "paragraph" && (
                          <p className={cn("text-sm leading-relaxed text-muted-foreground", block.bold && "font-bold", block.highlight && "bg-yellow-200/60 dark:bg-yellow-500/30 inline")}>{block.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Render structured lecture notes PDF-style
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none cursor-text"
                    onMouseUp={() => handleTextSelection(note.id)}
                  >
                    {renderNoteContentPDF(note)}
                  </div>
                )}

                {/* Annotations */}
                {(annotations[note.id]?.length ?? 0) > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <p className="mb-2 text-xs font-medium text-primary">Comments</p>
                    <div className="flex flex-col gap-2">
                      {annotations[note.id].map((ann, i) => (
                        <div key={i} className="rounded-lg border bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">
                            On: {'"'}{ann.text.slice(0, 60)}{ann.text.length > 60 ? "..." : ""}{'"'}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed">{ann.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No lecture notes have been added yet. Click "Add Your Own Notes" to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
