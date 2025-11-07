"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface CreateCircleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateCircleModal({ open, onOpenChange }: CreateCircleModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Circle</DialogTitle>
          <DialogDescription>Start a new circle to share items with friends and communities</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Circle Name</label>
            <Input
              placeholder="e.g., Beach House Friends"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description</label>
            <Textarea
              placeholder="What's this circle about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none transition-colors"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 transition-all duration-200"
            >
              Cancel
            </Button>
            <Button onClick={() => onOpenChange(false)} className="flex-1 transition-all duration-200">
              Create Circle
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
