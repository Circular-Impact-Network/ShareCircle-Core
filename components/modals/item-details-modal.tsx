"use client"

import { MessageCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

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
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden p-0">
        <div className="relative h-56 w-full overflow-hidden">
          <img
            src={item.image || "/placeholder.svg"}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="space-y-5 px-6 pb-6 pt-4">
          <DialogHeader className="items-start text-left space-y-2">
            <DialogTitle className="text-2xl">{item.title}</DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-muted-foreground">
              {item.description}
            </DialogDescription>
          </DialogHeader>

          {!!item.tags?.length && (
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="uppercase tracking-wide text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{item.postedBy.avatar}</AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold leading-tight">{item.postedBy.name}</p>
              <p className="text-xs text-muted-foreground">{item.availability}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 gap-2 bg-transparent" onClick={() => onOpenChange(false)}>
              <MessageCircle className="h-4 w-4" />
              Chat
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Request Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
