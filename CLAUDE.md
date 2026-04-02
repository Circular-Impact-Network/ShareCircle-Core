# ShareCircle - Claude Code Project Guide

## Project Overview

**ShareCircle** is a community-based item sharing platform built under the Circular Impact Network initiative. It enables users to create trust circles (sharing groups), list items for sharing, and manage borrowing/lending workflows with real-time chat and comprehensive notifications.

- **Purpose**: Enable peer-to-peer item sharing within trusted communities
- **Domain**: Circular economy, community building, resource sharing
- **Tech Generation**: Next.js 16, React 19, Modern TypeScript
- **Status**: MVP in active development (2025)

## Core Domain Model

Understanding the domain model is critical for working effectively in this codebase.

### Key Entities

#### 1. Users
- Authentication: Email/phone OTP + Google OAuth via NextAuth.js
- Profile: Display name, bio, avatar
- Trust system: Rating as borrower/lender (future)
- Verification: Email verification required before full access

#### 2. Circles (Trust Groups)
- Private sharing groups with invite codes
- Member roles: ADMIN (creator + elevated permissions) or MEMBER
- Join methods: CODE (invite code), LINK (invite link), or created by user
- Invite codes: Unique per circle, expire after 7 days
- Items can be shared across multiple circles simultaneously

#### 3. Items
- Owner-listed items with photos, descriptions, metadata
- Categories and tags for organization and filtering
- AI-assisted: Google Gemini Vision extracts metadata from images
- Vector embeddings: 1024-dim multimodal embeddings for semantic search (pgvector)
- Multi-circle sharing: Item can be visible in multiple circles
- Availability: AVAILABLE (can borrow) or ARCHIVED (hidden)

#### 4. Borrowing Workflow
The borrowing system has three interconnected components:

**a) Borrow Requests**
- User requests to borrow an item with desired start/end dates
- Owner approves/declines with optional message
- States: PENDING → APPROVED/DECLINED/CANCELLED

**b) Borrow Queue**
- When item is unavailable, users join a queue
- Position-based: first in queue gets notified when available
- States: WAITING (in line) → READY (notified) → SKIPPED (didn't respond)

**c) Borrow Transactions**
- Active borrow record tracking borrower, owner, dates
- States: ACTIVE → RETURN_PENDING (borrower marks returned) → COMPLETED (owner confirms) → CANCELLED
- Rating system: Both parties rate each other after completion

#### 5. Item Requests
- When users can't find an item they need, they post a request
- Visible to circle members
- States: OPEN → FULFILLED (someone responds) → CANCELLED

#### 6. Conversations & Messaging
- Direct (1:1) and group conversations
- Real-time messaging via Supabase Realtime (WebSocket)
- Message types: TEXT, SYSTEM (automated messages), attachments
- Delivery tracking: Sent → Delivered → Read receipts
- Conversation states: Pinned, archived, muted
- Client-side deduplication: clientId prevents duplicate sends

#### 7. Notifications
- Dual-channel: In-app (persisted in DB) + Web Push (browser notifications)
- Types: 11 different notification types covering all workflows
  - NEW_MESSAGE, BORROW_REQUEST_RECEIVED, BORROW_REQUEST_APPROVED, etc.
- User preferences: Global toggles + per-category overrides
- Queue-based delivery: Uses `after()` for non-blocking sends

### Key Workflows

1. **Circle Creation & Invitation**
   - User creates circle → generates invite code/link → shares with friends
   - Friends join via code/link → become members → see shared items

2. **Item Listing**
   - User uploads photo → AI extracts metadata → user edits/confirms → publishes to selected circles
   - Vector embedding generated for semantic search

3. **Borrowing Flow**
   - User browses items → requests borrow → owner approves → transaction created → item returned → both rate
   - If unavailable: User joins queue → gets notified when available

4. **Real-time Chat**
   - User sends message → Supabase broadcast to participants → delivery/read receipts tracked
   - Typing indicators, online presence tracked via Supabase Presence

5. **Notification Delivery**
   - Event occurs (request, approval, etc.) → `queueNotification()` called → `after()` sends in-app + push
   - Non-blocking: HTTP response returns immediately, notifications sent asynchronously

## Tech Stack Details

### Frontend

- **Framework**: Next.js 16.0.10 (App Router, React 19.2.0 with Server Components)
- **State Management**: Redux Toolkit 2.11 with RTK Query for API caching
- **Styling**: Tailwind CSS 4.1.9 + PostCSS (JIT mode)
- **UI Components**: Radix UI (complete suite: Dialog, Dropdown, Tabs, etc.)
- **Forms**: react-hook-form 7.54.2 + Zod 3.25.11 for validation
- **Real-time**: @supabase/supabase-js 2.86.0 (Realtime subscriptions)
- **Icons**: lucide-react
- **Toasts**: sonner
- **PWA**: @ducanh2912/next-pwa 10.4.2 with Workbox 7.3.1 (offline support)

### Backend

- **Runtime**: Node.js with Next.js API routes (app/api/)
- **Authentication**: next-auth 4.24.13 (JWT strategy, Credentials + Google OAuth)
- **Database**: PostgreSQL via Prisma ORM 6.19.0 with Prisma Accelerate for connection pooling
- **Vector Search**: pgvector extension (1024-dimensional embeddings)
- **Storage**: Supabase Storage (images, attachments with signed URLs)
- **AI**: @ai-sdk/google 2.0.51 (Google Gemini) for vision + embeddings
- **Email**: Gmail SMTP via nodemailer (OTP, password reset)
- **SMS**: Twilio (phone OTP)
- **Push Notifications**: web-push 3.6.7 with VAPID keys

### Key Libraries

- `@prisma/client` v6.19 - Database ORM with type generation
- `@reduxjs/toolkit` v2.11 - State management + RTK Query
- `@supabase/supabase-js` v2.86 - Realtime + Storage client
- `next-auth` v4.24 - Authentication framework
- `zod` v3.25 - TypeScript-first schema validation
- `ai` v5.0 - Vercel AI SDK (embeddings, streaming)
- `web-push` v3.6 - Push notification library
- `bcryptjs` v2.4 - Password hashing
- `libphonenumber-js` v1.11 - Phone number validation
- `@radix-ui/*` v1.x - Accessible UI primitives

### Build & Dev Tools

- **Package Manager**: npm
- **TypeScript**: 5.x with strict mode enabled
- **Code Quality**: ESLint + Prettier (120 char width, tabs, single quotes)
- **Testing (Unit)**: Vitest 3.1.7 with happy-dom
- **Testing (E2E)**: Playwright 1.58.0 (Chrome, auto-retry)
- **PWA**: Workbox for service worker caching strategies

## Architecture Patterns

### 1. Server Components vs Client Components

Next.js 16 defaults to **React Server Components** in the App Router.

**Server Components (default)**:
- No "use client" directive needed
- Run only on server, never sent to client
- Can directly access database (Prisma), file system, secrets
- Cannot use hooks (useState, useEffect), event handlers, browser APIs
- Examples: Layouts, data-fetching pages, auth checks

**Client Components ("use client")**:
- Must declare "use client" at top of file
- Can use hooks, state, effects, event handlers
- Interactive UI: buttons, forms, modals
- Real-time subscriptions (useRealtimeChat, etc.)
- Examples: Page components, interactive cards, chat UI

**Pattern**: Keep Server Components as outer shell (layout, data fetching), nest Client Components for interactivity.

```typescript
// app/(authenticated)/home/page.tsx (Server Component)
import HomePage from '@/components/pages/HomePage'; // Client Component

export default async function HomeRoute() {
  // Server-side data fetching or auth check
  return <HomePage />;
}

// components/pages/HomePage.tsx (Client Component)
'use client';
import { useGetItemsQuery } from '@/lib/redux/api/itemsApi';

export default function HomePage() {
  const { data } = useGetItemsQuery();
  // Interactive UI with hooks
}
```

### 2. API Route Pattern

All API routes follow a consistent pattern for security and reliability.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  // 1. Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Prisma query
    const data = await prisma.someModel.findMany({
      where: { userId: session.user.id },
    });

    // 3. Return response
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Key principles**:
1. Always check session first
2. Use Prisma singleton from `@/lib/prisma`
3. Proper error handling with try-catch
4. Generic error messages to client (don't leak internals)
5. Descriptive console.error for debugging

### 3. RTK Query API Slices

RTK Query provides auto-caching, background refetch, and optimistic updates.

**Pattern**: Create API slices in `lib/redux/api/` directory.

```typescript
// lib/redux/api/itemsApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const itemsApi = createApi({
  reducerPath: 'itemsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Items'],
  endpoints: (builder) => ({
    getItems: builder.query({
      query: () => '/items',
      providesTags: ['Items'],
    }),
    createItem: builder.mutation({
      query: (body) => ({
        url: '/items',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Items'], // Refetch getItems after create
    }),
  }),
});

export const { useGetItemsQuery, useCreateItemMutation } = itemsApi;
```

**Usage in components**:
```typescript
const { data: items, isLoading, error } = useGetItemsQuery();
const [createItem] = useCreateItemMutation();
```

**Benefits**:
- Automatic caching by endpoint + params
- Background refetch on window focus
- Optimistic UI updates
- Loading/error states built-in
- Tag-based cache invalidation

### 4. Real-time Subscriptions

Supabase Realtime enables WebSocket-based real-time updates.

**Pattern**: Custom hooks in `hooks/` directory.

```typescript
// hooks/useRealtimeChat.ts
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export function useRealtimeChat(conversationId: string, onMessage: (msg) => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        onMessage(payload);
      })
      .subscribe();

    // CRITICAL: Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, onMessage]);
}
```

**Usage**:
```typescript
useRealtimeChat(conversationId, (message) => {
  // Update UI with new message
});
```

**Important**: Always cleanup channels on unmount to prevent memory leaks.

### 5. Deferred Side Effects with `after()`

**Critical Pattern** for serverless reliability: Use `after()` from `next/server` for non-blocking work.

**Problem**: In serverless environments (Vercel), the runtime shuts down immediately after the HTTP response is sent. Fire-and-forget promises (`void promise`) may not complete.

**Solution**: Use `after()` to defer work until after the response is sent, but guarantee execution.

```typescript
// app/api/borrow-requests/route.ts
import { after } from 'next/server';
import { queueNotification } from '@/lib/notify';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // 1. Main business logic (blocking)
  const borrowRequest = await prisma.borrowRequest.create({ ... });

  // 2. Defer notifications (non-blocking)
  after(() => {
    queueNotification({
      type: 'BORROW_REQUEST_RECEIVED',
      userId: borrowRequest.ownerId,
      // ...
    });
  });

  // 3. Response returns immediately
  return NextResponse.json(borrowRequest);
}
```

**Helper**: `queueNotification()` in `lib/notify.ts` wraps `after()` + notification sending.

**Use cases**:
- Sending notifications (in-app + push)
- Broadcasting to Supabase Realtime
- Generating vector embeddings
- Logging analytics

**Important**: `after()` only works in API routes, NOT in Server Components.

### 6. Database Access with Prisma

**Always use the Prisma singleton** from `@/lib/prisma`.

```typescript
import { prisma } from '@/lib/prisma';

// ✅ Correct
const items = await prisma.item.findMany();

// ❌ Incorrect (creates new connection)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

**Connection pooling**: Uses Prisma Accelerate with `directUrl` for migrations.

**Common patterns**:

```typescript
// Relations with eager loading
const item = await prisma.item.findUnique({
  where: { id },
  include: {
    owner: true,
    circles: { include: { circle: true } },
  },
});

// Transactions for atomicity
await prisma.$transaction(async (tx) => {
  await tx.borrowRequest.update({ ... });
  await tx.borrowTransaction.create({ ... });
});

// Raw SQL for pgvector
await prisma.$executeRaw`
  UPDATE "Item"
  SET embedding = ${Prisma.raw(`'[${embedding}]'::vector`)}
  WHERE id = ${id}
`;
```

**Indexes**: Key indexes are defined in schema.prisma for performance.

## Code Organization

### Directory Structure

```
/Users/nitingupta/Desktop/Personal/Projects/share-circle/
├── app/
│   ├── (authenticated)/          # Protected routes (requires auth)
│   │   ├── home/                 # Main dashboard
│   │   ├── browse/               # Item discovery & search
│   │   ├── circles/              # Circle management
│   │   │   ├── [circleId]/       # Circle details & members
│   │   │   └── join/[inviteCode] # Join via invite
│   │   ├── messages/             # Chat interface
│   │   │   └── [conversationId]/ # Conversation view
│   │   ├── items/                # Item creation & editing
│   │   ├── listings/             # My listings (items I own)
│   │   ├── requests/             # Item requests & borrow requests
│   │   ├── activity/             # Borrowing activity (transactions)
│   │   ├── notifications/        # Notification center
│   │   └── settings/             # User settings & preferences
│   ├── api/                      # API routes
│   │   ├── auth/                 # NextAuth handlers ([...nextauth]/route.ts)
│   │   ├── items/                # Item CRUD, search, upload
│   │   ├── circles/              # Circle management
│   │   ├── messages/             # Chat API
│   │   │   └── threads/          # Message operations
│   │   ├── borrow-requests/      # Borrow request workflow
│   │   ├── borrow-queue/         # Queue management
│   │   ├── borrow-transactions/  # Transaction operations
│   │   ├── notifications/        # Notification fetching, marking read
│   │   ├── push/                 # Web push subscriptions
│   │   ├── generate-description/ # AI vision endpoint
│   │   └── upload/               # File upload to Supabase
│   ├── login/                    # Public auth pages
│   ├── signup/
│   ├── verify-email/
│   ├── reset-password/
│   ├── forgot-password/
│   ├── layout.tsx                # Root layout with providers
│   └── globals.css               # Global Tailwind styles
│
├── components/
│   ├── ui/                       # Radix-based design system
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ... (20+ primitives)
│   ├── pages/                    # Page-specific client components
│   │   ├── HomePage.tsx
│   │   ├── BrowsePage.tsx
│   │   └── ...
│   ├── cards/                    # Item/listing cards
│   ├── chat/                     # Chat UI components
│   │   ├── ChatContainer.tsx
│   │   ├── MessageList.tsx
│   │   └── MessageInput.tsx
│   ├── modals/                   # Modal dialogs
│   ├── dialogs/                  # Radix dialog wrappers
│   ├── auth/                     # Auth forms
│   ├── settings/                 # Settings panels
│   └── pwa/                      # PWA provider & handlers
│
├── lib/
│   ├── auth.ts                   # NextAuth configuration
│   ├── prisma.ts                 # Prisma client singleton
│   ├── ai.ts                     # Google Gemini (vision, embeddings)
│   ├── supabase.ts               # Supabase admin client
│   ├── notifications.ts          # Notification creation + web push
│   ├── notify.ts                 # Queue helpers with after()
│   ├── chat-message-side-effects.ts # Chat broadcasts
│   ├── email.ts                  # Gmail SMTP
│   ├── sms.ts                    # Twilio SMS
│   ├── push.ts                   # Web push helpers
│   ├── rate-limit.ts             # Rate limiting middleware
│   ├── phone.ts                  # Phone validation
│   ├── otp.ts                    # OTP generation/verification
│   ├── redux/                    # Redux store & slices
│   │   ├── store.ts              # Store configuration
│   │   ├── api/                  # RTK Query endpoints
│   │   │   ├── itemsApi.ts
│   │   │   ├── messagesApi.ts
│   │   │   ├── borrowApi.ts
│   │   │   ├── circlesApi.ts
│   │   │   ├── notificationsApi.ts
│   │   │   └── userApi.ts
│   │   └── slices/               # Redux slices
│   │       ├── userSlice.ts      # Auth state, profile
│   │       └── uiSlice.ts        # UI state (modals, sidebar)
│   └── utils.ts                  # Utility functions
│
├── hooks/                        # Custom React hooks
│   ├── useRealtimeChat.ts        # Supabase chat subscriptions
│   ├── useRealtimeNotifications.ts # Realtime notification updates
│   ├── usePresence.ts            # User presence tracking
│   ├── useOnlineStatus.ts        # Network status
│   ├── useProgressivePagination.ts # Infinite scroll pagination
│   └── use-toast.ts              # Toast notifications
│
├── types/                        # TypeScript type definitions
│   ├── next-auth.d.ts            # Extend NextAuth types
│   └── ...
│
├── prisma/
│   ├── schema.prisma             # Database schema (544 lines)
│   └── migrations/               # Migration history
│
├── tests/
│   ├── unit/                     # Vitest unit tests
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   └── e2e/                      # Playwright E2E tests
│       ├── auth.spec.ts
│       ├── circles.spec.ts
│       ├── items.spec.ts
│       ├── borrowing.spec.ts
│       ├── messages.spec.ts
│       └── notifications.spec.ts
│
├── public/                       # Static assets
│   ├── manifest.json             # PWA manifest
│   ├── icons/                    # PWA icons
│   └── ...
│
├── middleware.ts                 # Next.js Edge middleware (auth)
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── playwright.config.ts          # Playwright E2E config
├── vitest.config.ts              # Vitest unit test config
├── package.json                  # Dependencies & scripts
├── .env.example                  # Environment variable template
├── README.md                     # Project overview
├── PRD.md                        # Product requirements
├── TESTING.md                    # E2E testing guide
├── REALTIME_CHAT_DOCUMENTATION.md # Chat architecture
├── NOTIFICATIONS_BORROW_LENDING_DOCUMENTATION.md # Notification system
└── CLAUDE.md                     # This file
```

### Naming Conventions

- **Files**: kebab-case (e.g., `borrow-requests.tsx`, `use-toast.ts`)
- **Components**: PascalCase (e.g., `ItemCard`, `ChatContainer`)
- **Hooks**: camelCase with "use" prefix (e.g., `useRealtimeChat`)
- **API routes**: RESTful (e.g., `GET /api/items`, `POST /api/items`)
- **Database fields**: snake_case (e.g., `created_at`, `user_id`)
- **Types/Interfaces**: PascalCase (e.g., `User`, `BorrowRequest`)

## Development Workflows

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Configure required environment variables
# Edit .env.local with:
#   - DATABASE_URL (PostgreSQL with pgvector)
#   - DIRECT_URL (direct connection for migrations)
#   - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
#   - NEXTAUTH_URL (http://localhost:3003 for dev)
#   - NEXT_PUBLIC_SUPABASE_URL
#   - NEXT_PUBLIC_SUPABASE_ANON_KEY
#   - SUPABASE_SERVICE_ROLE_KEY
#   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (optional, for OAuth)

# 4. Run database migrations
npm run db:migrate:dev

# 5. Start development server
npm run dev
# App runs on http://localhost:3003
```

### Database Management

```bash
# Generate Prisma Client (after schema changes)
npm run db:generate

# Create and apply a new migration
npm run db:migrate:dev

# Push schema changes without migration (dev only, destructive)
npm run db:push

# Open Prisma Studio (visual database browser)
npm run db:studio
# Opens at http://localhost:5555

# Seed database (if configured)
npm run db:seed
```

### Testing

```bash
# Run all tests (unit + E2E)
npm test

# Unit tests only (Vitest)
npm run test:unit
npm run test:unit:watch   # Watch mode

# E2E tests only (Playwright)
npm run test:e2e
npm run test:e2e:ui       # UI mode for debugging

# E2E with specific browser
npx playwright test --project=chromium

# E2E headed mode (see browser)
npx playwright test --headed
```

**E2E Testing Notes**:
- Tests use `e2e+*@example.com` email pattern
- Set `E2E_AUTO_VERIFY=true` to skip email sending
- Set `TEST_CLEANUP_SECRET` env var to enable test data cleanup endpoint
- See [TESTING.md](TESTING.md) for detailed guide

### Code Quality

```bash
# Lint check
npm run lint

# Format code
npm run format

# Format check only (no write)
npm run format:check
```

### Building

```bash
# Production build (includes Prisma Client generation)
npm run build

# Start production server
npm start
```

## Best Practices

### ✅ Always Follow

1. **Authentication First**: Always check `getServerSession(authOptions)` in API routes before any business logic
2. **Prisma Singleton**: Import from `@/lib/prisma`, never instantiate new `PrismaClient()`
3. **Type Safety**: Use Prisma-generated types, validate with Zod schemas
4. **Signed URLs**: Always use `getSignedUrl(path, bucket)` for Supabase storage URLs (1hr expiry)
5. **Non-Blocking Side Effects**: Use `after()` for notifications, broadcasts, embeddings
6. **Error Handling**: Try-catch blocks with descriptive `console.error`, return generic errors to client
7. **Rate Limiting**: Check existing patterns in `lib/rate-limit.ts` before adding public endpoints
8. **Real-time Cleanup**: Always remove Supabase channels on unmount/cleanup
9. **Server Components Default**: Only use "use client" when needed (hooks, state, events, browser APIs)
10. **Path Aliases**: Use `@/` for all imports (defined in tsconfig paths)
11. **No Auto-Generated Documentation**: Never create .md files at the end of tasks or conversations unless explicitly requested by the user. Avoid over-engineering by adding documentation that wasn't asked for. Keep the repository focused on what's needed.

### Testing Best Practices

1. **E2E Test Data**: Use `e2e+*@example.com` pattern for test emails
2. **Auto-Verify**: Set `E2E_AUTO_VERIFY=true` to disable email sending in tests
3. **Cleanup**: Use `TEST_CLEANUP_SECRET` for automatic test data cleanup
4. **Test IDs**: Use `data-testid` attributes for stable selectors
5. **Network Idle**: Wait for `networkidle` after navigation for reliability
6. **Mock External**: Route/mock image upload and AI detection in E2E tests to avoid costs

### Common Gotchas

Learn from these common mistakes to save debugging time:

1. **Vector Embeddings**: Require raw SQL with `Prisma.raw`, no native Prisma support
   ```typescript
   await prisma.$executeRaw`
     UPDATE "Item" SET embedding = ${Prisma.raw(`'[${values}]'::vector`)} WHERE id = ${id}
   `;
   ```

2. **Supabase Client**: Use `supabaseAdmin` (service role) on server, `createClient()` on client
   - Server broadcasts: Must use admin client, not anon key
   - Client subscriptions: Use anon key client

3. **NextAuth Session**: `session.user.id` is string, not the default NextAuth type
   - Extended via `types/next-auth.d.ts`

4. **Prisma Relations**: Use `include` for eager loading, `select` for field control
   - Avoid N+1 queries by including relations upfront

5. **Real-time Broadcasts**: Must use `supabaseAdmin` on server, not client key
   - Client key lacks broadcast permissions

6. **`after()` Scope**: Only works in API routes (`app/api/`), NOT in Server Components
   - Use for deferred work only in route handlers

7. **Signed URL Expiry**: Defaults to 1 hour, regenerate on frontend if expired
   - Handle 403 errors by requesting fresh URL

8. **Phone Validation**: Must check `isSupportedPhoneCountry()` before `validatePhoneByCountry()`
   - Unsupported countries will throw

9. **Email Normalization**: Always use `normalizeEmail()` before database queries
   - Prevents duplicate accounts (`test@example.com` vs `Test@example.com`)

10. **PWA Caching**: NetworkOnly for auth, NetworkFirst for API reads
    - Configured in `next.config.ts` with Workbox strategies

### Security Patterns

1. **Circle Membership**: Always verify user is circle member before showing items/data
   ```typescript
   const member = await prisma.circleMember.findFirst({
     where: { circleId, userId, leftAt: null },
   });
   if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
   ```

2. **Owner Checks**: Verify `ownerId === session.user.id` for mutations
3. **Input Validation**: Zod schemas on API routes, not just client-side
4. **Hashed Passwords**: bcryptjs with `compare()`, never plain text storage
5. **OTP Security**: `timingSafeEqualHex()` for comparison, hashed storage
6. **Invite Codes**: Expiry check (7 days default), unique per circle
7. **Signed URLs**: Never expose raw Supabase storage paths to frontend

## Database Schema Highlights

### Key Models

From `prisma/schema.prisma` (simplified for reference):

**User**
- Authentication: email (unique), password (hashed), emailVerified timestamp
- Phone: phone, phoneVerified (for SMS OTP)
- Profile: name, image, bio
- Relations: circles (member of), items (owned), conversations, notifications

**Circle**
- Core: name, description, createdBy (user ID)
- Invite: inviteCode (unique), inviteLink, inviteExpiresAt (7 days)
- Relations: members (CircleMember), items (via ItemCircle join table)

**CircleMember**
- Links: userId, circleId
- Role: role enum (ADMIN | MEMBER)
- Join: joinType enum (CODE | LINK), joinedAt
- Soft delete: leftAt timestamp (null = active member)
- Index: `@@index([userId])`, `@@index([circleId])`

**Item**
- Core: name, description, category, imageUrl, ownerId
- Search: embedding (vector 1024 dim for semantic search)
- State: isAvailable boolean, archivedAt timestamp
- Relations: circles (via ItemCircle), borrowRequests, borrowTransactions
- Index: `@@index([ownerId])`, `@@index([isAvailable])`

**ItemCircle** (Join table for multi-circle sharing)
- Links: itemId, circleId
- Timestamps: sharedAt
- Unique: `@@unique([itemId, circleId])`

**Conversation**
- Type: type enum (DIRECT | GROUP)
- Metadata: name (for groups), lastMessageAt
- Relations: participants (ConversationParticipant), messages

**ConversationParticipant**
- Links: userId, conversationId
- State: pinnedAt, archivedAt, mutedUntil, lastReadAt
- Relations: receipts (MessageReceipt for delivery tracking)

**Message**
- Content: body, messageType enum (TEXT | SYSTEM)
- Metadata: conversationId, senderId, clientId (deduplication)
- Attachments: attachmentUrl, attachmentType
- Index: `@@index([conversationId, createdAt])`

**MessageReceipt** (Delivery tracking)
- Links: messageId, userId
- Tracking: deliveredAt, readAt timestamps

**BorrowRequest**
- Core: itemId, requesterId, startDate, endDate
- Response: status enum (PENDING | APPROVED | DECLINED | CANCELLED)
- Messages: ownerMessage (optional response)
- Index: `@@index([itemId])`, `@@index([requesterId])`

**BorrowQueue**
- Links: itemId, userId, position (order in queue)
- State: status enum (WAITING | READY | SKIPPED)
- Notify: notifiedAt timestamp

**BorrowTransaction**
- Links: itemId, borrowerId, ownerId, borrowRequestId (optional)
- Dates: startDate, endDate, returnedAt, confirmedAt
- Status: status enum (ACTIVE | RETURN_PENDING | COMPLETED | CANCELLED)
- Ratings: borrowerRating, lenderRating, borrowerReview, lenderReview

**Notification**
- Core: userId, type (11 types enum), title, message
- State: status enum (UNREAD | READ), readAt
- Links: relatedId, relatedType, redirectPath
- Metadata: metadata (JSON for flexible data)
- Index: `@@index([userId, status])`, `@@index([userId, createdAt])`

**PushSubscription** (Web Push)
- Links: userId, endpoint (unique)
- Keys: p256dh, auth (encryption keys)
- State: enabled boolean
- Debug: PushSendAttempt records for debugging failed sends

**UserNotificationPreference**
- Global: globalInApp, globalPush toggles
- Overrides: overrides (JSON map of type → {inApp, push} booleans)

### Important Enums

- **MemberRole**: ADMIN, MEMBER
- **ConversationType**: DIRECT, GROUP
- **MessageType**: TEXT, SYSTEM
- **ItemRequestStatus**: OPEN, FULFILLED, CANCELLED
- **BorrowRequestStatus**: PENDING, APPROVED, DECLINED, CANCELLED
- **BorrowQueueStatus**: WAITING, READY, SKIPPED
- **BorrowTransactionStatus**: ACTIVE, RETURN_PENDING, COMPLETED, CANCELLED
- **NotificationStatus**: UNREAD, READ
- **NotificationType**: (11 types)
  - NEW_MESSAGE
  - BORROW_REQUEST_RECEIVED, BORROW_REQUEST_APPROVED, BORROW_REQUEST_DECLINED
  - BORROW_QUEUE_READY
  - RETURN_PENDING, RETURN_CONFIRMED
  - ITEM_REQUEST_FULFILLED
  - CIRCLE_INVITE, NEW_MEMBER_JOINED
  - ITEM_AVAILABLE_SOON

### Critical Indexes

Performance-critical indexes (already defined in schema):

- Circle members: `userId`, `circleId` (membership checks)
- Items: `ownerId`, `isAvailable` (listings, browse)
- Messages: `conversationId + createdAt` (chat pagination)
- Notifications: `userId + status`, `userId + createdAt` (unread count, list)
- Borrow requests: `itemId`, `requesterId` (request management)

## Environment Variables

### Required (Application Will Not Start)

```bash
# Database (PostgreSQL with pgvector extension)
DATABASE_URL="postgresql://user:pass@host:5432/dbname?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host:5432/dbname"  # For migrations

# Authentication (NextAuth.js)
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3003"  # Dev, or production URL

# Supabase (Realtime + Storage)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"  # Server-side only
```

### Optional (Features Work Without)

```bash
# Google OAuth
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-secret"

# Email Notifications (Gmail SMTP)
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-16-char-app-password"

# SMS Notifications (Twilio)
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"

# Web Push Notifications (generate with web-push CLI)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-key"
VAPID_PRIVATE_KEY="your-private-key"
VAPID_SUBJECT="mailto:your-email@example.com"
```

### Testing Flags

```bash
# Auto-verify emails in E2E tests (skip actual email sending)
E2E_AUTO_VERIFY="true"

# Disable email globally
SKIP_EMAIL="true"

# Disable SMS globally
SKIP_SMS="true"

# Enable test data cleanup endpoint (set any value)
TEST_CLEANUP_SECRET="some-secret-value"
```

## Recent Architectural Decisions

Context for understanding "why" behind recent patterns:

1. **Deferred Side Effects (`after()`)**
   - **When**: Late 2024 / Early 2025
   - **Why**: Serverless environments (Vercel) shut down immediately after response
   - **Impact**: All notifications, broadcasts, embeddings now use `after()` or `queueNotification()`
   - **Files**: `lib/notify.ts`, `lib/chat-message-side-effects.ts`

2. **Notification Queue Pattern**
   - **When**: Recent (2025)
   - **Why**: Prevent blocking HTTP responses, improve reliability
   - **Pattern**: `queueNotification()` wraps `after()` + dual-channel send
   - **Files**: `lib/notify.ts`, all API routes with notifications

3. **Supabase Admin for Broadcasts**
   - **When**: Recent (2025)
   - **Why**: Client anon key lacks broadcast permissions, caused silent failures
   - **Change**: Switched from `createClient()` to `supabaseAdmin` on server
   - **Files**: `lib/chat-message-side-effects.ts`, all broadcast code

4. **Multimodal Vector Embeddings**
   - **When**: Recent (2025)
   - **Why**: Better semantic search quality (image + text combined)
   - **Tech**: Voyage AI multimodal embeddings (1024 dimensions)
   - **Files**: `lib/ai.ts`, `app/api/items/route.ts`

5. **API `maxDuration` Raised**
   - **When**: Recent (2025)
   - **Why**: AI operations (vision, embeddings) exceed default timeout
   - **Values**: 60s for AI endpoints
   - **Files**: API route configs with `export const maxDuration = 60;`

6. **Push Notification Debugging**
   - **When**: Recent (2025)
   - **Why**: Silent failures hard to debug in production
   - **Addition**: `PushSendAttempt` table to track failures
   - **Files**: `prisma/schema.prisma`, `lib/notifications.ts`

## Documentation References

This project has excellent documentation. Refer to these files for deep dives:

- **[README.md](README.md)**: Project overview, guiding principles, basic setup
- **[PRD.md](PRD.md)**: Original product requirements document (MVP scope)
- **[TESTING.md](TESTING.md)**: E2E testing guide, email handling, test data cleanup
- **[REALTIME_CHAT_DOCUMENTATION.md](REALTIME_CHAT_DOCUMENTATION.md)**: Chat architecture, message delivery, presence tracking
- **[NOTIFICATIONS_BORROW_LENDING_DOCUMENTATION.md](NOTIFICATIONS_BORROW_LENDING_DOCUMENTATION.md)**: Notification system, borrowing workflows, queue management
- **[CONTRIBUTE.MD](CONTRIBUTE.MD)**: Contribution guidelines, code style, PR process
- **[CODE_OF_CONDUCT.MD](CODE_OF_CONDUCT.MD)**: Community standards and expectations

## Common Tasks Reference

Quick patterns for frequent operations:

### Add a New API Endpoint

1. Create `app/api/[route]/route.ts`
2. Add session check with `getServerSession(authOptions)`
3. Use Prisma for data access (import from `@/lib/prisma`)
4. Optionally create RTK Query slice in `lib/redux/api/`
5. Consider rate limiting for public endpoints (see `lib/rate-limit.ts`)

Example:
```typescript
// app/api/user-preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const preferences = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(preferences);
}
```

### Add a New Database Model

1. Update `prisma/schema.prisma` with new model
2. Run `npm run db:migrate:dev` to create migration
3. Update TypeScript types in components/API routes (auto-generated)
4. Add API routes if needed for CRUD operations
5. Update this CLAUDE.md schema section for documentation

### Add Real-time Feature

1. Create custom hook in `hooks/` (e.g., `useRealtimePresence.ts`)
2. Subscribe to Supabase channel with unique name
3. Handle payload updates (setState, dispatch, etc.)
4. Cleanup channel on unmount
5. Broadcast from API routes using `supabaseAdmin`

Example:
```typescript
// hooks/useRealtimePresence.ts
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export function useRealtimePresence(circleId: string, onUpdate: (data) => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`presence:circle:${circleId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onUpdate(state);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [circleId, onUpdate]);
}
```

### Add Notification Type

1. Add to `NotificationType` enum in `prisma/schema.prisma`
2. Run `npm run db:migrate:dev`
3. Update `NOTIFICATION_PATHS` map in `lib/notify.ts` with redirect path
4. Add notification catalog entry in `lib/notification-catalog.ts` (title/message templates)
5. Use `queueNotification()` in relevant API routes
6. Test both in-app and push delivery

Example:
```typescript
// In API route
import { queueNotification } from '@/lib/notify';
import { after } from 'next/server';

after(() => {
  queueNotification({
    type: 'NEW_NOTIFICATION_TYPE',
    userId: recipientId,
    title: 'Notification Title',
    message: 'Notification body',
    relatedId: itemId,
    relatedType: 'Item',
    metadata: { customData: 'value' },
  });
});
```

## Version-Specific Notes

### Next.js 16 Features Used

- **App Router**: `app/` directory structure
- **React Server Components**: Default in App Router
- **`after()` API**: Deferred work in serverless (critical pattern)
- **Edge Middleware**: Auth redirects in `middleware.ts`
- **Route Handlers**: API routes as `route.ts` files

### React 19 Features Used

- **Server Components**: Async components, direct data fetching
- **Automatic Batching**: All state updates batched automatically
- **Transitions**: `useTransition` in forms for pending states
- **`use` Hook**: Unwrap promises/context (not heavily used yet)

### Prisma 6 Notes

- **Vector Type**: Use `Unsupported("vector(1024)")` in schema, raw SQL for queries
- **Connection Pooling**: Prisma Accelerate with `directUrl` for migrations
- **Client Extensions**: Available for custom methods (not used yet)

## ⚠️ Future Improvements

These are areas where the codebase could be enhanced. They're noted here for future reference, not as critical issues:

1. **Test Coverage: Add more unit tests for `lib/` utilities**
   - Current: E2E-heavy (Playwright), unit tests light (Vitest)
   - Target: 80%+ coverage for notification logic, auth helpers, AI functions
   - Priority: Medium (E2E tests provide good coverage already)

2. **API Documentation: Generate OpenAPI/Swagger docs**
   - Current: Inline comments only
   - Target: Auto-generated API reference from route files with schemas
   - Priority: Low (internal API, well-documented in code)

3. **Environment Validation: Validate required env vars at startup**
   - Current: Runtime failures if missing vars
   - Target: Use Zod to validate `process.env` at app boot with clear error messages
   - Priority: Medium (improves developer experience)

4. **Error Monitoring: Production error tracking**
   - Current: `console.error` only, no centralized logging
   - Target: Integrate Sentry or similar for production error tracking
   - Priority: High for production, low for MVP

5. **Database Seeding: Development seed script**
   - Current: Manual data creation in UI
   - Target: `npm run db:seed` with faker-generated realistic data (users, circles, items)
   - Priority: Low (nice-to-have for onboarding)

6. **Performance Monitoring: Track Web Vitals**
   - Current: No metrics collection
   - Target: Custom dashboard or Vercel Analytics integration (LCP, FID, CLS)
   - Priority: Medium (helps identify performance regressions)

## When to Ask for Help

If you encounter these situations, ask the user for clarification or guidance:

- **Changing database schema**: Migrations can be tricky, especially with vector types
- **Adding new AI features**: Cost and rate limit implications
- **Modifying auth flows**: Security-critical, needs careful review
- **Changing real-time architecture**: Complex debugging, production impact
- **Production deployment config**: Vercel settings, environment variables
- **Breaking API changes**: May affect existing frontend code

---

**Last Updated**: 2025-03-28
**Repository**: /Users/nitingupta/Desktop/Personal/Projects/share-circle
**Maintainer**: ShareCircle Team

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **share-circle** (1778 symbols, 4306 relationships, 136 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/share-circle/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/share-circle/context` | Codebase overview, check index freshness |
| `gitnexus://repo/share-circle/clusters` | All functional areas |
| `gitnexus://repo/share-circle/processes` | All execution flows |
| `gitnexus://repo/share-circle/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
