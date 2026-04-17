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
`;
```

## Code Conventions

- **Formatting**: Prettier — 120 char width, tabs, single quotes
- **Files**: kebab-case; **Components**: PascalCase; **Hooks**: `useXxx` camelCase
- **Imports**: Always `@/` path aliases
- **API routes**: `app/api/[route]/route.ts` — RESTful naming

## Development Commands

```bash
npm run dev              # Start dev server (port 3003)
npm run build            # Production build
npm run lint             # ESLint check
npm run format           # Prettier write
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:migrate:dev   # Create + apply migration
npm run db:push          # Push schema without migration (dev only, destructive)
npm run db:studio        # Prisma Studio at localhost:5555
npm test                 # All tests
npm run test:unit        # Vitest unit tests
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright UI mode
```

## Best Practices

1. **Auth first**: `getServerSession(authOptions)` before any logic in API routes
2. **Prisma singleton**: `@/lib/prisma` only
3. **Signed URLs**: `getSignedUrl(path, bucket)` for all Supabase storage paths; never expose raw paths
4. **Side effects**: `after()` / `queueNotification()` for notifications, broadcasts, embeddings
5. **Real-time cleanup**: Remove Supabase channels on unmount
6. **Rate limiting**: Check `lib/rate-limit.ts` before adding public endpoints
7. **Zod validation**: On API routes, not just client-side
8. **No auto-docs**: Never create `.md` files unless explicitly requested

## Security Patterns

- **Circle membership gate**: Always verify `circleMember.findFirst({ where: { circleId, userId, leftAt: null } })` before exposing data
- **Owner checks**: `ownerId === session.user.id` for mutations
- **OTP**: `timingSafeEqualHex()` for comparison; hashed storage
- **Invite codes**: Check expiry (7 days) before accepting
- **Passwords**: bcryptjs `compare()` only — never plain text

## Common Gotchas

1. **Supabase client split**: `supabaseAdmin` (service role) on server for broadcasts; `createClient()` (anon) on client for subscriptions. Client anon key **cannot** broadcast — silent failure.
2. **`after()` scope**: API routes only. Not Server Components.
3. **Vector embeddings**: Raw SQL only (`Prisma.raw`). No Prisma native support.
4. **Signed URL expiry**: 1hr default. Handle 403 by requesting fresh URL on client.
5. **`session.user.id`**: Is `string` (extended in `types/next-auth.d.ts`), not the default NextAuth type.
6. **Phone validation**: Call `isSupportedPhoneCountry()` before `validatePhoneByCountry()` — throws on unsupported countries.
7. **Email normalization**: `normalizeEmail()` before all DB queries — prevents duplicate accounts.
8. **PWA caching**: NetworkOnly for auth routes, NetworkFirst for API reads (Workbox in `next.config.ts`).
9. **N+1 queries**: Use `include` for eager loading in Prisma; don't fetch relations in loops.
10. **AI endpoint timeout**: `export const maxDuration = 60;` on AI routes — default times out for vision/embedding calls.

## Environment Variables

Required:
- `DATABASE_URL`, `DIRECT_URL` — PostgreSQL with pgvector
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Optional: `GOOGLE_CLIENT_ID/SECRET` · `GMAIL_USER/APP_PASSWORD` · `TWILIO_*` · `VAPID_*`

Test flags: `E2E_AUTO_VERIFY=true` · `SKIP_EMAIL=true` · `SKIP_SMS=true` · `TEST_CLEANUP_SECRET`

## Testing Notes

- E2E test emails: `e2e+*@example.com` pattern
- `data-testid` attributes for stable selectors
- Mock image upload + AI in E2E to avoid costs
- See `TESTING.md` for full guide

## Common Task Checklists

**New API endpoint**: session check → try/catch → Prisma → response → RTK Query slice in `lib/redux/api/` → rate limit if public

**New notification type**: add to `NotificationType` enum in schema → `db:migrate:dev` → `NOTIFICATION_PATHS` in `lib/notify.ts` → catalog entry in `lib/notification-catalog.ts` → `queueNotification()` in route

**New real-time feature**: hook in `hooks/` → unique channel name → cleanup on unmount → broadcast via `supabaseAdmin` in API route
