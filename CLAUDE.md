# ShareCircle — Claude Code Guide

## Project Overview

**ShareCircle** is a peer-to-peer item sharing platform. Users create trust circles (sharing groups), list items, and manage borrowing with real-time chat and notifications.

- **Stack**: Next.js 16 App Router, React 19, TypeScript, Redux Toolkit, Prisma 6, Supabase, Tailwind CSS 4
- **Auth**: NextAuth.js v4 — Email/phone OTP + Google OAuth; email verification required
- **DB**: PostgreSQL + pgvector (1024-dim embeddings), Prisma Accelerate for pooling
- **Storage**: Supabase Storage (signed URLs, 1hr expiry)
- **Real-time**: Supabase Realtime (WebSocket channels)
- **AI**: Google Gemini Vision + multimodal embeddings
- **Push**: Web Push (VAPID), in-app notifications (DB-persisted)
- **Dev port**: `localhost:3003`

## Domain Model

### Borrowing State Machines

```
BorrowRequest:  PENDING → APPROVED | DECLINED | CANCELLED
BorrowQueue:    WAITING → READY → SKIPPED
BorrowTransaction: ACTIVE → RETURN_PENDING → COMPLETED | CANCELLED
ItemRequest:    OPEN → FULFILLED | CANCELLED
```

### Key Relationships

- **Circles**: Private groups with roles (ADMIN | MEMBER); invite codes expire 7 days
- **Items**: Multi-circle sharing via `ItemCircle` join table; semantic search via pgvector
- **Messages**: DIRECT | GROUP; `clientId` for dedup; delivery tracked via `MessageReceipt`
- **Notifications**: 11 types, dual-channel (in-app + push), user preferences with per-type overrides

### NotificationType Enum (11 types)
`NEW_MESSAGE` · `BORROW_REQUEST_RECEIVED` · `BORROW_REQUEST_APPROVED` · `BORROW_REQUEST_DECLINED` · `BORROW_QUEUE_READY` · `RETURN_PENDING` · `RETURN_CONFIRMED` · `ITEM_REQUEST_FULFILLED` · `CIRCLE_INVITE` · `NEW_MEMBER_JOINED` · `ITEM_AVAILABLE_SOON`

## Architecture Patterns

### 1. Server vs Client Components

- Default to **Server Components** (no `"use client"`); use client only for hooks, state, events, browser APIs
- Pattern: Server component as outer shell (auth check) → Client component for interactivity
- Page files in `app/(authenticated)/*/page.tsx` are thin server wrappers; logic lives in `components/pages/`

### 2. API Routes

Every route: **session check → try/catch → Prisma → response**. Always `getServerSession(authOptions)` first. Generic error messages to client, descriptive `console.error` for debugging.

### 3. RTK Query

API slices live in `lib/redux/api/`. Use `providesTags` / `invalidatesTags` for cache management. Import from `@/lib/redux/api/*`.

### 4. Real-time Subscriptions

Custom hooks in `hooks/`. **Always** `supabase.removeChannel(channel)` on cleanup — memory leak otherwise.

### 5. `after()` for Side Effects (Critical)

Use `after()` from `next/server` for all non-blocking work (notifications, broadcasts, embeddings). Fire-and-forget `void promise` is unreliable on Vercel serverless. `after()` guarantees execution after response. Use `queueNotification()` from `lib/notify.ts` as the helper.

```typescript
after(() => {
  queueNotification({ type: 'BORROW_REQUEST_RECEIVED', userId: ownerId, ... });
});
return NextResponse.json(result); // Returns immediately
```

`after()` only works in API routes — **not** in Server Components.

### 6. Prisma

Always import singleton: `import { prisma } from '@/lib/prisma'`. Never `new PrismaClient()`.

Vector fields require raw SQL — no native Prisma support:
```typescript
await prisma.$executeRaw`
  UPDATE "Item" SET embedding = ${Prisma.raw(`'[${values}]'::vector`)} WHERE id = ${id}
