"use client"

import { X, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Item {
  id: number
  title: string
  description: string
  image: string
  postedBy: { name: string; avatar: string }
  availability: string
  tags: string[]
}

interface ItemDetailsModalProps {
  item: Item | null
  onOpenChange: (open: boolean) => void
}

export function ItemDetailsModal({ item, onOpenChange }: ItemDetailsModalProps) {
  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg border border-border w-full max-w-md max-h-96 overflow-y-auto">
        <div className="relative">
          <img src={item.image || "/placeholder.svg"} alt={item.title} className="w-full h-40 object-cover" />
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-2 right-2 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">{item.title}</h2>
          <p className="text-muted-foreground mb-4">{item.description}</p>

          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary text-primary-foreground">{item.postedBy.avatar}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{item.postedBy.name}</p>
              <p className="text-sm text-muted-foreground">{item.availability}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2 bg-transparent" onClick={() => onOpenChange(false)}>
              <MessageCircle className="w-4 h-4" />
              Chat
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Request Item
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
