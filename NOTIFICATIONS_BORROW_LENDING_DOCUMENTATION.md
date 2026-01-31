# Notifications, Borrow Requests, Lending, and Item Requests Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [Real-time Implementation](#real-time-implementation)
5. [Notification System](#notification-system)
6. [Borrow Request Flow](#borrow-request-flow)
7. [Borrow Transaction Flow](#borrow-transaction-flow)
8. [Borrow Queue System](#borrow-queue-system)
9. [Item Request Flow](#item-request-flow)
10. [Frontend Components](#frontend-components)
11. [Custom Hooks](#custom-hooks)
12. [API Endpoints](#api-endpoints)
13. [Redux Integration](#redux-integration)
14. [Important Questions Answered](#important-questions-answered)

---

## Introduction

The notifications, borrow requests, lending, and item requests features enable users to:
- Receive real-time notifications for various events (borrow requests, transactions, item requests)
- Request to borrow items from other users
- Manage a queue system for unavailable items
- Track active borrow transactions
- Request items they need within their circles
- Fulfill item requests from circle members

### Key Technologies

- **Supabase Realtime**: Provides WebSocket-based real-time communication for instant notifications and status updates
- **Prisma**: ORM for database operations with PostgreSQL
- **Next.js**: React framework with API routes for backend logic
- **Redux Toolkit Query**: For efficient data fetching and caching
- **React Hooks**: Custom hooks for managing real-time subscriptions

---

## Architecture Overview

The system follows a client-server architecture with real-time capabilities:

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React Client  │◄────────┤  Next.js API     │◄────────┤   PostgreSQL    │
│   (Frontend)    │         │   Routes         │         │   Database      │
└────────┬────────┘         └────────┬─────────┘         └─────────────────┘
         │                           │
         │                           │
         │  WebSocket                │  Broadcast
         │  Connection               │
         ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│  Supabase       │         │  Supabase Admin   │
│  Realtime       │         │  (Server-side)    │
│  (Client)       │         └──────────────────┘
└─────────────────┘
```

### Data Flow

1. **Creating a Borrow Request**:
   - User requests item → API validates → Database insert → Notification created → Supabase broadcast → Owner receives notification

2. **Receiving a Notification**:
   - Supabase broadcast → NotificationsProvider receives → Toast shown → Redux queries invalidated → UI updates

3. **Transaction Status Change**:
   - Owner approves/declines → Database update → Notification created → Supabase broadcast → Both parties see update

---

## Database Schema

The system uses 5 main models for notifications, borrow requests, transactions, queues, and item requests:

### 1. `notifications` Table

**Purpose**: Stores all user notifications (alerts and actionable requests)

**Key Fields**:
- `id` (TEXT, Primary Key): Unique notification identifier
- `user_id` (TEXT, Foreign Key → users.id): Recipient of the notification
- `type` (NotificationType): Type of notification (see enum below)
- `entity_id` (TEXT, nullable): ID of related entity (borrow request, transaction, etc.)
- `title` (TEXT): Notification title
- `body` (TEXT): Notification message
- `metadata` (JSONB): Additional data (itemId, requesterName, etc.)
- `status` (NotificationStatus): `UNREAD` or `READ`
- `created_at`, `read_at`: Timestamps

**Notification Types** (enum):
- **Item Request**: `ITEM_REQUEST_CREATED`, `ITEM_REQUEST_FULFILLED`
- **Borrow Request**: `BORROW_REQUEST_RECEIVED`, `BORROW_REQUEST_APPROVED`, `BORROW_REQUEST_DECLINED`
- **Queue**: `QUEUE_POSITION_UPDATED`, `QUEUE_ITEM_READY`
- **Return**: `RETURN_REQUESTED`, `RETURN_CONFIRMED`
- **Messages**: `NEW_MESSAGE`

**Indexes**:
- `(user_id, status)` - Fast querying of unread notifications
- `(user_id, created_at)` - Efficient sorting by date

### 2. `borrow_requests` Table

**Purpose**: Stores requests to borrow specific items

**Key Fields**:
- `id` (TEXT, Primary Key): Unique request identifier
- `item_id` (TEXT, Foreign Key → items.id): Item being requested
- `requester_id` (TEXT, Foreign Key → users.id): User requesting to borrow
- `owner_id` (TEXT, Foreign Key → users.id): Item owner
- `message` (TEXT, nullable): Optional message from requester
- `desired_from` (TIMESTAMP): When requester wants to borrow from
- `desired_to` (TIMESTAMP): When requester wants to return by
- `status` (BorrowRequestStatus): `PENDING`, `APPROVED`, `DECLINED`, `CANCELLED`
- `decline_note` (TEXT, nullable): Optional note when declining
- `created_at`, `updated_at`: Timestamps

**Status Flow**:
- `PENDING` → `APPROVED` (creates transaction) or `DECLINED` or `CANCELLED`

**Indexes**:
- `item_id`, `requester_id`, `owner_id`, `status` - Fast filtering

### 3. `borrow_queue` Table

**Purpose**: Queue system for items that are currently unavailable

**Key Fields**:
- `id` (TEXT, Primary Key): Unique queue entry identifier
- `item_id` (TEXT, Foreign Key → items.id): Item in queue
- `requester_id` (TEXT, Foreign Key → users.id): User in queue
- `position` (INT): Position in queue (1 = first)
- `message` (TEXT, nullable): Optional message
- `desired_from`, `desired_to` (TIMESTAMP, nullable): Desired borrow dates
- `status` (BorrowQueueStatus): `WAITING`, `READY`, `SKIPPED`, `CANCELLED`
- `created_at`, `updated_at`: Timestamps

**Status Flow**:
- `WAITING` → `READY` (when item becomes available) → `SKIPPED` (converted to request)
- Can be `CANCELLED` at any time

**Unique Constraint**: `(item_id, requester_id)` - Prevents duplicate queue entries

**Indexes**:
- `(item_id, position)` - Efficient queue ordering
- `requester_id`, `status` - Fast filtering

### 4. `borrow_transactions` Table

**Purpose**: Tracks active borrow transactions (when item is actually borrowed)

**Key Fields**:
- `id` (TEXT, Primary Key): Unique transaction identifier
- `borrow_request_id` (TEXT, Unique Foreign Key → borrow_requests.id): Related request
- `item_id` (TEXT, Foreign Key → items.id): Item being borrowed
- `borrower_id` (TEXT, Foreign Key → users.id): User borrowing
- `owner_id` (TEXT, Foreign Key → users.id): Item owner
- `borrowed_at` (TIMESTAMP): When item was borrowed
- `due_at` (TIMESTAMP): When item should be returned
- `returned_at` (TIMESTAMP, nullable): When item was actually returned
- `status` (BorrowTransactionStatus): `ACTIVE`, `RETURN_PENDING`, `COMPLETED`, `CANCELLED`
- `return_note` (TEXT, nullable): Note when marking as returned
- `created_at`, `updated_at`: Timestamps

**Status Flow**:
- `ACTIVE` → `RETURN_PENDING` (borrower marks returned) → `COMPLETED` (owner confirms)

**Indexes**:
- `item_id`, `borrower_id`, `owner_id`, `status` - Fast filtering

### 5. `item_requests` Table

**Purpose**: Requests for items users need (posted in circles)

**Key Fields**:
- `id` (TEXT, Primary Key): Unique request identifier
- `requester_id` (TEXT, Foreign Key → users.id): User requesting item
- `circle_id` (TEXT, Foreign Key → circles.id): Circle where request is posted
- `title` (TEXT): Request title
- `description` (TEXT, nullable): Request description
- `desired_from`, `desired_to` (TIMESTAMP, nullable): When item is needed
- `status` (ItemRequestStatus): `OPEN`, `FULFILLED`, `CANCELLED`
- `fulfilled_by` (TEXT, nullable): Item ID that fulfilled this request
- `created_at`, `updated_at`: Timestamps

**Status Flow**:
- `OPEN` → `FULFILLED` (when someone fulfills) or `CANCELLED`

**Indexes**:
- `requester_id`, `circle_id`, `status` - Fast filtering

### Relationships Summary

```
User
├── notifications (Notification[])
├── borrowRequestsAsRequester (BorrowRequest[])
├── borrowRequestsAsOwner (BorrowRequest[])
├── borrowQueueEntries (BorrowQueue[])
├── borrowTransactionsAsBorrower (BorrowTransaction[])
├── borrowTransactionsAsOwner (BorrowTransaction[])
└── itemRequests (ItemRequest[])

Item
├── borrowRequests (BorrowRequest[])
├── borrowQueue (BorrowQueue[])
└── borrowTransactions (BorrowTransaction[])

BorrowRequest
├── item (Item)
├── requester (User)
├── owner (User)
└── transaction (BorrowTransaction?)

BorrowTransaction
├── borrowRequest (BorrowRequest)
├── item (Item)
├── borrower (User)
└── owner (User)

ItemRequest
├── requester (User)
└── circle (Circle)
```

---

## Real-time Implementation

The system uses **Supabase Realtime** for WebSocket-based communication. Supabase provides channels and broadcast events.

### Channel Types

#### 1. User-Specific Notification Channel: `notifications:${userId}`

**Purpose**: Real-time notifications for a specific user

**Used By**: `NotificationsProvider` component

**Events**:
- `new_notification`: When a new notification is created for the user
- `request_status_changed`: When a borrow request status changes
- `transaction_updated`: When a transaction status changes

**Example**:
```typescript
const channel = supabase.channel(`notifications:${userId}`);
channel
  .on('broadcast', { event: 'new_notification' }, (payload) => {
    // Show toast and invalidate queries
  })
  .on('broadcast', { event: 'request_status_changed' }, () => {
    // Refresh borrow requests data
  })
  .on('broadcast', { event: 'transaction_updated' }, () => {
    // Refresh transactions data
  })
  .subscribe();
```

**Why**: Users need instant notifications regardless of which page they're on. This channel provides global notification updates.

#### 2. Circle-Specific Item Request Channel: `circle-requests:${circleId}`

**Purpose**: Real-time updates for item requests within a circle

**Used By**: `useRealtimeCircleRequests` hook

**Events**:
- `new_item_request`: When a new item request is created in the circle
- `item_request_update`: When an item request status changes

**Example**:
```typescript
const channel = supabase.channel(`circle-requests:${circleId}`);
channel
  .on('broadcast', { event: 'new_item_request' }, (payload) => {
    // Add new request to list
  })
  .on('broadcast', { event: 'item_request_update' }, (payload) => {
    // Update request status
  })
  .subscribe();
```

**Why**: Circle members need to see new item requests in real-time when viewing the item requests page.

#### 3. User-Specific Message Channel: `user:${userId}:messages`

**Purpose**: Real-time message notifications (also used by chat system)

**Used By**: `NotificationsProvider` for toast notifications and unread count

**Events**:
- `new_message`: When user receives a message in any conversation
- `messages_read`: When messages are marked as read

**Why**: Provides global message notifications and unread count updates.

---

## Notification System

### Notification Types

Notifications are categorized into two types:

#### Alert Notifications (Informational)
- `ITEM_REQUEST_CREATED`: Someone created an item request in your circle
- `ITEM_REQUEST_FULFILLED`: Your item request was fulfilled
- `BORROW_REQUEST_APPROVED`: Your borrow request was approved
- `BORROW_REQUEST_DECLINED`: Your borrow request was declined
- `QUEUE_POSITION_UPDATED`: Your position in a queue changed
- `QUEUE_ITEM_READY`: An item you're queued for is now available
- `RETURN_CONFIRMED`: Your item return was confirmed
- `NEW_MESSAGE`: You received a new message

#### Request Notifications (Actionable)
- `BORROW_REQUEST_RECEIVED`: Someone wants to borrow your item
- `RETURN_REQUESTED`: Borrower marked your item as returned (needs confirmation)

### Notification Status

- `UNREAD`: Notification hasn't been viewed
- `READ`: Notification has been viewed (read_at timestamp set)

### Creating Notifications

**Function**: `createNotification()` in `lib/notifications.ts`

**Process**:
1. Create notification record in database
2. Broadcast via Supabase Realtime to user's channel
3. Frontend receives broadcast and shows toast
4. Redux queries are invalidated to refresh data

**Example**:
```typescript
await createNotification({
  userId: item.ownerId,
  type: NotificationType.BORROW_REQUEST_RECEIVED,
  entityId: borrowRequest.id,
  title: 'New Borrow Request',
  body: `${requesterName} wants to borrow "${itemName}"`,
  metadata: {
    borrowRequestId: borrowRequest.id,
    itemId: item.id,
    itemName: item.name,
    requesterId: requesterId,
    requesterName: requesterName,
  },
});
```

### Notifying Circle Members

**Function**: `notifyCircleMembers()` in `lib/notifications.ts`

**Purpose**: Create notifications for all members of a circle (except the actor)

**Use Case**: When someone creates an item request, all circle members are notified

**Example**:
```typescript
await notifyCircleMembers({
  circleId,
  actorId: userId,
  type: NotificationType.ITEM_REQUEST_CREATED,
  entityId: itemRequest.id,
  title: 'New Item Request',
  body: `${userName} is looking for "${title}" in ${circleName}`,
  metadata: { itemRequestId, requesterId, circleId },
});
```

---

## Borrow Request Flow

### Creating a Borrow Request

**Endpoint**: `POST /api/borrow-requests`

**Process**:
1. Validate user authentication
2. Check if item exists and is available
3. If item is unavailable and `joinQueue` is true:
   - Create queue entry instead of request
   - Return queue entry response
4. If item is available:
   - Create borrow request with status `PENDING`
   - Create notification for owner
   - Broadcast notification via real-time
   - Return borrow request

**Request Body**:
```typescript
{
  itemId: string;
  message?: string;
  desiredFrom: string; // ISO date string
  desiredTo: string; // ISO date string
  joinQueue?: boolean; // If true, join queue instead of creating request
}
```

**Response**:
```typescript
// If queue entry
{
  type: 'queue',
  queueEntry: BorrowQueueEntry
}

// If borrow request
{
  type: 'request',
  borrowRequest: BorrowRequest
}
```

### Approving a Borrow Request

**Endpoint**: `PATCH /api/borrow-requests/[id]` with `action: 'approve'`

**Process**:
1. Verify user is the owner
2. Check request status is `PENDING`
3. Check item is still available
4. Use transaction to:
   - Update request status to `APPROVED`
   - Create borrow transaction with status `ACTIVE`
   - Mark item as unavailable (`isAvailable = false`)
5. Create notification for requester
6. Broadcast status change to both parties
7. Return updated request and transaction

**Real-time Updates**: Both requester and owner receive `request_status_changed` event

### Declining a Borrow Request

**Endpoint**: `PATCH /api/borrow-requests/[id]` with `action: 'decline'`

**Process**:
1. Verify user is the owner
2. Check request status is `PENDING`
3. Update request status to `DECLINED`
4. Optionally set `declineNote`
5. Create notification for requester
6. Broadcast status change to both parties

### Cancelling a Borrow Request

**Endpoint**: `PATCH /api/borrow-requests/[id]` with `action: 'cancel'`

**Process**:
1. Verify user is the requester
2. Update request status to `CANCELLED`
3. No notification needed (requester cancelled their own request)

---

## Borrow Transaction Flow

### Transaction Lifecycle

```
ACTIVE → RETURN_PENDING → COMPLETED
```

1. **ACTIVE**: Item is currently borrowed
   - Created when borrow request is approved
   - Item is marked as unavailable
   - `borrowed_at` timestamp set

2. **RETURN_PENDING**: Borrower marked item as returned
   - Borrower calls `POST /api/borrow-requests/[id]/return`
   - Owner receives notification to confirm return
   - `return_note` can be added by borrower

3. **COMPLETED**: Owner confirmed return
   - Owner calls `POST /api/borrow-requests/[id]/confirm-return`
   - Item is marked as available
   - Next person in queue (if any) is promoted to `READY`
   - `returned_at` timestamp set

### Marking Item as Returned

**Endpoint**: `POST /api/borrow-requests/[id]/return`

**Process**:
1. Verify user is the borrower
2. Check transaction exists and status is `ACTIVE`
3. Update transaction status to `RETURN_PENDING`
4. Optionally set `return_note`
5. Create notification for owner (`RETURN_REQUESTED`)
6. Broadcast status change to both parties

**Request Body**:
```typescript
{
  returnNote?: string;
}
```

### Confirming Return

**Endpoint**: `POST /api/borrow-requests/[id]/confirm-return`

**Process**:
1. Verify user is the owner
2. Check transaction status is `RETURN_PENDING` or `ACTIVE`
3. Use transaction to:
   - Update transaction status to `COMPLETED`
   - Set `returned_at` timestamp
   - Mark item as available (`isAvailable = true`)
   - Find next person in queue (if any)
   - Update queue entry status to `READY`
4. Create notification for borrower (`RETURN_CONFIRMED`)
5. If queue entry promoted, create notification for that user (`QUEUE_ITEM_READY`)
6. Broadcast status changes

**Real-time Updates**: All affected parties receive `transaction_updated` or `request_status_changed` events

---

## Borrow Queue System

### Purpose

When an item is unavailable, users can join a queue instead of creating a borrow request. When the item becomes available, the first person in the queue is notified and can convert their queue entry to a borrow request.

### Queue Entry States

- **WAITING**: User is in queue, waiting for item to become available
- **READY**: Item is now available, user can convert to borrow request
- **SKIPPED**: Queue entry was converted to borrow request
- **CANCELLED**: User left queue or was removed by owner

### Joining the Queue

**When**: User tries to borrow an unavailable item and opts to join queue

**Process**:
1. Check if user already has a queue entry for this item
2. Get current max position for this item
3. Create queue entry with `position = maxPosition + 1`
4. Status set to `WAITING`
5. Return queue entry

### Queue Position Updates

**When**: Someone leaves the queue or is removed

**Process**:
1. Update remaining entries: `position = position - 1` for all entries after removed one
2. Done via raw SQL for efficiency:
```sql
UPDATE borrow_queue
SET position = position - 1
WHERE item_id = ? AND position > ?
AND status = 'WAITING'
```

### Converting Queue Entry to Request

**Endpoint**: `POST /api/borrow-queue/[id]`

**Process**:
1. Verify user is the requester
2. Check queue entry status is `READY`
3. Check item is available
4. Use transaction to:
   - Create borrow request
   - Update queue entry status to `SKIPPED`
5. Create notification for owner
6. Return borrow request

### Leaving the Queue

**Endpoint**: `DELETE /api/borrow-queue/[id]`

**Process**:
1. Verify user is requester or owner
2. Update queue entry status to `CANCELLED`
3. Reposition remaining entries
4. If owner removed someone, notify the removed user

---

## Item Request Flow

### Creating an Item Request

**Endpoint**: `POST /api/item-requests`

**Process**:
1. Validate required fields (title, circleId)
2. Verify user is a member of the circle
3. Create item request with status `OPEN`
4. Notify all circle members (except requester)
5. Broadcast to circle channel for real-time updates
6. Return created request

**Request Body**:
```typescript
{
  title: string;
  description?: string;
  circleId: string;
  desiredFrom?: string; // ISO date string
  desiredTo?: string; // ISO date string
}
```

### Fulfilling an Item Request

**Endpoint**: `PATCH /api/item-requests/[id]` with `status: 'FULFILLED'`

**Process**:
1. Verify user is a member of the circle
2. Verify item exists and is in the circle
3. Update request status to `FULFILLED`
4. Set `fulfilled_by` to item ID
5. Create notification for requester (`ITEM_REQUEST_FULFILLED`)
6. Broadcast update to circle channel
7. Return updated request

**Request Body**:
```typescript
{
  status: 'FULFILLED';
  fulfilledBy: string; // Item ID
}
```

### Cancelling an Item Request

**Endpoint**: `PATCH /api/item-requests/[id]` with `status: 'CANCELLED'`

**Process**:
1. Verify user is the requester
2. Update request status to `CANCELLED`
3. Broadcast update to circle channel

---

## Frontend Components

### NotificationsProvider

**File**: `components/providers/notifications-provider.tsx`

**Purpose**: Global provider that handles real-time notifications and message updates

**Responsibilities**:
- Subscribe to user's notification channel
- Subscribe to user's message channel
- Show toast notifications
- Invalidate Redux queries when events occur

**Real-time Subscriptions**:
- `notifications:${userId}` channel:
  - `new_notification`: Show toast, invalidate notification queries
  - `request_status_changed`: Invalidate borrow request queries
  - `transaction_updated`: Invalidate transaction queries
- `user:${userId}:messages` channel:
  - `new_message`: Show toast (if not from self), invalidate unread count
  - `messages_read`: Invalidate unread count

**Usage**: Wrapped around authenticated layout in `app/(authenticated)/layout.tsx`

### NotificationsPage

**File**: `components/pages/notifications-page.tsx`

**Purpose**: Display and manage user notifications

**Features**:
- Two tabs: "Alerts" and "Requests"
- Alert notifications (informational)
- Request notifications (actionable borrow requests)
- Mark as read / mark all as read
- Clear notifications
- Approve/decline borrow requests inline
- Confirm returns inline

**Data Fetching**:
- Uses `useGetNotificationsQuery` for alerts
- Uses `useGetBorrowRequestsQuery` for actionable requests
- Real-time updates via NotificationsProvider

### ItemRequestsPage

**File**: `components/pages/item-requests-page.tsx`

**Purpose**: Display and manage item requests within circles

**Features**:
- Two tabs: "All Requests" and "My Requests"
- Filter by circle
- Create new item request
- Fulfill requests (if you have an item)
- Cancel your own requests
- Real-time updates via `useRealtimeCircleRequests` hook

**Data Fetching**:
- Uses `useGetItemRequestsQuery` for requests
- Uses `useGetAllItemsQuery` for fulfilling requests
- Real-time updates via circle channel subscription

### MyActivityPage

**File**: `components/pages/my-activity-page.tsx`

**Purpose**: Display user's borrow activity (requests, queue, transactions)

**Features**:
- Four tabs: "Active", "Pending", "Queue", "History"
- Active transactions (currently borrowed/lent)
- Pending borrow requests
- Queue entries (waiting and ready)
- Transaction history
- Actions: Mark as returned, confirm return, convert queue entry

**Data Fetching**:
- Uses `useGetTransactionsQuery` for active transactions
- Uses `useGetBorrowRequestsQuery` for pending requests
- Uses `useGetQueueEntriesQuery` for queue entries
- Real-time updates via NotificationsProvider

---

## Custom Hooks

### useRealtimeNotifications

**File**: `hooks/useRealtimeNotifications.ts`

**Purpose**: Hook for listening to user-specific notifications

**Parameters**:
```typescript
{
  userId: string | null;
  onNotification: (notification: RealtimeNotification) => void;
}
```

**Usage**:
```typescript
useRealtimeNotifications({
  userId: currentUser?.id || null,
  onNotification: (notification) => {
    // Handle notification
  },
});
```

**Note**: Currently, NotificationsProvider handles notifications globally, so this hook may not be used directly in components.

### useRealtimeCircleRequests

**File**: `hooks/useRealtimeCircleRequests.ts`

**Purpose**: Hook for listening to item requests within a circle

**Parameters**:
```typescript
{
  circleId: string | null;
  onItemRequest: (request: RealtimeItemRequest) => void;
  onItemRequestUpdate?: (update: Partial<RealtimeItemRequest> & { id: string }) => void;
}
```

**Usage**:
```typescript
useRealtimeCircleRequests({
  circleId: selectedCircleId,
  onItemRequest: (request) => {
    // Add new request to list
    setRequests(prev => [request, ...prev]);
  },
  onItemRequestUpdate: (update) => {
    // Update request in list
    setRequests(prev => prev.map(r => r.id === update.id ? { ...r, ...update } : r));
  },
});
```

**Channels**: Subscribes to `circle-requests:${circleId}` channel

---

## API Endpoints

### Notifications

#### GET /api/notifications

**Purpose**: Get user's notifications

**Query Parameters**:
- `tab`: `'alerts'` | `'requests'` | null (all)
- `status`: `'UNREAD'` | `'READ'` | null (all)
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response**:
```typescript
{
  notifications: Notification[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  unreadCount: number;
  tabCounts: {
    alerts: number;
    requests: number;
  };
}
```

#### PATCH /api/notifications/[id]/read

**Purpose**: Mark notification as read

**Special Case**: If `id === 'all'`, marks all notifications as read

**Response**: Updated notification or `{ message: string }`

#### DELETE /api/notifications

**Purpose**: Clear notifications

**Query Parameters**:
- `tab`: `'alerts'` | `'requests'` | null (all)

**Response**: `{ message: string }`

### Borrow Requests

#### GET /api/borrow-requests

**Purpose**: Get borrow requests

**Query Parameters**:
- `type`: `'incoming'` | `'outgoing'` | `'all'` (default: all)
- `status`: `BorrowRequestStatus` | null
- `itemId`: string | null

**Response**: `BorrowRequest[]`

#### POST /api/borrow-requests

**Purpose**: Create borrow request or join queue

**Body**:
```typescript
{
  itemId: string;
  message?: string;
  desiredFrom: string;
  desiredTo: string;
  joinQueue?: boolean;
}
```

**Response**: `{ type: 'request' | 'queue', borrowRequest?: BorrowRequest, queueEntry?: BorrowQueueEntry }`

#### GET /api/borrow-requests/[id]

**Purpose**: Get single borrow request

**Response**: `BorrowRequest`

#### PATCH /api/borrow-requests/[id]

**Purpose**: Approve, decline, or cancel borrow request

**Body**:
```typescript
{
  action: 'approve' | 'decline' | 'cancel';
  declineNote?: string;
}
```

**Response**: `BorrowRequest`

#### POST /api/borrow-requests/[id]/return

**Purpose**: Mark item as returned (borrower)

**Body**:
```typescript
{
  returnNote?: string;
}
```

**Response**: `{ message: string, transaction: BorrowTransaction }`

#### POST /api/borrow-requests/[id]/confirm-return

**Purpose**: Confirm return (owner)

**Response**: `{ message: string, transaction: BorrowTransaction, nextInQueue?: QueueEntry }`

### Borrow Queue

#### GET /api/borrow-queue

**Purpose**: Get queue entries

**Query Parameters**:
- `itemId`: string | null
- `myEntries`: boolean (default: false)

**Response**: `BorrowQueueEntry[]`

#### POST /api/borrow-queue/[id]

**Purpose**: Convert queue entry to borrow request

**Response**: `{ message: string, borrowRequest: BorrowRequest }`

#### DELETE /api/borrow-queue/[id]

**Purpose**: Leave queue or remove from queue

**Response**: `{ message: string }`

### Item Requests

#### GET /api/item-requests

**Purpose**: Get item requests

**Query Parameters**:
- `circleId`: string | null
- `status`: `ItemRequestStatus` | null
- `myRequests`: boolean (default: false)

**Response**: `ItemRequest[]`

#### POST /api/item-requests

**Purpose**: Create item request

**Body**:
```typescript
{
  title: string;
  description?: string;
  circleId: string;
  desiredFrom?: string;
  desiredTo?: string;
}
```

**Response**: `ItemRequest`

#### GET /api/item-requests/[id]

**Purpose**: Get single item request

**Response**: `ItemRequest`

#### PATCH /api/item-requests/[id]

**Purpose**: Update item request (fulfill/cancel)

**Body**:
```typescript
{
  status: ItemRequestStatus;
  fulfilledBy?: string; // Required if status is FULFILLED
}
```

**Response**: `ItemRequest`

### Transactions

#### GET /api/transactions

**Purpose**: Get user's transactions

**Query Parameters**:
- `role`: `'borrower'` | `'owner'` | null (all)
- `status`: `BorrowTransactionStatus` | null
- `itemId`: string | null

**Response**: `FullTransaction[]`

---

## Redux Integration

### notificationsApi

**File**: `lib/redux/api/notificationsApi.ts`

**Endpoints**:
- `getNotifications`: Query for notifications with filters
- `markAsRead`: Mutation to mark notification as read
- `markAllAsRead`: Mutation to mark all as read
- `clearNotifications`: Mutation to clear notifications

**Tag Types**: `['Notifications']`

**Cache Invalidation**: 
- All mutations invalidate `['Notifications']` tag
- Real-time updates also invalidate via NotificationsProvider

### borrowApi

**File**: `lib/redux/api/borrowApi.ts`

**Endpoints**:

**Item Requests**:
- `getItemRequests`: Query for item requests
- `getItemRequest`: Query for single item request
- `createItemRequest`: Mutation to create request
- `updateItemRequest`: Mutation to fulfill/cancel request

**Borrow Requests**:
- `getBorrowRequests`: Query for borrow requests
- `getBorrowRequest`: Query for single borrow request
- `createBorrowRequest`: Mutation to create request or join queue
- `updateBorrowRequest`: Mutation to approve/decline/cancel
- `markAsReturned`: Mutation to mark item as returned
- `confirmReturn`: Mutation to confirm return

**Queue**:
- `getQueueEntries`: Query for queue entries
- `leaveQueue`: Mutation to leave queue
- `convertQueueEntry`: Mutation to convert to request

**Transactions**:
- `getTransactions`: Query for transactions

**Tag Types**: `['ItemRequests', 'BorrowRequests', 'BorrowQueue', 'Transactions']`

**Cache Invalidation**:
- Mutations invalidate relevant tags
- Real-time updates invalidate via NotificationsProvider

### messagesApi

**File**: `lib/redux/api/messagesApi.ts`

**Endpoints**:
- `getUnreadMessageCount`: Query for total unread message count

**Tag Types**: `['UnreadCount']`

**Cache Invalidation**: 
- Real-time updates invalidate via NotificationsProvider

---

## Important Questions Answered

### Why separate notifications from borrow requests?

**Answer**: Notifications are a general system that can handle various event types (borrow requests, transactions, item requests, messages). Borrow requests are domain-specific entities. Separating them allows:
- Reusable notification infrastructure
- Different UI for alerts vs actionable requests
- Easy to add new notification types

### Why use a queue system instead of just pending requests?

**Answer**: When an item is unavailable, users shouldn't create pending requests that will be declined. The queue:
- Manages order fairly (first come, first served)
- Automatically promotes when item becomes available
- Reduces notification spam (no need to notify owner of requests for unavailable items)
- Better UX (users know their position)

### How does real-time work when user is offline?

**Answer**: Supabase Realtime maintains WebSocket connections. When user comes back online:
- WebSocket reconnects automatically
- Missed broadcasts are not replayed (by design)
- Frontend refetches data via Redux queries
- Unread notifications are fetched from database

### Why broadcast status changes separately from notifications?

**Answer**: Status changes (`request_status_changed`, `transaction_updated`) trigger UI refreshes even if no notification is created. For example:
- Owner approves request → Notification sent to requester
- But owner's UI also needs to refresh to show updated status
- Broadcasting status change ensures both parties see updates

### How are queue positions managed atomically?

**Answer**: Queue position updates use database transactions and raw SQL:
```sql
UPDATE borrow_queue
SET position = position - 1
WHERE item_id = ? AND position > ? AND status = 'WAITING'
```
This ensures:
- No race conditions
- Atomic updates
- Efficient bulk updates

### Why mark item as unavailable when transaction starts?

**Answer**: Prevents multiple simultaneous borrows of the same item. When transaction is `ACTIVE`:
- Item `isAvailable = false`
- New borrow requests are rejected or go to queue
- Item becomes available again when transaction is `COMPLETED`

### How are notifications deduplicated?

**Answer**: Notifications are not deduplicated by default. However:
- Same event can create multiple notifications (e.g., all circle members get notified)
- Frontend can deduplicate by checking `entityId` and `type`
- Database has unique constraint on `(user_id, entity_id, type)` if needed (not currently enforced)

### Why use JSONB for notification metadata?

**Answer**: Metadata contains variable data depending on notification type:
- Borrow request: `borrowRequestId`, `itemId`, `requesterName`
- Transaction: `transactionId`, `dueAt`
- Item request: `itemRequestId`, `circleName`

JSONB allows flexible schema without separate tables for each notification type.

---

## Summary

The notifications, borrow requests, lending, and item requests system is built on:

1. **Database**: 5 models with proper relationships and indexes
2. **Real-time**: Supabase Realtime with user-specific and circle-specific channels
3. **Notifications**: Flexible system supporting multiple notification types
4. **Queue System**: Fair ordering for unavailable items
5. **Transactions**: Complete lifecycle tracking from request to return
6. **Redux Integration**: Efficient caching and query invalidation
7. **Real-time Updates**: Instant UI updates via WebSocket broadcasts

The architecture ensures low latency, reliability, and a smooth user experience for managing borrow requests, transactions, and item requests within circles.
