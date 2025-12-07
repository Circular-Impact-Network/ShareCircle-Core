"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, Copy, Check, PartyPopper } from "lucide-react"

interface CircleMemberPreview {
  id: string
  name: string | null
  image: string | null
}

interface Circle {
  id: string
  name: string
  description: string | null
  inviteCode: string
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string | null
    image: string | null
  }
  membersCount: number
  userRole: "ADMIN" | "MEMBER" | null
  memberPreviews: CircleMemberPreview[]
}

interface CreateCircleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCircleCreated?: (circle: Circle) => void
}

export function CreateCircleModal({ open, onOpenChange, onCircleCreated }: CreateCircleModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [createdCircle, setCreatedCircle] = useState<Circle | null>(null)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please enter a circle name")
      return
    }

    if (name.trim().length > 100) {
      setError("Circle name must be less than 100 characters")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create circle")
      }

      const circle = await response.json()
      setCreatedCircle(circle)
    } catch (err) {
      console.error("Error creating circle:", err)
      setError(err instanceof Error ? err.message : "Failed to create circle. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (text: string, type: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Silently fail
    }
  }

  const handleClose = () => {
    if (createdCircle && onCircleCreated) {
      onCircleCreated({
        ...createdCircle,
        updatedAt: createdCircle.updatedAt || createdCircle.createdAt,
        memberPreviews: createdCircle.createdBy
          ? [
              {
                id: createdCircle.createdBy.id,
                name: createdCircle.createdBy.name,
                image: createdCircle.createdBy.image,
              },
            ]
          : [],
      })
    }
    // Reset state
    setName("")
    setDescription("")
    setError("")
    setCreatedCircle(null)
    setCopied(null)
    onOpenChange(false)
  }

  const getShareUrl = () => {
    if (typeof window !== "undefined" && createdCircle) {
      return `${window.location.origin}/join?code=${createdCircle.inviteCode}`
    }
    return ""
  }

  // Render success state
  if (createdCircle) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <PartyPopper className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center">Circle Created!</DialogTitle>
            <DialogDescription className="text-center">
              Your circle &quot;{createdCircle.name}&quot; is ready. Share the invite code with others to let them join.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Invite Code */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <Label className="text-xs text-muted-foreground">Invite Code</Label>
              <div className="mt-2 flex items-center justify-between gap-2">
                <code className="font-mono text-2xl font-bold tracking-wider break-all">
                  {createdCircle.inviteCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(createdCircle.inviteCode, "code")}
                >
                  {copied === "code" ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Share Link */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <Label className="text-xs text-muted-foreground">Share Link</Label>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all text-sm text-primary">{getShareUrl()}</code>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleCopy(getShareUrl(), "link")}
                >
                  {copied === "link" ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Render create form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Circle</DialogTitle>
          <DialogDescription>
            Start a new circle to share items with friends and communities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Circle Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Beach House Friends"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError("")
              }}
              disabled={isLoading}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">{name.length}/100 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's this circle about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={isLoading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Circle"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
