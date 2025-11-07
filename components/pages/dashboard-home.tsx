"use client"
import { useEffect, useState } from "react"
import { Plus, MapPin, Users, TrendingUp, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DashboardHomeProps {
  onNavigate: (page: string) => void
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const [userName, setUserName] = useState("User")

  useEffect(() => {
    const name = localStorage.getItem("sharecircle_user_name") || "User"
    setUserName(name.charAt(0).toUpperCase() + name.slice(1))
  }, [])

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
        <div className="max-w-6xl mx-auto px-8 py-12">
          <h1 className="text-4xl font-display font-bold mb-2">Welcome Back, {userName}!</h1>
          <p className="text-muted-foreground text-lg">Share what you have, borrow what you need</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Quick Stats */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-muted-foreground text-sm">Active Circles</span>
              </div>
              <p className="text-3xl font-bold">3</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-muted-foreground text-sm">My Listings</span>
              </div>
              <p className="text-3xl font-bold">5</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-5 h-5 text-primary" />
                <span className="text-muted-foreground text-sm">Items Borrowed</span>
              </div>
              <p className="text-3xl font-bold">2</p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>
            <div className="space-y-4">
              {[
                { action: "Borrowed", item: "Power Drill", from: "Home Circle", date: "2 days ago" },
                { action: "Lent", item: "Camping Tent", to: "Alex Smith", date: "1 week ago" },
                { action: "Returned", item: "Ladder", to: "Neighborhood Circle", date: "2 weeks ago" },
              ].map((activity, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between pb-4 border-b border-border last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">
                      <span className="text-primary">{activity.action}</span> {activity.item}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.from || activity.to} • {activity.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-2 gap-6">
          <Button
            onClick={() => onNavigate("my-listings")}
            className="bg-primary text-primary-foreground rounded-lg p-8 hover:bg-primary/90 transition-colors text-left h-auto flex flex-col items-start"
          >
            <Plus className="w-8 h-8 mb-4" />
            <span className="text-xl font-semibold mb-2">Create New Listing</span>
            <span className="text-primary-foreground/80">Share an item with your circles</span>
          </Button>

          <Button
            onClick={() => onNavigate("browse")}
            className="bg-card border border-border rounded-lg p-8 hover:bg-muted transition-colors text-left h-auto flex flex-col items-start text-foreground"
          >
            <Search className="w-8 h-8 mb-4 text-primary" />
            <span className="text-xl font-semibold mb-2">Browse Items</span>
            <span className="text-muted-foreground">Find items available to borrow</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
