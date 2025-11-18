"use client"

import { useState, useEffect } from "react"
import { Copy, Share2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ItemDetailsModal } from "@/components/modals/item-details-modal"
import { AddItemModal } from "@/components/modals/add-item-modal"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CircleDetailsPageProps {
  circleId: string
  onBack: () => void
}

interface Item {
  id: number
  title: string
  description: string
  image: string
  postedBy: { name: string; avatar: string }
  availability: string
  tags: string[]
}

const mockCircleDetails = {
  "1": {
    id: "1",
    name: "Beach House Friends",
    description: "Sharing items for our beach house getaways",
    joinCode: "ABC123XYZ",
    createdAt: "2024-10-15",
    createdBy: { name: "Sarah", avatar: "S", id: "user1" },
    membersCount: 8,
    members: [
      { id: "user1", name: "Sarah", avatar: "S", role: "creator" },
      { id: "user2", name: "John", avatar: "J", role: "member" },
      { id: "user3", name: "Emma", avatar: "E", role: "member" },
      { id: "user4", name: "Mike", avatar: "M", role: "member" },
    ],
    items: [
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
    ],
  },
}

export function CircleDetailsPage({ circleId, onBack }: CircleDetailsPageProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<"creator" | "member" | "none">("member")

  const circle = mockCircleDetails[circleId as keyof typeof mockCircleDetails]

  useEffect(() => {
    const currentUserName = localStorage.getItem("sharecircle_user_name")
    const userRole = circle?.members.find((m) => m.name === currentUserName)?.role || "member"
    setCurrentUserRole(userRole as "creator" | "member" | "none")
  }, [circle])

  if (!circle) {
    return (
      <div className="p-8">
        <Button onClick={onBack} variant="outline" className="mb-4 bg-transparent">
          ← Back to Circles
        </Button>
        <Alert variant="destructive">
          <AlertDescription>Circle not found</AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8 py-3 px-6">
      <Button onClick={onBack} variant="outline" className="mb-6 bg-transparent">
        ← Back to Circles
      </Button>

      {/* Circle Header */}
      <div className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-8 border border-primary/20">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">{circle.name}</h1>
            <p className="text-muted-foreground">{circle.description}</p>
          </div>
          <Button className="gap-2 bg-transparent" variant="outline">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="dark:bg-white/5 rounded p-4 border border-border bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Members</p>
            <p className="text-2xl font-semibold text-foreground">{circle.membersCount}</p>
          </div>
          <div className="dark:bg-white/5 rounded p-4 border border-border bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Items Shared</p>
            <p className="text-2xl font-semibold text-foreground">{circle.items.length}</p>
          </div>
          <div className="dark:bg-white/5 rounded p-4 border border-border bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Join Code</p>
            <div className="flex items-center gap-2">
              <code className="font-mono font-semibold text-foreground">{circle.joinCode}</code>
              <button
                onClick={() => handleCopyLink(circle.joinCode)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <Copy className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="dark:bg-white/5 rounded p-4 border border-border bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Created</p>
            <p className="text-sm font-semibold text-foreground">{circle.createdAt}</p>
          </div>
        </div>

        {/* Share Link */}
        <div className="dark:bg-white/5 rounded p-4 border border-border flex items-center justify-between bg-muted text-muted-foreground">
          <p className="text-sm text-muted-foreground">Share Link:</p>
          <button
            onClick={() => handleCopyLink(`https://sharecircle.com/join/${circle.joinCode}`)}
            className="text-primary hover:underline text-sm font-medium"
          >
            {copied ? "Copied!" : `sharecircle.com/join/${circle.joinCode}`}
          </button>
        </div>
      </div>

      {/* Members Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Circle Members</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {circle.members.map((member) => (
            <div
              key={member.id}
              className="bg-card border border-border rounded-lg p-4 flex flex-col items-center text-center"
            >
              <Avatar className="w-12 h-12 mb-3 bg-primary">
                <AvatarFallback className="text-primary-foreground font-semibold">{member.avatar}</AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-card-foreground">{member.name}</h3>
              <p className="text-xs text-muted-foreground capitalize">
                {member.role === "creator" ? "Creator" : "Member"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Items Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-foreground">Shared Items</h2>
          {currentUserRole !== "none" && (
            <Button onClick={() => setShowAddItem(true)} className="gap-2" size="sm">
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          )}
        </div>

        {circle.items.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">No items shared yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {circle.items.map((item) => (
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
        )}
      </div>

      {/* Modals */}
      <ItemDetailsModal item={selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)} />
      {currentUserRole !== "none" && <AddItemModal open={showAddItem} onOpenChange={setShowAddItem} />}
    </div>
  )
}
