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
