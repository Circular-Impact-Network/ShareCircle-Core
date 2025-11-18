"use client"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Edit2, Trash2, CheckCircle, Plus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DeleteItemDialog } from "@/components/dialogs/delete-item-dialog"
import { EditItemDialog } from "@/components/dialogs/edit-item-dialog"
import { CreateListingModal } from "@/components/modals/create-listing-modal"

interface ActiveListing {
  id: number
  title: string
  image: string
  circle: string
  requests: number
}

interface LentOutListing {
  id: number
  title: string
  image: string
  circle: string
  borrower: { name: string; avatar: string }
  lentOn: string
  dueDate: string
}

interface ReturnedListing {
  id: number
  title: string
  image: string
  circle: string
  returnedDate: string
}

interface Listings {
  active: ActiveListing[]
  lentOut: LentOutListing[]
  returned: ReturnedListing[]
}

const mockMyListingsInitial: Listings = {
  active: [
    {
      id: 1,
      title: "Tent",
      image: "/camping-tent.png",
      circle: "Beach House Friends",
      requests: 2,
    },
    {
      id: 2,
      title: "Projector",
      image: "/home-theater-projector.png",
      circle: "Beach House Friends",
      requests: 1,
    },
  ],
  lentOut: [
    {
      id: 3,
      title: "Bike Rack",
      image: "/bike-rack.jpg",
      circle: "Hiking Club",
      borrower: { name: "John", avatar: "J" },
      lentOn: "2024-11-01",
      dueDate: "2024-11-15",
    },
  ],
  returned: [
    {
      id: 4,
      title: "Kayak",
      image: "/single-person-kayak.png",
      circle: "Beach House Friends",
      returnedDate: "2024-10-30",
    },
  ],
}

const mockCircles = [
  { id: "1", name: "Beach House Friends" },
  { id: "2", name: "Hiking Club" },
  { id: "3", name: "Neighborhood Circle" },
]

export function MyListingsPage() {
  const [listings, setListings] = useState(mockMyListingsInitial)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createListingOpen, setCreateListingOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [selectedTab, setSelectedTab] = useState("active")

  const handleEditClick = (item: any, tab: string) => {
    setSelectedItem({ ...item, tab })
    setEditDialogOpen(true)
  }

  const handleDeleteClick = (item: any, tab: string) => {
    setSelectedItem({ ...item, tab })
    setDeleteDialogOpen(true)
  }

  const handleEditConfirm = (title: string, circle: string) => {
    if (!selectedItem) return

    const updatedListings = { ...listings }
    const tabKey = selectedItem.tab as keyof typeof listings
    const itemIndex = updatedListings[tabKey].findIndex((item) => item.id === selectedItem.id)

    if (itemIndex !== -1) {
      ;(updatedListings[tabKey][itemIndex] as any) = {
        ...updatedListings[tabKey][itemIndex],
        title,
        circle,
      }
      setListings(updatedListings)
    }

    setEditDialogOpen(false)
    setSelectedItem(null)
  }

  const handleDeleteConfirm = () => {
    if (!selectedItem) return

    const updatedListings = { ...listings }
    const tabKey = selectedItem.tab as keyof typeof listings
    updatedListings[tabKey] = updatedListings[tabKey].filter((item) => item.id !== selectedItem.id) as any
    setListings(updatedListings)

    setDeleteDialogOpen(false)
    setSelectedItem(null)
  }

  const handleCreateListing = (listing: any) => {
    const newItem = {
      id: Math.max(...listings.active.map((i) => i.id), 0) + 1,
      ...listing,
      requests: 0,
    }

    setListings({
      ...listings,
      active: [...listings.active, newItem],
    })

    setCreateListingOpen(false)
  }

  return (
    <div className="p-8 px-6 py-3">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">My Listings</h1>
          <p className="text-muted-foreground">Manage your shared items</p>
        </div>
        <Button onClick={() => setCreateListingOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Listing
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full" onValueChange={setSelectedTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="active">Active ({listings.active.length})</TabsTrigger>
          <TabsTrigger value="lent">Lent Out ({listings.lentOut.length})</TabsTrigger>
          <TabsTrigger value="returned">Returned ({listings.returned.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {listings.active.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <img src={item.image || "/placeholder.svg"} alt={item.title} className="w-20 h-20 rounded object-cover" />
              <div className="flex-1">
                <h3 className="font-semibold text-card-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.circle}</p>
                <p className="text-xs text-accent mt-1">{item.requests} requests</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-transparent"
                  onClick={() => handleEditClick(item, "active")}
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive bg-transparent"
                  onClick={() => handleDeleteClick(item, "active")}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="lent" className="space-y-4">
          {listings.lentOut.map((item) => (
            <div key={item.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
              <img src={item.image || "/placeholder.svg"} alt={item.title} className="w-20 h-20 rounded object-cover" />
              <div className="flex-1">
                <h3 className="font-semibold text-card-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.circle}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {item.borrower.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    Lent to {item.borrower.name} • Due {item.dueDate}
                  </span>
                </div>
              </div>
              <Button size="sm" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Mark Returned
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="returned" className="space-y-4">
          {listings.returned.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 opacity-75"
            >
              <img src={item.image || "/placeholder.svg"} alt={item.title} className="w-20 h-20 rounded object-cover" />
              <div className="flex-1">
                <h3 className="font-semibold text-card-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.circle}</p>
                <p className="text-xs text-muted-foreground mt-1">Returned {item.returnedDate}</p>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {selectedItem && (
        <DeleteItemDialog
          isOpen={deleteDialogOpen}
          itemTitle={selectedItem.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteDialogOpen(false)
            setSelectedItem(null)
          }}
        />
      )}

      {selectedItem && (
        <EditItemDialog
          isOpen={editDialogOpen}
          itemTitle={selectedItem.title}
          itemCircle={selectedItem.circle}
          onConfirm={handleEditConfirm}
          onCancel={() => {
            setEditDialogOpen(false)
            setSelectedItem(null)
          }}
        />
      )}

      <CreateListingModal
        open={createListingOpen}
        onOpenChange={setCreateListingOpen}
        onSubmit={handleCreateListing}
        availableCircles={mockCircles}
      />
    </div>
  )
}
