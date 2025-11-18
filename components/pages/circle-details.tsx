"use client"

import { useState } from "react"
import { Copy, Share2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ItemDetailsModal } from "@/components/modals/item-details-modal"
import { AddItemModal } from "@/components/modals/add-item-modal"

interface Item {
  id: number
  title: string
  description: string
  image: string
  postedBy: { name: string; avatar: string }
  availability: string
  tags: string[]
}

const mockItems = [
  {
    id: 1,
    title: "Tent",
    description: "Coleman 4-person camping tent",
    image: "/camping-tent.png",
    postedBy: { name: "Sarah", avatar: "S" },
    availability: "Available",
    tags: ["Camping", "Outdoor"],
  },
  {
    id: 2,
    title: "Projector",
    description: "HD portable projector with case",
    image: "/home-theater-projector.png",
    postedBy: { name: "Mike", avatar: "M" },
    availability: "Lent Out",
    tags: ["Electronics", "Entertainment"],
  },
  {
    id: 3,
    title: "Bike Rack",
    description: "Roof-mounted bike rack for 2 bikes",
    image: "/bike-rack.jpg",
    postedBy: { name: "Emma", avatar: "E" },
    availability: "Available",
    tags: ["Car", "Sports"],
  },
]

interface CircleDetailsProps {
  circleName?: string
}

export function CircleDetails({ circleName = "Beach House Friends" }: CircleDetailsProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://sharecircle.com/join/ABC123")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8">
      <div className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-8 border border-primary/20">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">{circleName}</h1>
            <p className="text-muted-foreground">Created by Sarah • Oct 15, 2024</p>
          </div>
          <Button className="gap-2 bg-transparent" variant="outline">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/50 dark:bg-white/5 rounded p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Join Code</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-lg font-semibold text-foreground">ABC123XYZ</code>
              <button onClick={handleCopyLink} className="p-2 hover:bg-muted rounded transition-colors">
                <Copy className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="bg-white/50 dark:bg-white/5 rounded p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Share Link</p>
            <button onClick={handleCopyLink} className="text-primary hover:underline text-sm font-medium">
              {copied ? "Copied!" : "sharecircle.com/join/ABC123"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-foreground">Shared Items</h2>
        <Button onClick={() => setShowAddItem(true)} className="gap-2" size="sm">
          <Plus className="w-4 h-4" />
          Add Item
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
          >
            <div className="h-40 bg-muted overflow-hidden">
              <img
                src={item.image || "/placeholder.svg"}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              <div className="flex gap-1 mt-3 flex-wrap">
                {item.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {item.postedBy.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{item.postedBy.name}</span>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    item.availability === "Available"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                  }`}
                >
                  {item.availability}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ItemDetailsModal item={selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)} />
      <AddItemModal open={showAddItem} onOpenChange={setShowAddItem} />
    </div>
  )
}
