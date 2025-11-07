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
import { Label } from "@/components/ui/label"

interface EditItemDialogProps {
  isOpen: boolean
  itemTitle: string
  itemCircle: string
  onConfirm: (title: string, circle: string) => void
  onCancel: () => void
}

export function EditItemDialog({ isOpen, itemTitle, itemCircle, onConfirm, onCancel }: EditItemDialogProps) {
  const [title, setTitle] = useState(itemTitle)
  const [circle, setCircle] = useState(itemCircle)

  const handleConfirm = () => {
    onConfirm(title, circle)
    setTitle(itemTitle)
    setCircle(itemCircle)
  }

  const handleCancel = () => {
    setTitle(itemTitle)
    setCircle(itemCircle)
    onCancel()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>Update the details of your item below.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item-title">Item Title</Label>
            <Input
              id="item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter item title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-circle">Circle</Label>
            <Input
              id="item-circle"
              value={circle}
              onChange={(e) => setCircle(e.target.value)}
              placeholder="Enter circle name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
