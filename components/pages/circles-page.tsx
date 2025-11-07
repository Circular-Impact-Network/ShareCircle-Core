"use client"

import { useState } from "react"
import { Plus, Link2, Users, Calendar, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreateCircleModal } from "@/components/modals/create-circle-modal"
import { JoinCircleModal } from "@/components/modals/join-circle-modal"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

const mockCircles = [
  {
    id: 1,
    name: "Beach House Friends",
    membersCount: 8,
    createdAt: "2024-10-15",
    createdBy: { name: "Sarah", avatar: "S" },
    description: "Sharing items for our beach house",
  },
  {
    id: 2,
    name: "Hiking Club",
    membersCount: 12,
    createdAt: "2024-09-20",
    createdBy: { name: "Mike", avatar: "M" },
    description: "Equipment and gear sharing",
  },
  {
    id: 3,
    name: "Book Club",
    membersCount: 5,
    createdAt: "2024-11-01",
    createdBy: { name: "Emma", avatar: "E" },
    description: "Books and reading resources",
  },
  {
    id: 4,
    name: "Party Planning",
    membersCount: 10,
    createdAt: "2024-10-01",
    createdBy: { name: "Alex", avatar: "A" },
    description: "Decorations and party supplies",
  },
]

interface CirclesPageProps {
  onSelectCircle: (id: string) => void
}

export function CirclesPage({ onSelectCircle }: CirclesPageProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const { toast } = useToast()

  const handleJoinCircle = (code: string) => {
    toast({
      title: "Success!",
      description: `Successfully joined circle with code ${code}`,
    })
    setShowJoinModal(false)
  }

  return (
    <div className="p-8 px-6 py-3">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">My Circles</h1>
        <p className="text-muted-foreground">Join communities and share items with friends</p>
      </div>

      <div className="flex gap-4 mb-8">
        <Button
          onClick={() => setShowCreateModal(true)}
          className="gap-2 bg-primary hover:bg-primary/90 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Create Circle
        </Button>
        <Button
          onClick={() => setShowJoinModal(true)}
          variant="outline"
          className="gap-2 bg-transparent transition-all duration-200"
        >
          <Link2 className="w-4 h-4" />
          Join via Code
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockCircles.map((circle) => (
          <div
            key={circle.id}
            className="bg-card rounded-lg border border-border p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer group"
            onClick={() => onSelectCircle(circle.id.toString())}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground group-hover:text-primary transition-colors duration-200">
                  {circle.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{circle.description}</p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{circle.membersCount} members</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Created {circle.createdAt}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {circle.createdBy.avatar}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">{circle.createdBy.name}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </div>
        ))}
      </div>

      <CreateCircleModal open={showCreateModal} onOpenChange={setShowCreateModal} />
      <JoinCircleModal open={showJoinModal} onOpenChange={setShowJoinModal} onJoin={handleJoinCircle} />
    </div>
  )
}
