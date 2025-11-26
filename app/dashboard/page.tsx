"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Sidebar } from "@/components/app/sidebar"
import { DashboardHome } from "@/components/pages/dashboard-home"
import { BrowseListingsPage } from "@/components/pages/browse-listings-page"
import { MyListingsPage } from "@/components/pages/my-listings-page"
import { CirclesPage } from "@/components/pages/circles-page"
import { CircleDetailsPage } from "@/components/pages/circle-details-page"
import { MessagesPage } from "@/components/pages/messages-page"
import { ProfilePage } from "@/components/pages/profile-page"

export default function Dashboard() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [currentPage, setCurrentPage] = useState("home")
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && status === "unauthenticated") {
      router.push("/login")
    }
  }, [mounted, status, router])

  // Show loading while checking authentication or during SSR
  if (!mounted || status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-sm">SC</span>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <DashboardHome onNavigate={setCurrentPage} />
      case "browse":
        return <BrowseListingsPage />
      case "my-listings":
        return <MyListingsPage />
      case "circles":
        return (
          <CirclesPage
            onSelectCircle={(id) => {
              setSelectedCircleId(id)
              setCurrentPage("circle-details")
            }}
          />
        )
      case "circle-details":
        return <CircleDetailsPage circleId={selectedCircleId!} onBack={() => setCurrentPage("circles")} />
      case "messages":
        return <MessagesPage />
      case "profile":
        return <ProfilePage />
      default:
        return <DashboardHome onNavigate={setCurrentPage} />
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  )
}
