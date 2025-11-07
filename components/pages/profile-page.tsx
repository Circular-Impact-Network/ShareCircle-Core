"use client"

import { useState } from "react"
import { Edit2, Bell, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useTheme } from "@/app/providers"

export function ProfilePage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="p-8 max-w-2xl px-6 py-3">
      <h1 className="text-4xl font-bold text-foreground mb-8">Profile</h1>

      <div className="bg-card border border-border rounded-lg p-8 mb-8 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-start gap-6 mb-8">
          <Avatar className="w-24 h-24 hover:shadow-lg transition-all duration-300">
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl">JD</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">John Doe</h2>
            <p className="text-muted-foreground mt-1">john@example.com</p>
            <p className="text-muted-foreground mt-4">
              An avid collector and generous sharer. Love exploring new hobbies!
            </p>
            <Button className="mt-4 gap-2 transition-all duration-200 shadow-md hover:shadow-lg">
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-8 border-y border-border">
          <div className="text-center hover:bg-muted/30 transition-colors duration-200 p-4 rounded-lg">
            <p className="text-2xl font-bold text-primary">4</p>
            <p className="text-sm text-muted-foreground">Circles Joined</p>
          </div>
          <div className="text-center hover:bg-muted/30 transition-colors duration-200 p-4 rounded-lg">
            <p className="text-2xl font-bold text-primary">12</p>
            <p className="text-sm text-muted-foreground">Items Shared</p>
          </div>
          <div className="text-center hover:bg-muted/30 transition-colors duration-200 p-4 rounded-lg">
            <p className="text-2xl font-bold text-primary">8</p>
            <p className="text-sm text-muted-foreground">Items Borrowed</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-foreground mb-4">Settings</h3>

        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:shadow-sm transition-all duration-200">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Notifications</p>
              <p className="text-sm text-muted-foreground">{notificationsEnabled ? "Enabled" : "Disabled"}</p>
            </div>
          </div>
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`w-12 h-6 rounded-full transition-all duration-300 ${notificationsEnabled ? "bg-primary" : "bg-muted"}`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                notificationsEnabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:shadow-sm transition-all duration-200">
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Dark Mode</p>
              <p className="text-sm text-muted-foreground">{theme === "dark" ? "Enabled" : "Disabled"}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-12 h-6 rounded-full transition-all duration-300 ${theme === "dark" ? "bg-primary" : "bg-muted"}`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                theme === "dark" ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
