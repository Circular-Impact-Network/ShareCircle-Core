# Remaining work — carried forward from the 2026-08-07 review

Everything here was found by a first-hand scan of the tree (measured, not inferred) during the
combined code / security / architecture / productionize pass. Items already fixed are in
`DEVLOG.md`; this file is only what is still open.

---

## 1. Cut realtime channels per page — the biggest scaling lever, and free

**Why this is first.** Supabase Realtime checks out a **Postgres connection from a small
per-project pool to evaluate the RLS policy on every private-channel join**. The cost is driven by
the _join rate_, not the message rate. During testing, six parallel Playwright workers were enough
to exhaust it:

```
IncreaseConnectionPool: Please increase your connection pool size
IncreaseConnectionPool: Too many database timeouts
ErrorExecutingTransaction: connection not available ... after 10157ms (queue_timeout)
```

`pg_stat_activity` showed only **2** `realtime_connect` backends for the project.

**Current cost: ~7 private channel joins per authenticated page.**

| Topic                       | Hook                       |
| --------------------------- | -------------------------- |
| `user:<id>:messages`        | `useUserMessages`          |
| `notifications:<id>`        | `notifications-provider`   |
| `presence:messages`         | `useGlobalPresence`        |
| `messages:<conversationId>` | `useRealtimeChat`          |
| `typing:<conversationId>`   | `usePresence`              |
| `circle:<id>:items`         | `useItemRealtime`          |
| `circle:<id>:members`       | `useCircleMembersRealtime` |

**Proposed consolidation — same events, fewer joins:**

- `user:<id>:messages` + `notifications:<id>` → **one** `user:<id>` channel. Both are per-user
  fan-out to the same subscriber; they only differ by `event` name, which the payload already
  carries. Saves one join per page.
- `circle:<id>:items` + `circle:<id>:members` → **one** `circle:<id>` channel. Same audience, same
  policy branch, already adjacent in `can_access_realtime_topic`. Saves one join per circle view.
- `messages:<convo>` + `typing:<convo>` → **one** `conversation:<convo>` channel. Identical
  membership check (`conversation_participants`), so the policy collapses too. Saves one join per
  open thread.

Roughly **7 joins → 4**, and the RLS function loses two branches.

**Do not forget:** the topics are named in three places and must move together, or channels go
quiet with no error — `lib/realtime-channels.ts` consumers (server broadcast sites), the client
hooks, and `public.can_access_realtime_topic` in Supabase (both the dev project
`nlvetlesztcpqtkqlemd` **and** prod `fozkgyqjikipohrzjvmz`). `tests/e2e/realtime-delivery.spec.ts`
covers delivery and reconnect and must stay green.

**Then, in order:** raise the Realtime `db_pool` on a paid plan (ask Supabase support — cheapest
real headroom); only consider Ably/Pusher/self-hosted once concurrent users × channels genuinely
exceeds a raised pool. There is no reason to leave Supabase yet.

---

## 2. Request validation — 57 of 70 routes still unvalidated

`lib/api-guards.ts` and its 13 tests are in place; the rollout is not done. 13 routes import zod.

Apply `parseBody(req, schema)` to every route that reads a JSON body. Beyond rejecting bad input,
it turns malformed JSON into a 400 instead of an unhandled 500.

Priority order: auth routes (`verify-otp`, `forgot-password`, `resend-otp`, `send-phone-otp`,
`verify-phone-otp`) → mutations (`items/[id]`, `item-requests/*`, `borrow-requests/*`,
`circles/join`, `circles/[id]/members`, `push/subscriptions`, `user/notification-preferences`) →
the rest.

## 3. Route auth boilerplate — 37 routes

`requireUser` / `requireCircleMember` / `requireCircleAdmin` exist and are tested. 37 routes still
re-derive the session by hand and 19 re-write the membership query. The membership one matters:
each hand-written copy is a chance to omit `leftAt: null`, which silently keeps serving circle
contents to a member who left.

## 4. Rate limiting — needs a decision, not just code

`lib/rate-limit.ts` keeps counters in a per-process `Map`, and only 19 of 70 routes use it.

- On **Hostinger** (one long-lived `npm start` process) the `Map` is correct and costs nothing.
- On **Vercel** it resets on every cold start and is per-instance.

So: leave it with a comment if production stays on Hostinger; make it DB-backed if production
moves to serverless. Decide before writing code.

## 5. Vector literal built by string concatenation

Four sites interpolate an embedding into SQL with no runtime numeric check:

```ts
Prisma.raw(`'[${embedding.join(',')}]'::vector`);
```

`app/api/items/route.ts:54`, `app/api/items/search/route.ts:120`, `app/api/items/[id]/route.ts:401`,
`app/api/circles/[id]/regenerate-code/route.ts`. The values come from the embedding provider and
are typed `number[]`, but nothing enforces that at runtime. One `Number.isFinite` guard each.

## 6. Dependencies — 5 high advisories with no eligible fix

Brought from 31 vulns / 19 high to **16 / 5** using `package.json` `overrides` pinned to patched
versions published more than 8 days ago (the 7-day cooling policy on this machine).

Still open, and why:

| Package                | Blocker                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `sharp`                | already at 0.35.3, the newest version the 7-day policy allows                                                 |
| `next`                 | npm's suggested "fix" is a **downgrade to 9.3.3** — not viable                                                |
| `ajv`, `fast-uri`      | build-time, under `schema-utils`/`webpack`; an override attempt made it worse (10 → 13 high) and was reverted |
| `serialize-javascript` | build-time, under `workbox` via `@ducanh2912/next-pwa`                                                        |

Re-check once the cooling window passes.

## 7. God components

`add-item-modal` 1286L, `settings-page` 1234L, `circle-details-page` 1099L, `item-detail-page`
995L, `signup` 957L, `login` 899L.

**Recommendation: do not start this without component-level tests first.** It is the highest-risk,
lowest-return item here — a large refactor of untested UI, with no behavioural safety net.

## 8. Smaller items

- Unused dependencies to remove: `cmdk`, `input-otp`, `next-themes`, `@vercel/analytics`, `jsdom`,
  `autoprefixer`, and `@types/bcryptjs` (bcryptjs 3.0.3 ships its own types, and it is wrongly in
  `dependencies`). Now entangled with the new `overrides`, so this wants a clean pass.
- Judgement-call dead weight: `components/ui/carousel.tsx` (366L + `embla-carousel-react`, one
  consumer) → CSS `scroll-snap`; `date-picker` + `calendar` (221L + `react-day-picker`) →
  `<input type="date">`.
- `PHONE_AUTH_ENABLED = false` and the 10 branches behind it — dead in every build, but
  deliberately kept for the post-Twilio re-enable. Cut only if that plan changed.
- 22 permanently skipped e2e tests remain (`test.skip()`), separate from the 17 silent bail-outs
  that were converted to hard assertions.

## 9. Test-suite load sensitivity

Running six specs in parallel produced five failures; **all sixteen passed serially**. That is
contention on the Realtime pool and the database, not a regression — but CI runs wider than that.
Item 1 is the fix; until then, expect occasional parallel flakes in realtime and transaction specs.
