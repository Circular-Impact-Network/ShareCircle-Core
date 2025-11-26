"use client"

import { Home, Search, LayoutGrid, MessageSquare, User, LogOut, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useState, useEffect } from "react"

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const router = useRouter()
  const { data: session } = useSession()

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "browse", label: "Browse Items", icon: Search },
    { id: "circles", label: "Circles", icon: LayoutGrid },
    { id: "my-listings", label: "My Listings", icon: Plus },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "profile", label: "Profile", icon: User },
  ]

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/landing" })
  }

  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-border flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">SC</span>
        </div>
        <span className="font-display font-semibold text-lg">ShareCircle</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      {/* User Profile Section */}
        {session?.user && (
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 bg-primary">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold leading-[1.6rem]">
                  {getInitials(
                    session?.user?.name || 
                    session?.user?.email || "U"
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {session?.user?.name || 
                   session?.user?.email?.split("@")[0]}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
              </div>
              <Button variant="outline" className="gap-2 bg-transparent" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      {/*<div className="p-4 border-t border-border">
        <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>*/}
    </div>
  )
}
