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
