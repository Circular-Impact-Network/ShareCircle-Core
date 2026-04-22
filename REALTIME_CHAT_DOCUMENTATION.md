# Real-time Chat Feature Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [Real-time Implementation](#real-time-implementation)
5. [Read Receipts & Delivery Receipts](#read-receipts--delivery-receipts)
6. [Message Flow](#message-flow)
7. [Frontend Components](#frontend-components)
8. [Custom Hooks](#custom-hooks)
9. [API Endpoints](#api-endpoints)
10. [Important Questions Answered](#important-questions-answered)

---

## Introduction

The real-time chat feature enables users to communicate with each other through instant messaging. Users can only chat with people who share at least one circle (group) with them, ensuring privacy and relevance.

### Key Technologies

- **Supabase Realtime**: Provides WebSocket-based real-time communication for instant message delivery, receipt updates, and presence tracking
- **Prisma**: ORM for database operations with PostgreSQL
- **Next.js**: React framework with API routes for backend logic
- **React Hooks**: Custom hooks for managing real-time subscriptions and state

---

## Architecture Overview

The chat system follows a client-server architecture with real-time capabilities:

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

1. **Sending a Message**:
    - User types message → Optimistic UI update → API call → Database insert → Supabase broadcast → Recipients receive

2. **Receiving a Message**:
    - Supabase broadcast → React hook receives → State update → UI renders

3. **Read Receipts**:
    - User views conversation → API marks as read → Database update → Supabase broadcast → Sender sees blue tick

---

## Database Schema

The chat system uses 5 main tables:

### 1. `conversations` Table

**Purpose**: Stores conversation metadata (direct messages or group chats)

**Key Fields**:

- `id` (TEXT, Primary Key): Unique conversation identifier
- `type` (ConversationType): `DIRECT` or `GROUP`
- `created_by` (TEXT, Foreign Key → users.id): User who created the conversation
- `last_message_at` (TIMESTAMP): Timestamp of the most recent message (for sorting)
- `created_at`, `updated_at`: Timestamps

**Why**: Separates conversation metadata from participants, allowing multiple users per conversation with individual settings.

### 2. `conversation_participants` Table

**Purpose**: Tracks which users are in which conversations and their individual preferences

**Key Fields**:

- `id` (TEXT, Primary Key): Unique participant record ID
- `conversation_id` (TEXT, Foreign Key → conversations.id): Which conversation
- `user_id` (TEXT, Foreign Key → users.id): Which user
- `pinned_at` (TIMESTAMP): When user pinned this conversation (null if not pinned)
- `archived_at` (TIMESTAMP): When user archived this conversation (null if not archived)
- `muted_until` (TIMESTAMP): Until when notifications are muted (null if not muted)
- `deleted_at` (TIMESTAMP): Soft delete timestamp (null if visible)
- `last_read_at` (TIMESTAMP): Last time user read messages in this conversation
- `joined_at`, `left_at`: Track participation

**Why**: Each user has their own view of a conversation (pinned, muted, archived, read status). This allows:

- User A can pin a conversation while User B doesn't
- User A can archive a conversation without affecting User B
- Tracking unread counts per user

**Indexes**:

- Unique constraint on `(conversation_id, user_id)` - prevents duplicate participants
- Indexes on `conversation_id`, `user_id`, `deleted_at` for fast queries

### 3. `messages` Table

**Purpose**: Stores all message content

**Key Fields**:

- `id` (TEXT, Primary Key): Unique message identifier
- `conversation_id` (TEXT, Foreign Key → conversations.id): Which conversation
- `sender_id` (TEXT, Foreign Key → users.id): Who sent the message
- `client_id` (TEXT, nullable): Client-generated UUID for optimistic updates and deduplication
- `body` (TEXT): Message content
- `message_type` (MessageType): `TEXT` or `SYSTEM`
- `created_at`, `edited_at`: Timestamps

**Why**:

- `client_id` prevents duplicate messages when retrying failed sends
- `message_type` allows system messages (e.g., "User joined") vs regular messages
- Composite index on `(conversation_id, created_at)` for efficient message pagination

**Unique Constraint**: `(sender_id, client_id)` ensures no duplicate messages from the same sender with the same client ID.

### 4. `message_receipts` Table

**Purpose**: Tracks delivery and read status for each message per recipient

**Key Fields**:

- `id` (TEXT, Primary Key): Unique receipt ID
- `message_id` (TEXT, Foreign Key → messages.id): Which message
- `user_id` (TEXT, Foreign Key → users.id): Which recipient
- `delivered_at` (TIMESTAMP, nullable): When message was delivered (fetched by recipient)
- `read_at` (TIMESTAMP, nullable): When message was read (conversation viewed)

**Why**: Separate table because:

- One message can have multiple recipients (future group chat support)
- Each recipient has independent delivery/read status
- Allows querying "all unread messages for user X"

**States**:

- `delivered_at = null, read_at = null`: Sent (single grey tick)
- `delivered_at != null, read_at = null`: Delivered (double grey tick)
- `delivered_at != null, read_at != null`: Read (double blue tick)

**Unique Constraint**: `(message_id, user_id)` ensures one receipt per message per user.

### 5. `message_attachments` Table

**Purpose**: Stores file attachments (images, documents) linked to messages

**Key Fields**:

- `id` (TEXT, Primary Key): Unique attachment ID
- `message_id` (TEXT, Foreign Key → messages.id): Which message
- `type` (AttachmentType): `IMAGE` or `FILE`
- `url` (TEXT): Storage URL or path
- `metadata` (JSONB): Additional data (file size, dimensions, etc.)
- `created_at`: Timestamp

**Why**: Separate table allows:

- Multiple attachments per message
- Flexible metadata storage (JSONB)
- Easy querying of all attachments for a message

### Relationships Summary

```
User
├── createdCircles (Circle[])
├── circleMemberships (CircleMember[])
├── conversationsCreated (Conversation[])
├── conversationMemberships (ConversationParticipant[])
├── sentMessages (Message[])
└── messageReceipts (MessageReceipt[])

Conversation
├── createdBy (User)
├── participants (ConversationParticipant[])
└── messages (Message[])

Message
├── conversation (Conversation)
├── sender (User)
├── receipts (MessageReceipt[])
└── attachments (MessageAttachment[])

MessageReceipt
├── message (Message)
└── user (User)
```

---

## Real-time Implementation

The system uses **Supabase Realtime** for WebSocket-based communication. Supabase provides channels and broadcast events.

### Channel Types

#### 1. Conversation-Specific Channel: `messages:{conversationId}`

**Purpose**: Real-time updates for users actively viewing a specific conversation

**Used By**: `useRealtimeChat` hook

**Events**:

- `new_message`: When a new message is sent in this conversation
- `receipt_update`: When delivery/read status changes for messages in this conversation

**Example**:

```typescript
const channel = supabase.channel(`messages:${conversationId}`);
channel
	.on('broadcast', { event: 'new_message' }, payload => {
		// Handle new message
	})
	.on('broadcast', { event: 'receipt_update' }, payload => {
		// Handle receipt update
	})
	.subscribe();
```

**Why**: Users viewing a chat need instant updates. This channel only sends events relevant to that conversation.

#### 2. User-Specific Channel: `user:{userId}:messages`

**Purpose**: Real-time updates for a specific user across ALL conversations

**Used By**: `useUserMessages` hook

**Events**:

- `new_message`: When user receives a message in any conversation

**Example**:

```typescript
const channel = supabase.channel(`user:${userId}:messages`);
channel
	.on('broadcast', { event: 'new_message' }, payload => {
		// Handle new message (even if not viewing that conversation)
	})
	.subscribe();
```

**Why**: Updates the conversation list in real-time even when user is not viewing a specific chat. Also triggers automatic delivery receipt.

#### 3. Typing Indicator Channel: `typing:{conversationId}`

**Purpose**: Real-time typing indicators for a conversation

**Used By**: `useTypingIndicator` hook

**Events**:

- `typing`: When someone starts typing

**Example**:

```typescript
const channel = supabase.channel(`typing:${conversationId}`);
channel
	.on('broadcast', { event: 'typing' }, payload => {
		// Show typing indicator
	})
	.subscribe();

// Send typing event
channel.send({
	type: 'broadcast',
	event: 'typing',
	payload: { userId: currentUser.id },
});
```

**Why**: Provides instant feedback when someone is typing.

#### 4. Presence Channel: `presence:messages`

**Purpose**: Track online/offline status of users

**Used By**: `useGlobalPresence` hook

**Mechanism**: Uses Supabase Presence API (not broadcast)

**Example**:

```typescript
const channel = supabase.channel('presence:messages', {
	config: {
		presence: {
			key: `user:${userId}`,
		},
	},
});

channel
	.on('presence', { event: 'sync' }, () => {
		const state = channel.presenceState<{ userId: string }>();
		// Extract online user IDs
	})
	.subscribe(async status => {
		if (status === 'SUBSCRIBED') {
			await channel.track({ userId });
		}
	});
```

**Why**: Shows "online" status in chat headers without polling.

### Broadcast Flow

**Server-side (API Route)**:

```typescript
// After creating a message
const channel = supabaseAdmin.channel(`messages:${conversationId}`);
await channel.send({
	type: 'broadcast',
	event: 'new_message',
	payload: messagePayload,
});
await supabaseAdmin.removeChannel(channel);
```

**Client-side (React Hook)**:

```typescript
channel.on('broadcast', { event: 'new_message' }, payload => {
	const message = payload.payload as ChatMessage;
	onMessage(message); // Update React state
});
```

### Why Supabase Realtime?

1. **WebSocket-based**: Low latency, bidirectional communication
2. **Channels**: Organized by conversation/user, reducing unnecessary updates
3. **Broadcast Events**: Custom events for different message types
4. **Presence API**: Built-in online status tracking
5. **Automatic Reconnection**: Handles network issues gracefully

---

## Read Receipts & Delivery Receipts

The system implements a three-state receipt system similar to WhatsApp/iMessage:

### Visual Indicators

- **Single Grey Tick (✓)**: Message sent (not yet delivered)
- **Double Grey Tick (✓✓)**: Message delivered (recipient fetched it)
- **Double Blue Tick (✓✓)**: Message read (recipient viewed conversation)

### Delivery Receipt Flow

**When**: A message is fetched by the recipient (either via API call or real-time)

**Process**:

1. **User fetches messages** (GET `/api/messages/threads/[id]/messages`):

    ```typescript
    // API finds undelivered receipts for fetched messages
    const undeliveredReceipts = await prisma.messageReceipt.findMany({
    	where: {
    		userId,
    		messageId: { in: messageIds },
    		deliveredAt: null,
    	},
    });

    // Update delivery timestamp
    await prisma.messageReceipt.updateMany({
    	where: { userId, messageId: { in: messageIds }, deliveredAt: null },
    	data: { deliveredAt: now },
    });

    // Broadcast to sender
    const channel = supabaseAdmin.channel(`messages:${conversationId}`);
    await channel.send({
    	type: 'broadcast',
    	event: 'receipt_update',
    	payload: { ...receipt, deliveredAt: now.toISOString() },
    });
    ```

2. **Or, user receives message via real-time** (`useUserMessages` hook):

    ```typescript
    // Automatically mark as delivered when received
    markAsDelivered(message.id);
    // Calls POST /api/messages/delivered
    ```

3. **Sender receives broadcast** (`useRealtimeChat` hook):
    ```typescript
    channel.on('broadcast', { event: 'receipt_update' }, payload => {
    	const receipt = payload.payload as MessageReceipt;
    	// Update message receipts in state
    	setMessages(prev =>
    		prev.map(msg =>
    			msg.id === receipt.messageId ? { ...msg, receipts: updateReceipts(msg.receipts, receipt) } : msg,
    		),
    	);
    });
    ```

**Why**: Delivery receipt confirms the message reached the recipient's device, even if they haven't read it yet.

### Read Receipt Flow

**When**: User opens/views a conversation

**Process**:

1. **User opens conversation** (GET `/api/messages/threads/[id]/messages`):
    - API automatically marks all fetched messages as delivered (see above)

2. **User explicitly marks as read** (POST `/api/messages/threads/[id]/read`):

    ```typescript
    // Find all unread receipts for this conversation
    const unreadReceipts = await prisma.messageReceipt.findMany({
    	where: {
    		userId,
    		message: { conversationId },
    		readAt: null,
    	},
    });

    // Update both conversation participant and receipts
    await prisma.$transaction([
    	prisma.conversationParticipant.updateMany({
    		where: { conversationId, userId },
    		data: { lastReadAt: now },
    	}),
    	prisma.messageReceipt.updateMany({
    		where: { userId, message: { conversationId }, readAt: null },
    		data: { readAt: now, deliveredAt: now }, // Also ensure delivered
    	}),
    ]);

    // Broadcast to sender
    const channel = supabaseAdmin.channel(`messages:${conversationId}`);
    for (const receipt of unreadReceipts) {
    	await channel.send({
    		type: 'broadcast',
    		event: 'receipt_update',
    		payload: { ...receipt, readAt: now.toISOString(), deliveredAt: now.toISOString() },
    	});
    }
    ```

3. **Sender receives broadcast** and sees blue ticks

**Why**: Read receipt confirms the recipient actually viewed the message, providing sender confidence.

### State Management

**Message State Calculation** (`MessageBubble.tsx`):

```typescript
function getDeliveryState(message: ChatMessage) {
	// Check local optimistic status first
	if (message.localStatus) {
		return message.localStatus; // 'sending' or 'failed'
	}

	const receipts = message.receipts || [];

	// Check if any receipt is read
	if (receipts.some(receipt => receipt.readAt)) {
		return 'read'; // Double blue tick
	}

	// Check if any receipt is delivered
	if (receipts.some(receipt => receipt.deliveredAt)) {
		return 'delivered'; // Double grey tick
	}

	return 'sent'; // Single grey tick
}
```

**Why**: Handles optimistic updates (sending state) and real receipt states seamlessly.

---

## Message Flow

### Sending a Message

**Step-by-step**:

1. **User types and clicks send** (`ChatContainer.tsx`):

    ```typescript
    const clientId = crypto.randomUUID(); // Generate unique client ID
    const optimistic: ChatMessage = {
    	id: `local-${clientId}`,
    	conversationId: activeId,
    	senderId: currentUser.id,
    	body: messageInput.trim(),
    	localStatus: 'sending', // Optimistic state
    	clientId,
    };
    setMessages(prev => [...prev, optimistic]); // Show immediately
    ```

2. **API call** (POST `/api/messages/threads/[id]/messages`):

    ```typescript
    // Check for duplicate (retry scenario)
    if (clientId) {
      const existing = await prisma.message.findFirst({
        where: { senderId: userId, clientId }
      });
      if (existing) return existing; // Return existing, don't duplicate
    }

    // Create message and receipts in transaction
    const createdMessage = await prisma.$transaction(async tx => {
      const created = await tx.message.create({ ... });

      // Create receipts for all recipients
      await tx.messageReceipt.createMany({
        data: recipientIds.map(recipientId => ({
          messageId: created.id,
          userId: recipientId
        }))
      });

      // Update conversation last_message_at
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: created.createdAt }
      });

      return created;
    });
    ```

3. **Broadcast via Supabase**:

    ```typescript
    // Broadcast to conversation channel (users viewing this chat)
    const conversationChannel = supabaseAdmin.channel(`messages:${conversationId}`);
    await conversationChannel.send({
    	type: 'broadcast',
    	event: 'new_message',
    	payload: messagePayload,
    });

    // Broadcast to each recipient's personal channel (users on chat list)
    for (const recipientId of recipientIds) {
    	const userChannel = supabaseAdmin.channel(`user:${recipientId}:messages`);
    	await userChannel.send({
    		type: 'broadcast',
    		event: 'new_message',
    		payload: messagePayload,
    	});
    }
    ```

4. **Update optimistic message**:
    ```typescript
    const saved = await response.json();
    setMessages(prev =>
    	prev.map(msg =>
    		msg.clientId === clientId
    			? { ...saved, localStatus: undefined } // Replace with real message
    			: msg,
    	),
    );
    ```

**Why Optimistic Updates**: Instant feedback, no waiting for network round-trip.

**Why Client ID**: Prevents duplicate messages on retry (unique constraint on `sender_id + client_id`).

### Receiving a Message

**Two scenarios**:

#### Scenario 1: User is viewing the conversation

**Hook**: `useRealtimeChat`

**Flow**:

```typescript
channel.on('broadcast', { event: 'new_message' }, payload => {
	const message = payload.payload as ChatMessage;

	// Skip if from current user (already handled optimistically)
	if (message.senderId === currentUserId) return;

	// Add to messages
	setMessages(prev => {
		if (prev.some(existing => existing.id === message.id)) {
			return prev; // Prevent duplicates
		}
		return [...prev, message];
	});

	// Auto-mark as read
	fetch(`/api/messages/threads/${conversationId}/read`, { method: 'POST' });
});
```

#### Scenario 2: User is NOT viewing the conversation

**Hook**: `useUserMessages`

**Flow**:

```typescript
channel.on('broadcast', { event: 'new_message' }, payload => {
	const message = payload.payload as ChatMessage;

	// Refresh thread list to show new message preview
	fetchThreads();

	// Auto-mark as delivered
	markAsDelivered(message.id);
});
```

**Why Two Channels**:

- Conversation channel: For users actively chatting
- User channel: For users elsewhere in the app

### Retry Mechanism

**When**: Message send fails (network error, API error)

**Process**:

1. **Mark as failed**:

    ```typescript
    if (!response.ok) {
    	setMessages(prev => prev.map(msg => (msg.clientId === clientId ? { ...msg, localStatus: 'failed' } : msg)));
    }
    ```

2. **User clicks retry**:
    ```typescript
    // POST /api/messages/threads/[id]/retry
    // Uses same clientId, API checks for existing message
    // If exists, returns it (no duplicate)
    // If not, creates new message
    ```

**Why**: `clientId` ensures no duplicates on retry.

### Message Deduplication

**Mechanism**: Unique constraint on `(sender_id, client_id)` in database

**Process**:

```typescript
// Before creating message
if (clientId) {
	const existing = await prisma.message.findFirst({
		where: { senderId: userId, clientId },
	});
	if (existing) {
		return existing; // Return existing, don't create duplicate
	}
}
```

**Why**: Prevents duplicate messages from:

- Network retries
- User clicking send multiple times
- Browser refresh during send

---

## Frontend Components

### ChatContainer

**File**: `components/chat/ChatContainer.tsx`

**Purpose**: Main orchestrator component that manages:

- Conversation list state
- Active conversation state
- Message state
- Real-time subscriptions
- API calls

**Key Responsibilities**:

- Fetch conversations and messages
- Handle message sending (optimistic updates)
- Coordinate real-time hooks
- Manage conversation selection
- Handle retry, pin, mute, archive, delete

**State Management**:

```typescript
const [threads, setThreads] = useState<ChatThread[]>([]);
const [activeId, setActiveId] = useState<string | null>(null);
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [nextCursor, setNextCursor] = useState<string | null>(null);
```

**Real-time Integration**:

- `useRealtimeChat`: For active conversation
- `useUserMessages`: For global message updates
- `useTypingIndicator`: For typing status
- `useGlobalPresence`: For online status

### ChatThread

**File**: `components/chat/ChatThread.tsx`

**Purpose**: Displays messages in a scrollable list

**Features**:

- Message list rendering
- Search within messages
- Load more (pagination)
- Auto-scroll to bottom on new messages

**Props**:

- `messages`: Array of messages to display
- `currentUserId`: For determining own vs other messages
- `onRetry`: Callback for retrying failed messages
- `searchValue`, `onSearchChange`: Search functionality
- `onLoadMore`, `hasMore`: Pagination

### MessageBubble

**File**: `components/chat/MessageBubble.tsx`

**Purpose**: Renders individual message with:

- Message content
- Timestamp
- Delivery/read status indicators
- Retry button (if failed)

**Status Indicators**:

- `sending`: Single grey tick (optimistic)
- `sent`: Single grey tick (no receipts yet)
- `delivered`: Double grey tick (deliveredAt set)
- `read`: Double blue tick (readAt set)
- `failed`: Red alert icon + retry button

**Styling**:

- Own messages: Right-aligned, primary color
- Other messages: Left-aligned, muted color

### MessageComposer

**File**: `components/chat/MessageComposer.tsx`

**Purpose**: Input component for typing and sending messages

**Features**:

- Text input
- Emoji picker (dropdown)
- Send button
- Enter key to send
- Typing indicator trigger (`onTyping`)

**Props**:

- `value`, `onChange`: Controlled input
- `onSend`: Send callback
- `onTyping`: Typing indicator callback
- `disabled`: Disable when chat is not allowed

### ChatHeader

**File**: `components/chat/ChatHeader.tsx`

**Purpose**: Header showing:

- Other user's avatar and name
- Online/offline status
- Typing indicator
- Actions menu (pin, mute, archive, delete)

**Props**:

- `user`: Other user's info
- `isOnline`: Online status
- `isTyping`: Typing indicator
- `isPinned`, `isMuted`, `isArchived`: State flags
- Action callbacks

### ChatList

**File**: `components/chat/ChatList.tsx`

**Purpose**: Sidebar showing list of conversations

**Features**:

- Search conversations
- Conversation preview (last message, unread count)
- Pin indicator
- Mute indicator
- Active conversation highlight

**Props**:

- `threads`: Array of conversations
- `activeId`: Currently selected conversation
- `searchValue`, `onSearch`: Search functionality
- `onSelect`: Conversation selection callback

---

## Custom Hooks

### useRealtimeChat

**File**: `hooks/useRealtimeChat.ts`

**Purpose**: Subscribe to real-time updates for a specific conversation

**Usage**:

```typescript
useRealtimeChat({
	conversationId: activeId,
	currentUserId: currentUser?.id,
	onMessage: handleRealtimeMessage,
	onReceipt: handleRealtimeReceipt,
});
```

**What it does**:

- Subscribes to `messages:{conversationId}` channel
- Listens for `new_message` events
- Listens for `receipt_update` events
- Skips messages from current user (already handled optimistically)
- Unsubscribes on unmount or conversation change

**Why**: Provides real-time updates only for the active conversation, reducing unnecessary processing.

### useUserMessages

**File**: `hooks/useUserMessages.ts`

**Purpose**: Listen for new messages across ALL conversations

**Usage**:

```typescript
useUserMessages({
	userId: currentUser?.id,
	onNewMessage: handleUserMessage,
});
```

**What it does**:

- Subscribes to `user:{userId}:messages` channel
- Listens for `new_message` events
- Automatically marks messages as delivered when received
- Updates conversation list when message received

**Why**: Keeps conversation list updated even when not viewing a specific chat. Also triggers delivery receipts.

### useTypingIndicator (usePresence)

**File**: `hooks/usePresence.ts`

**Purpose**: Track and display typing indicators for a conversation

**Usage**:

```typescript
const { typingUserIds, sendTyping } = useTypingIndicator(conversationId, currentUser);
```

**What it does**:

- Subscribes to `typing:{conversationId}` channel
- Listens for `typing` events
- Tracks typing users with 2.5s timeout (auto-clears)
- Provides `sendTyping()` function to broadcast typing

**Timeout Logic**:

```typescript
// When typing event received
setTypingUserIds(prev => [...prev, senderId]);

// Auto-clear after 2.5s
setTimeout(() => {
	setTypingUserIds(prev => prev.filter(id => id !== senderId));
}, 2500);
```

**Why**: Provides instant feedback when someone is typing, improving UX.

### useGlobalPresence

**File**: `hooks/useGlobalPresence.tsx`

**Purpose**: Track online/offline status of all users

**Usage**:

```typescript
<GlobalPresenceProvider userId={session?.user?.id}>
  {/* App content */}
</GlobalPresenceProvider>

// In child components
const { onlineUserIds, isConnected } = useGlobalPresence();
```

**What it does**:

- Subscribes to `presence:messages` channel
- Tracks own presence with `channel.track({ userId })`
- Listens for presence sync events
- Extracts online user IDs from presence state
- Provides context to all children

**Why**: Shows "online" status in chat headers without polling or individual subscriptions.

---

## API Endpoints

### GET /api/messages/threads

**Purpose**: List all conversations for the current user

**Query Parameters**:

- `q`: Search query (filters by participant name)
- `archived`: Show archived conversations (default: false)

**Response**:

```typescript
ChatThread[] // Array of conversations with:
- id, type, lastMessageAt
- lastMessage (preview)
- participants (other users)
- unreadCount
- pinnedAt, archivedAt, mutedUntil, deletedAt, lastReadAt
- canMessage (boolean)
```

**Process**:

1. Find all conversations where user is a participant
2. Filter by search query (participant name)
3. Filter archived (if not showing archived)
4. Calculate unread count per conversation
5. Check if user can message (shared circle check for direct chats)
6. Sort by pinned first, then lastMessageAt

**File**: `app/api/messages/threads/route.ts`

### POST /api/messages/threads

**Purpose**: Create or get existing direct conversation

**Body**:

```typescript
{
	otherUserId: string;
}
```

**Response**:

```typescript
{
  id: string,
  type: 'DIRECT',
  participants: ChatUser[]
}
```

**Process**:

1. Validate otherUserId (not self, exists, shares circle)
2. Check for existing direct conversation
3. If exists: Restore if deleted, return it
4. If not: Create new conversation with both participants

**File**: `app/api/messages/threads/route.ts`

### GET /api/messages/threads/[id]/messages

**Purpose**: Get messages for a conversation (paginated)

**Query Parameters**:

- `limit`: Number of messages (default: 30, max: 50)
- `cursor`: Message ID for pagination
- `search`: Search within messages

**Response**:

```typescript
{
  messages: ChatMessage[],
  nextCursor: string | null,
  canMessage: boolean
}
```

**Process**:

1. Verify user is participant
2. Fetch messages (paginated if cursor provided)
3. **Auto-mark fetched messages as delivered** (delivery receipt)
4. Broadcast delivery receipts to sender
5. Return messages (reversed for chronological order)

**File**: `app/api/messages/threads/[id]/messages/route.ts`

### POST /api/messages/threads/[id]/messages

**Purpose**: Send a message

**Body**:

```typescript
{
  body: string,
  clientId?: string // For deduplication
}
```

**Response**:

```typescript
ChatMessage; // Created message with receipts
```

**Process**:

1. Validate message body
2. Check for duplicate (if clientId provided)
3. Verify user is participant
4. Check if users can chat (shared circle for direct)
5. Create message and receipts in transaction
6. Update conversation lastMessageAt
7. Restore deleted participants
8. Broadcast to conversation channel
9. Broadcast to each recipient's user channel
10. Return created message

**File**: `app/api/messages/threads/[id]/messages/route.ts`

### POST /api/messages/delivered

**Purpose**: Mark a message as delivered

**Body**:

```typescript
{
	messageId: string;
}
```

**Response**:

```typescript
{
	success: true;
}
```

**Process**:

1. Find receipt for user and message (undelivered)
2. Update deliveredAt timestamp
3. Broadcast receipt update to conversation channel

**File**: `app/api/messages/delivered/route.ts`

**Called By**: `useUserMessages` hook automatically when message received

### POST /api/messages/threads/[id]/read

**Purpose**: Mark all messages in conversation as read

**Response**:

```typescript
{
	success: true;
}
```

**Process**:

1. Find all unread receipts for conversation
2. Update conversationParticipant.lastReadAt
3. Update all receipts (readAt and deliveredAt)
4. Broadcast receipt updates to conversation channel

**File**: `app/api/messages/threads/[id]/read/route.ts`

**Called By**:

- Automatically when fetching messages (GET messages endpoint)
- When receiving message via real-time (`useRealtimeChat`)

### POST /api/messages/threads/[id]/retry

**Purpose**: Retry sending a failed message

**Body**:

```typescript
{
  body: string,
  clientId: string
}
```

**Response**:

```typescript
ChatMessage; // Existing or newly created message
```

**Process**:

1. Check if message with clientId already exists
2. If exists: Return it (no duplicate)
3. If not: Create new message (same as POST messages)

**File**: `app/api/messages/threads/[id]/retry/route.ts`

### PATCH /api/messages/threads/[id]/pin

**Purpose**: Pin or unpin a conversation

**Body**:

```typescript
{
	pinned: boolean;
}
```

**Process**:

- Updates `conversationParticipant.pinnedAt` (set or null)

**File**: `app/api/messages/threads/[id]/pin/route.ts`

### POST /api/messages/threads/[id]/mute

**Purpose**: Mute or unmute a conversation

**Body**:

```typescript
{
	durationMinutes: number;
} // 0 to unmute
```

**Process**:

- Updates `conversationParticipant.mutedUntil` (calculated timestamp or null)

**File**: `app/api/messages/threads/[id]/mute/route.ts`

### POST /api/messages/threads/[id]/archive

**Purpose**: Archive or unarchive a conversation

**Body**:

```typescript
{
	archived: boolean;
}
```

**Process**:

- Updates `conversationParticipant.archivedAt` (set or null)

**File**: `app/api/messages/threads/[id]/archive/route.ts`

### PATCH /api/messages/threads/[id]/delete

**Purpose**: Soft delete a conversation (hide from list)

**Process**:

- Updates `conversationParticipant.deletedAt` (set to now)

**File**: `app/api/messages/threads/[id]/delete/route.ts`

---

## Important Questions Answered

### How does real-time work?

**Answer**: The system uses Supabase Realtime, which provides WebSocket-based communication.

1. **Server-side**: After database operations (create message, update receipt), the API uses `supabaseAdmin` to broadcast events to specific channels:

    ```typescript
    const channel = supabaseAdmin.channel(`messages:${conversationId}`);
    await channel.send({
    	type: 'broadcast',
    	event: 'new_message',
    	payload: messageData,
    });
    ```

2. **Client-side**: React hooks subscribe to channels and listen for broadcast events:

    ```typescript
    const channel = supabase.channel(`messages:${conversationId}`);
    channel.on('broadcast', { event: 'new_message' }, payload => {
    	// Update React state
    });
    ```

3. **Channels**: Different channels for different purposes:
    - `messages:{conversationId}`: Conversation-specific updates
    - `user:{userId}:messages`: User-specific updates (all conversations)
    - `typing:{conversationId}`: Typing indicators
    - `presence:messages`: Online status

**Why WebSockets**: Low latency, bidirectional, real-time updates without polling.

### How do read receipts work?

**Answer**: Read receipts track when a user actually views a conversation.

1. **Trigger**: When user opens a conversation or receives a message while viewing it
2. **Process**:
    - API finds all unread receipts for that conversation
    - Updates `messageReceipt.readAt` timestamp
    - Updates `conversationParticipant.lastReadAt`
    - Broadcasts receipt updates to conversation channel
3. **Visual**: Sender sees double blue tick (✓✓) when recipient reads
4. **State**: Message state changes from "delivered" to "read"

**Key Code**:

```typescript
// POST /api/messages/threads/[id]/read
await prisma.messageReceipt.updateMany({
	where: { userId, message: { conversationId }, readAt: null },
	data: { readAt: now, deliveredAt: now },
});
```

### How do delivery receipts work?

**Answer**: Delivery receipts track when a message reaches the recipient's device.

1. **Trigger**: When user fetches messages (GET endpoint) or receives via real-time
2. **Process**:
    - API finds undelivered receipts for fetched messages
    - Updates `messageReceipt.deliveredAt` timestamp
    - Broadcasts receipt update to conversation channel
3. **Visual**: Sender sees double grey tick (✓✓) when delivered
4. **State**: Message state changes from "sent" to "delivered"

**Key Code**:

```typescript
// GET /api/messages/threads/[id]/messages
await prisma.messageReceipt.updateMany({
	where: { userId, messageId: { in: messageIds }, deliveredAt: null },
	data: { deliveredAt: now },
});
```

**Auto-delivery**: `useUserMessages` hook automatically marks as delivered when message received via real-time.

### How is message deduplication handled?

**Answer**: Using `clientId` (client-generated UUID) with database unique constraint.

1. **On send**: Generate `clientId = crypto.randomUUID()`
2. **On API**: Check if message with `(senderId, clientId)` already exists
3. **If exists**: Return existing message (no duplicate)
4. **If not**: Create new message
5. **Database**: Unique constraint on `(sender_id, client_id)` prevents duplicates

**Why**: Prevents duplicate messages from:

- Network retries
- User clicking send multiple times
- Browser refresh during send

**Key Code**:

```typescript
if (clientId) {
	const existing = await prisma.message.findFirst({
		where: { senderId: userId, clientId },
	});
	if (existing) return existing; // No duplicate
}
```

### How does optimistic UI work?

**Answer**: Show message immediately before API response.

1. **On send**: Create optimistic message with `localStatus: 'sending'`
2. **Add to state**: Show immediately in UI
3. **API call**: Send to server
4. **On success**: Replace optimistic with real message (remove `localStatus`)
5. **On failure**: Update `localStatus: 'failed'`, show retry button

**Benefits**: Instant feedback, no waiting for network round-trip.

**Key Code**:

```typescript
const optimistic: ChatMessage = {
	id: `local-${clientId}`,
	localStatus: 'sending',
	// ... other fields
};
setMessages(prev => [...prev, optimistic]);

// After API response
setMessages(prev => prev.map(msg => (msg.clientId === clientId ? { ...saved, localStatus: undefined } : msg)));
```

### How is online status tracked?

**Answer**: Using Supabase Presence API.

1. **On mount**: User subscribes to `presence:messages` channel
2. **Track presence**: `channel.track({ userId })` announces user is online
3. **Sync event**: When presence state changes, all subscribers receive sync event
4. **Extract online users**: Parse presence state to get online user IDs
5. **Display**: Show "online" in chat header if user ID in online list

**Why**: Built-in Supabase feature, no custom polling needed.

**Key Code**:

```typescript
channel.subscribe(async status => {
	if (status === 'SUBSCRIBED') {
		await channel.track({ userId }); // Announce online
	}
});

channel.on('presence', { event: 'sync' }, () => {
	const state = channel.presenceState<{ userId: string }>();
	const online = Object.values(state).flatMap(entries => entries.map(entry => entry.userId));
	setOnlineUserIds([...new Set(online)]);
});
```

### How do typing indicators work?

**Answer**: Broadcast typing events with auto-timeout.

1. **On typing**: Call `sendTyping()` function
2. **Broadcast**: Send typing event to `typing:{conversationId}` channel
3. **Receive**: Other users receive typing event
4. **Display**: Show "typing..." in chat header
5. **Timeout**: Auto-clear after 2.5 seconds (if no new typing event)

**Why**: Provides instant feedback, improves UX.

**Key Code**:

```typescript
// Send typing
channel.send({
	type: 'broadcast',
	event: 'typing',
	payload: { userId: currentUser.id },
});

// Receive typing
channel.on('broadcast', { event: 'typing' }, payload => {
	const senderId = payload.payload?.userId;
	setTypingUserIds(prev => [...prev, senderId]);

	// Auto-clear after 2.5s
	setTimeout(() => {
		setTypingUserIds(prev => prev.filter(id => id !== senderId));
	}, 2500);
});
```

### How are unread counts calculated?

**Answer**: Count messages created after user's `lastReadAt`.

**Process**:

```typescript
const unreadCount = await prisma.message.count({
	where: {
		conversationId: conversation.id,
		senderId: { not: userId }, // Don't count own messages
		createdAt: { gt: currentParticipant.lastReadAt }, // After last read
	},
});
```

**When updated**: When user marks conversation as read (POST `/read` endpoint).

### How does message pagination work?

**Answer**: Cursor-based pagination using message ID and createdAt.

**Process**:

1. **First load**: Fetch latest 30 messages (ordered by createdAt DESC)
2. **Get cursor**: Last message ID becomes cursor
3. **Load more**: Fetch messages where `createdAt < cursorMessage.createdAt`
4. **Append**: Prepend older messages to list

**Key Code**:

```typescript
const whereClause = {
	conversationId: id,
	...(cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {}),
};

const messages = await prisma.message.findMany({
	where: whereClause,
	orderBy: { createdAt: 'desc' },
	take: limit,
});

const nextCursor = messages.length === limit ? messages[messages.length - 1]?.id : null;
```

### How does the chat permission system work?

**Answer**: Users can only chat if they share at least one circle.

**Check** (`_utils.ts`):

```typescript
async function canUsersChat(userId: string, otherUserId: string): Promise<boolean> {
	const shared = await getSharedCircleIds(userId, otherUserId);
	return shared.length > 0;
}
```

**Process**:

1. Find all circles both users are members of (where `leftAt` is null)
2. Count circles with both users
3. If count > 0: Can chat
4. If count = 0: Cannot chat (chat disabled)

**Enforced**:

- When creating conversation (POST `/api/messages/threads`)
- When sending message (POST `/api/messages/threads/[id]/messages`)
- Displayed in UI (`canMessage` flag)

---

## Summary

The real-time chat feature is built on:

1. **Database**: 5 tables with proper relationships and indexes
2. **Real-time**: Supabase Realtime with multiple channel types
3. **Receipts**: Three-state system (sent → delivered → read)
4. **Optimistic UI**: Instant feedback with proper error handling
5. **Deduplication**: Client ID prevents duplicate messages
6. **Presence**: Online status and typing indicators
7. **Permissions**: Circle-based chat restrictions

The architecture ensures low latency, reliability, and a smooth user experience similar to modern messaging apps.
