# ShareCircle — Product Requirements Document (MVP)

## Version

MVP v1 — 2025

## Tech Stack

- **Next.js** (Frontend + API routes)
- **Supabase** (Auth, Postgres, Storage, Realtime)
- **Vercel** (Hosting)
- **OpenAI API** (Vision + Text for metadata + search augmentation)

---

# 1. Overview

ShareCircle is a trust-based item-sharing platform where users create or join private groups (“Circles”) and share or borrow items with people they trust. The MVP focuses on essential workflows that allow users to:

- Sign up and authenticate
- Create and manage private circles
- Invite others using codes or shareable links
- Create AI-assisted listings
- Discover items across circles
- Borrow items (request → approval → return)
- Rate each other to build trust
- View and edit profiles with trust scores

This PRD outlines all functional and non-functional requirements for the MVP.

---

# 2. MVP Goals

### Primary Goals

- Establish a fast, secure system for sharing items within trusted groups.
- Simplify listing creation via AI-generated metadata.
- Provide reliable, transparent borrowing workflows (request → return).
- Highlight user trustworthiness via ratings and profile indicators.

### Secondary Goals

- Ensure the platform is scalable, flexible, and easy to extend.
- Minimize friction in joining new circles.

### Non-Goals (Not included in MVP)

- Chat / messaging
- Disputes or support center
- Notifications center
- Payment or deposits
- Logistics integration
- Public marketplace
- Complex governance or circle analytics

---

# 3. User Personas

### **Borrower**

Needs an item temporarily and wants an easy way to discover and request it.

### **Lender / Sharer**

Owns items and wants to lend to trusted people in circles.

### **Circle Lead**

Creates circles, manages membership, and ensures group integrity.

---

# 4. Core MVP Features

The following features MUST be included in the MVP:

1. **Login / Signup / Authentication**
2. **Circle Creation & Management**
3. **Invite flow via code or shareable link**
4. **Create / Edit Item Listing (AI-assisted)**
5. **Item Discovery Across Circles**
6. **Borrow / Request Flow**
7. **Returns & Ratings**
8. **Profile & Trust Indicators**

---

# 5. Detailed Functional Requirements

---

## 5.1 Authentication & Profile

### Requirements

- Users must sign up/login using Supabase Auth (Email + Password, optionally Magic Link).
- After first login, users must complete a basic profile:
    - Name
    - Profile image (optional)
- User is assigned a unique ID corresponding to Supabase Auth user ID.
- Auth sessions persist across page refreshes.

### User Stories

- As a user, I want to sign up quickly so I can access circles.
- As a user, I want my profile to show my name and trust score.

### Acceptance Criteria

- User can sign up, login, and logout successfully.
- Profile setup persists in the database.
- Auth state is consistent across tabs and sessions.

---

## 5.2 Circles Management

### Capabilities

- Create circle with:
    - Name
    - Description
    - Auto-generated invite code
- Circle creator becomes the "Lead".
- Circle lead can:
    - View members
    - Remove members
- Users can join circles using:
    - Invite code, or
    - Shareable URL (`/circle/{id}?inviteCode=xxxxxx`)
- Each circle maintains:
    - List of members
    - List of items shared

### User Stories

- As a user, I want to create a circle for my family or friends.
- As a user, I want to join a circle using a code or link.
- As a lead, I want to remove members who do not follow rules.

### Acceptance Criteria

- Circles are created successfully with invite code.
- Users can join only with valid invite code/URL.
- Joining twice is prevented.
- Only lead can remove other members.

---

## 5.3 Item Listing (AI-Assisted)

### Flow

1. User uploads image(s) or video.
2. System calls OpenAI Vision + Text to extract:
    - Suggested title
    - Description
    - Category
    - Tags (keywords)
    - Brand (if detectable)
3. User reviews/edits all fields.
4. User selects one or more circles to publish item to.
5. Item becomes visible only to selected circles.

### Listing Fields

- Title (string)
- Description (text)
- Category (string)
- Tags (array)
- Owner ID
- Status (available/borrowed)
- Images/videos (media objects)

### User Stories

- As a user, I want to quickly create a listing using AI suggestions.
- As a user, I want full control to edit the AI-generated fields.

### Acceptance Criteria

- AI suggestions load within 3 seconds average.
- Listing is editable before publishing.
- Listing is visible only within selected circles.

---

## 5.4 Item Discovery & Search

### Requirements

- Search bar available globally.
- Two-level search:
    1. Full-text search on title, description, tags.
    2. Natural language search using AI parsing (e.g., “need a blue lehenga for wedding”).
- Search results show:
    - Item image
    - Title
    - Owner
    - Circle
    - Availability

### User Stories

- As a user, I want to search items within my circles.
- As a user, I want to use natural phrases to find items.

### Acceptance Criteria

- Search returns only items belonging to circles the user is part of.
- Search results load within 700ms (excluding AI parsing).
- AI-based search parsing returns structured filters like category/color.

---

## 5.5 Borrow / Request Flow

### Flow

1. User opens item → clicks "Request to Borrow".
2. User selects:
    - Pickup date
    - Return date
3. Owner receives a pending request (simple list view).
4. Owner accepts or declines.
5. If accepted:
    - Item status → `borrowed`
    - Borrow record is created

### User Stories

- As a borrower, I want to request an item for a specific date range.
- As an owner, I want to review and accept/decline borrow requests.
- As a user, I want to know if my request was accepted.

### Acceptance Criteria

- Date validation prevents impossible ranges.
- Owners cannot approve overlapping borrow periods.
- Request status updates correctly (pending → approved/declined).

---

## 5.6 Return & Ratings

### Flow

1. Borrower marks item as returned.
2. Owner confirms the return.
3. Rating modal appears for both sides:
    - 5-star rating
    - Optional tags (e.g., "On-time", "Great condition")
4. Ratings update trust score of user.

### User Stories

- As a borrower, I want to mark items as returned easily.
- As a lender, I want to ensure item is actually returned before closing.
- As a user, I want trust ratings to reflect responsible behavior.

### Acceptance Criteria

- Trust score updates after rating submission.
- Both users can rate the other.
- Item status returns to `available`.

---

## 5.7 Profile & Trust Indicators

### Requirements

User profile contains:

- Name
- Profile image
- Circles joined
- Items lent / borrowed count
- Ratings received
- Trust score (0–5) calculated as:
    - Average of all ratings OR weighted average (decided at implementation)

### User Stories

- As a user, I want to see how trustworthy others are before borrowing.
- As a user, I want to track my sharing reputation.

### Acceptance Criteria

- Trust score displayed clearly.
- Ratings history visible on profile.

---

# 6. Database Requirements (Simplified MVP Model)

### Tables

- `users`
- `circles`
- `circle_members`
- `items`
- `item_media`
- `circle_items`
- `borrow_requests`
- `ratings`

### Notes

- All media stored in Supabase Storage; metadata stored in `item_media`.
- Access control handled via Supabase RLS and application-level checks.

---

# 7. Non-functional Requirements

### Performance

- Page loads < 800ms.
- AI metadata generation < 3 seconds.
- Search results (DB only) < 700ms.

### Security

- Enforce RLS: users can only access items in their circles.
- All media URLs signed with expiry.

### Reliability

- System must handle failures gracefully:
    - AI fallback if metadata fails
    - Retry on media upload failures

### Scalability

- Tables indexed on:
    - `owner_id`
    - `circle_id`
    - `title, description` (FTS)
    - `status`

---

# 8. Key User Flows (Step-by-Step)

### Flow 1 — Signup

Signup → Verify email → Complete profile → Home dashboard

### Flow 2 — Create Circle

Home → Create Circle → Generate Invite → Share code/link

### Flow 3 — Join Circle

Open link → Login → Join circle → Home

### Flow 4 — Create Listing

Upload media → AI metadata → Edit details → Select circles → Publish

### Flow 5 — Borrow Item

View item → Request → Owner approves → Item borrowed

### Flow 6 — Return + Rating

Borrower marks → Owner confirms → Ratings exchanged → Trust score updated

---

# 9. Success Metrics (MVP)

- % users who join a circle in the first session
- % users who create at least 1 listing
- # of borrow requests per active user
- Return completion rate
- Rating participation rate

---

# 10. Risks & Mitigation

**Risk:** AI metadata inconsistency  
**Mitigation:** User must edit/confirm metadata.

**Risk:** Unauthorized access  
**Mitigation:** Strict Supabase RLS & signed URLs.

**Risk:** Invite abuse  
**Mitigation:** Circle lead can remove members.

---

# 11. Appendix: MVP Scope Summary

| Feature                   | Included |
| ------------------------- | -------- |
| Login/Signup              | ✔        |
| Create Circles            | ✔        |
| Manage Circles            | ✔        |
| Invite via Code/URL       | ✔        |
| AI Listing Creation       | ✔        |
| Item Search (AI-assisted) | ✔        |
| Borrow / Request          | ✔        |
| Returns                   | ✔        |
| Ratings                   | ✔        |
| Profile & Trust           | ✔        |
| Chat                      | ✘        |
| Notifications             | ✘        |
| Disputes                  | ✘        |
| Payments                  | ✘        |
| Logistics                 | ✘        |

---

# END OF DOCUMENT
