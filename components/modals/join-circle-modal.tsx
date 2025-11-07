"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface JoinCircleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onJoin: (code: string) => void
}

export function JoinCircleModal({ open, onOpenChange, onJoin }: JoinCircleModalProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  const handleJoin = () => {
    if (!code.trim()) {
      setError("Please enter a join code")
      return
    }

    if (code.length < 6) {
      setError("Join code must be at least 6 characters")
      return
    }

    onJoin(code)
    setCode("")
    setError("")
    onOpenChange(false)
  }

  const handleClose = () => {
    setCode("")
    setError("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a Circle</DialogTitle>
          <DialogDescription>Enter the join code to become part of a circle</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="code" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="code">Join Code</TabsTrigger>
            <TabsTrigger value="link">Join Link</TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Join Code</label>
              <Input
                placeholder="e.g., ABC123XYZ"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="transition-colors"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} className="flex-1 bg-transparent">
                Cancel
              </Button>
              <Button onClick={handleJoin} className="flex-1">
                Join Circle
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Ask the circle creator to share a link with you. You can also paste a join code in the Join Code tab.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
