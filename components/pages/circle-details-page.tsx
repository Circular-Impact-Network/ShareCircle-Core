"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Copy,
  Share2,
  Plus,
  ArrowLeft,
  Crown,
  Shield,
  MoreVertical,
  RefreshCw,
  Settings,
  UserMinus,
  UserPlus,
  LogOut,
  Loader2,
  Check,
  Calendar,
  Link2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ItemDetailsModal } from "@/components/modals/item-details-modal"
import { AddItemModal } from "@/components/modals/add-item-modal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface CircleDetailsPageProps {
  circleId: string
  onBack: () => void
}

interface Member {
  id: string
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: "ADMIN" | "MEMBER"
  joinType: "CREATED" | "CODE" | "LINK"
  joinedAt: string
}

interface Circle {
  id: string
  name: string
  description: string | null
  inviteCode: string
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string | null
    image: string | null
    email: string | null
  }
  membersCount: number
  userRole: "ADMIN" | "MEMBER"
  members: Member[]
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

export function CircleDetailsPage({ circleId, onBack }: CircleDetailsPageProps) {
  const { data: session } = useSession()
  const [circle, setCircle] = useState<Circle | null>(null)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [memberAction, setMemberAction] = useState<"promote" | "demote" | "remove" | "leave" | null>(null)
  const [isProcessingMember, setIsProcessingMember] = useState(false)
  const { toast } = useToast()

  const fetchCircle = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/circles/${circleId}`)
      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "Access Denied",
            description: "You are not a member of this circle.",
            variant: "destructive",
          })
          onBack()
          return
        }
        throw new Error("Failed to fetch circle")
      }
      const data = await response.json()
      setCircle(data)
    } catch (error) {
      console.error("Error fetching circle:", error)
      toast({
        title: "Error",
        description: "Failed to load circle details.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [circleId, toast, onBack])

  useEffect(() => {
    fetchCircle()
  }, [fetchCircle])

  const handleCopy = async (text: string, type: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please try again or copy manually.",
        variant: "destructive",
      })
    }
  }

  const handleRegenerateCode = async () => {
    if (!circle || circle.userRole !== "ADMIN") return

    try {
      setIsRegeneratingCode(true)
      const response = await fetch(`/api/circles/${circleId}/regenerate-code`, {
        method: "POST",
      })

      if (!response.ok) throw new Error("Failed to regenerate code")

      const data = await response.json()
      setCircle((prev) => (prev ? { ...prev, inviteCode: data.inviteCode } : null))
      toast({
        title: "Code regenerated",
        description: "A new invite code has been generated.",
      })
    } catch (error) {
      console.error("Error regenerating code:", error)
      toast({
        title: "Error",
        description: "Failed to regenerate invite code.",
        variant: "destructive",
      })
    } finally {
      setIsRegeneratingCode(false)
    }
  }

  const handleMemberAction = async () => {
    if (!selectedMember || !memberAction || !circle) return

    setIsProcessingMember(true)
    try {
      if (memberAction === "promote" || memberAction === "demote") {
        const newRole = memberAction === "promote" ? "ADMIN" : "MEMBER"
        const response = await fetch(`/api/circles/${circleId}/members/${selectedMember.userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update role")
        }

        setCircle((prev) => {
          if (!prev) return null
          return {
            ...prev,
            members: prev.members.map((m) =>
              m.userId === selectedMember.userId ? { ...m, role: newRole } : m
            ),
          }
        })

        toast({
          title: "Role updated",
          description: `${selectedMember.name || "Member"} is now ${newRole === "ADMIN" ? "an admin" : "a member"}.`,
        })
      } else if (memberAction === "remove" || memberAction === "leave") {
        const response = await fetch(`/api/circles/${circleId}/members/${selectedMember.userId}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to remove member")
        }

        if (memberAction === "leave") {
          toast({
            title: "Left circle",
            description: "You have left this circle.",
          })
          onBack()
          return
        }

        setCircle((prev) => {
          if (!prev) return null
          return {
            ...prev,
            members: prev.members.filter((m) => m.userId !== selectedMember.userId),
            membersCount: prev.membersCount - 1,
          }
        })

        toast({
          title: "Member removed",
          description: `${selectedMember.name || "Member"} has been removed from the circle.`,
        })
      }
    } catch (error) {
      console.error("Error processing member action:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process action.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingMember(false)
      setSelectedMember(null)
      setMemberAction(null)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getJoinTypeLabel = (joinType: string) => {
    switch (joinType) {
      case "CREATED":
        return "Creator"
      case "CODE":
        return "Joined via code"
      case "LINK":
        return "Joined via link"
      default:
        return joinType
    }
  }

  const getShareUrl = () => {
    if (typeof window !== "undefined" && circle) {
      return `${window.location.origin}/join?code=${circle.inviteCode}`
    }
    return ""
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading circle details...</p>
      </div>
    )
  }

  // Not found state
  if (!circle) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Button onClick={onBack} variant="ghost" className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Circles
        </Button>
        <Alert variant="destructive">
          <AlertDescription>Circle not found or you don&apos;t have access.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const isAdmin = circle.userRole === "ADMIN"
  const currentUserId = session?.user?.id

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Back Button */}
      <Button onClick={onBack} variant="ghost" className="-ml-2 mb-4 gap-2 sm:mb-6">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back to Circles</span>
        <span className="sm:hidden">Back</span>
      </Button>

      {/* Circle Header */}
      <Card className="mb-6 border-none bg-gradient-to-br from-primary/10 via-primary/5 to-accent/20 text-primary-foreground shadow-2xl sm:mb-8">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl sm:text-3xl lg:text-4xl text-primary-foreground">{circle.name}</CardTitle>
              {isAdmin && (
                <Badge variant="secondary" className="gap-1 bg-white/20 text-primary-foreground">
                  <Crown className="h-3 w-3" />
                  Admin
                </Badge>
              )}
            </div>
            <CardDescription className="text-sm text-primary-foreground/80 sm:text-base">
              {circle.description || "No description"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" className="gap-2 bg-white/10 text-white hover:bg-white/20">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-white/10 text-white hover:bg-white/20"
              onClick={() => handleCopy(getShareUrl(), "link")}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-white/20 bg-white/10 text-primary-foreground">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-primary-foreground/80">Members</CardDescription>
                <Users className="h-4 w-4 text-primary-foreground/80" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{circle.membersCount}</p>
              </CardContent>
            </Card>
            <Card className="border border-white/20 bg-white/10 text-primary-foreground">
              <CardHeader className="space-y-1 pb-2">
                <CardDescription className="text-primary-foreground/80">Created</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatDate(circle.createdAt)}</p>
              </CardContent>
            </Card>
            <Card className="col-span-1 border border-white/20 bg-white/10 text-primary-foreground lg:col-span-2">
              <CardHeader className="flex items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
                  <Link2 className="h-4 w-4" />
                  Invite Code
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary-foreground hover:bg-white/10"
                    onClick={handleRegenerateCode}
                    disabled={isRegeneratingCode}
                  >
                    {isRegeneratingCode ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    <span className="ml-1 hidden sm:inline">Regenerate</span>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <code className="font-mono text-2xl font-bold tracking-wider">{circle.inviteCode}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-primary-foreground hover:bg-white/10"
                  onClick={() => handleCopy(circle.inviteCode, "code")}
                >
                  {copied === "code" ? (
                    <Check className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-white/15 bg-background/80 text-foreground shadow-lg">
            <CardHeader className="pb-2">
              <CardDescription>Share this link to invite others</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 break-all rounded-md bg-muted/40 px-3 py-2 text-sm text-primary">
                {getShareUrl()}
              </code>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1"
                onClick={() => handleCopy(getShareUrl(), "link")}
              >
                {copied === "link" ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Members Section */}
      <div className="mb-6 sm:mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold sm:text-2xl">Members</h2>
          <span className="text-sm text-muted-foreground">{circle.members.length} total</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {circle.members.map((member) => {
            const isCurrentUser = member.userId === currentUserId
            const canManage = isAdmin && !isCurrentUser
            const isCreator = member.joinType === "CREATED"

            return (
              <Card key={member.id} className="group border-border/70">
                <CardContent className="flex items-start gap-3 p-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarImage src={member.image || undefined} alt={member.name || "Member"} />
                        <AvatarFallback className="text-sm">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      {member.name || member.email || "Member"}
                    </TooltipContent>
                  </Tooltip>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold sm:text-base">
                        {member.name || "Unknown"}
                        {isCurrentUser && <span className="font-normal text-muted-foreground"> (you)</span>}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {member.role === "ADMIN" ? (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <Crown className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Member
                        </span>
                      )}
                      <span>•</span>
                      <span>{getJoinTypeLabel(member.joinType)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(member.joinedAt)}</p>
                  </div>

                  {(canManage || isCurrentUser) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canManage && (
                          <>
                            {member.role === "MEMBER" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member)
                                  setMemberAction("promote")
                                }}
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Make Admin
                              </DropdownMenuItem>
                            )}
                            {member.role === "ADMIN" && !isCreator && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member)
                                  setMemberAction("demote")
                                }}
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                Remove Admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setSelectedMember(member)
                                setMemberAction("remove")
                              }}
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Remove from Circle
                            </DropdownMenuItem>
                          </>
                        )}
                        {isCurrentUser && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setSelectedMember(member)
                              setMemberAction("leave")
                            }}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            Leave Circle
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Leave Circle Button (for non-creators) */}
        {!circle.members.find((m) => m.userId === currentUserId && m.joinType === "CREATED") && (
          <>
            <Separator className="my-4" />
            <Button
              variant="ghost"
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                const currentMember = circle.members.find((m) => m.userId === currentUserId)
                if (currentMember) {
                  setSelectedMember(currentMember)
                  setMemberAction("leave")
                }
              }}
            >
              <LogOut className="h-4 w-4" />
              Leave Circle
            </Button>
          </>
        )}
      </div>

      {/* Items Section - Placeholder for now */}
      <Card className="mb-8 border-dashed border-border/70 bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Shared Items</CardTitle>
          <Button onClick={() => setShowAddItem(true)} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Item</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border/80">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No items shared yet</p>
          <Button onClick={() => setShowAddItem(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Add the first item
          </Button>
        </CardContent>
      </Card>

      {/* Member Action Confirmation Dialog */}
      <Dialog
        open={!!memberAction}
        onOpenChange={(open) => {
          if (!open) {
            setMemberAction(null)
            setSelectedMember(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {memberAction === "promote" && "Make Admin"}
              {memberAction === "demote" && "Remove Admin Role"}
              {memberAction === "remove" && "Remove Member"}
              {memberAction === "leave" && "Leave Circle"}
            </DialogTitle>
            <DialogDescription>
              {memberAction === "promote" &&
                `Make ${selectedMember?.name || "this member"} an admin? They will be able to manage members and circle settings.`}
              {memberAction === "demote" &&
                `Remove admin role from ${selectedMember?.name || "this member"}? They will become a regular member.`}
              {memberAction === "remove" &&
                `Remove ${selectedMember?.name || "this member"} from the circle? They will need to rejoin using the invite code.`}
              {memberAction === "leave" &&
                "Are you sure you want to leave this circle? You'll need to rejoin using the invite code."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setMemberAction(null)
                setSelectedMember(null)
              }}
              disabled={isProcessingMember}
            >
              Cancel
            </Button>
            <Button
              variant={memberAction === "remove" || memberAction === "leave" ? "destructive" : "default"}
              onClick={handleMemberAction}
              disabled={isProcessingMember}
            >
              {isProcessingMember && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {memberAction === "promote" && "Make Admin"}
              {memberAction === "demote" && "Remove Admin"}
              {memberAction === "remove" && "Remove"}
              {memberAction === "leave" && "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <ItemDetailsModal item={selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)} />
      <AddItemModal open={showAddItem} onOpenChange={setShowAddItem} />
    </div>
  )
}
