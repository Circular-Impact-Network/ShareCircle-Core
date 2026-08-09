# ShareCircle — assistant reference

Everything the in-app help assistant is allowed to know. It answers from this file alone, so
anything missing here is either refused or, worse, guessed at. Keep it truthful and keep the button
names matching the ones actually on screen — a user following a wrong label loses trust immediately.

Edit this file to change what the assistant knows. It is read at runtime by `lib/help-knowledge.ts`.

---

## 1. What ShareCircle is

A peer-to-peer sharing platform. People form private groups called **circles** — neighbours,
friends, colleagues — list things they own, and lend and borrow within those circles. The idea is
that borrowing from someone you already trust beats both buying new and renting from a stranger.

Everything is private to a circle. There is no public marketplace, no payment, and no delivery: you
arrange handover with the other person directly.

---

## 2. Navigation — this differs by device

### On a computer (desktop layout)

A sidebar runs down the left of every screen, containing, in order:

| Item          | What it is                                      |
| ------------- | ----------------------------------------------- |
| Home          | Summary of what needs attention                 |
| Browse Items  | Everything shared into your circles             |
| Circles       | Your circles                                    |
| My Listings   | Items you own                                   |
| My Activity   | Your borrowing and lending                      |
| Messages      | Conversations                                   |
| Notifications | Alerts, borrow requests, requested items        |
| Help & Guide  | The full written guide (opens in a browser tab) |
| Settings      | Profile, account, notifications, appearance     |

### On a phone (mobile layout)

A bar along the **bottom** of the screen holds five items only: **Home, Browse, Circles, Messages,
Alerts**.

Everything else is behind the **avatar in the top-right corner**: **My Listings, My Activity,
Help & Guide, Settings**, and Log out.

There is no sidebar on a phone. Never tell a phone user to use one, and never tell a computer user
about a bottom bar or an avatar menu.

---

## 3. Circles

Circles are private groups. An item is only visible to members of a circle it has been shared into.

- **Roles**: ADMIN or MEMBER. Admins manage members and circle settings, and can see a per-member
  impact breakdown that ordinary members cannot.
- **Creating one**: Circles → **Create Circle** (or **Create**). You are the admin of a circle you
  create.
- **Joining one**: Circles → **Join via Code** (or **Join**) and enter the invite code. Opening an
  invite link does the same thing.
- **Invite codes expire after 7 days.** Get a fresh one from the circle's **Invite** button.
- **Leaving**: open the circle, then **Leave Circle**. You lose access to that circle's items.
  Rejoining later makes you a MEMBER again, even if you were an admin before.
- One item can be shared into several circles at once.

Inside a circle: a **Shared** tab (items shared here) and a **Requested** tab (things members are
looking for), plus **Add Item**, **Invite**, and **Settings** for admins.

---

## 4. Listing an item

**Where:** My Listings → **Add Item** (the first item is **Add your first item**). Also available
from inside a circle via **Add Item**.

1. Provide a photo — **Take a photo** or **Upload from device**.
2. The app analyses the photo and suggests a name, description, categories, tags, an estimated
   weight and an estimated retail price. Every one of these can be edited by hand.
3. Set the weight and price if you want to. Neither is required to save.
4. Choose which circles to share it into.
5. Save.

Key points:

- **An item nobody can see is almost always an item shared into no circle.** That is the first thing
  to check when someone asks why their listing is invisible.
- Weight is entered and shown in the unit chosen in Settings → Appearance (kilograms or pounds).
- Price is entered in US dollars and displayed in the chosen currency.
- **Price is hidden from borrowers by default.** There is a per-item toggle to show it. Weight is
  always visible.
- My Listings has **Active** and **Archived** tabs, and **Edit** and **Delete** on each item.

---

## 5. Borrowing something

**Where:** Browse Items → open the item → **Request Access**.

The request form asks for the dates you need it, optionally an occasion (for example "Wedding",
"Camping trip", "Birthday party") and a message to the owner.

Then, in order:

1. **You send the request.** It is PENDING. You can cancel it while it is still pending.
2. **The owner approves or declines.** A request goes PENDING → APPROVED, DECLINED or CANCELLED.
3. **Handover.** The owner confirms they handed the item over; the borrower confirms they received
   it. Both sides confirm, so neither is left guessing.
4. **Return.** The borrower marks it returned; the owner confirms the return.
5. Only then is it COMPLETED and the item free again.

Transaction states: ACTIVE → RETURN_PENDING → COMPLETED, or CANCELLED.

**If the item is already out on loan**, you join a queue instead. Queue states are WAITING → READY →
SKIPPED. When the item comes back, the next person becomes READY and is notified.

**Extending**: an active borrow can be extended from the item page via **Extend Borrow**.

Track all of this in **My Activity**, which has tabs: **Active**, **Pending**, **Queue**,
**Requests**, **History**.

---

## 6. Asking for something nobody has listed

**Where:** Browse Items → **Request Item**.

Fill in "What are you looking for?", optionally add details, choose which circles to ask, and submit.
Members of those circles are notified and can offer something.

You can also create and see these under **Notifications → Requested Items**.

Item request states: OPEN → FULFILLED or CANCELLED.

> Note: the phrase "request an item" is ambiguous in ShareCircle. **Request Access** means "I want to
> borrow this specific item". **Request Item** means "nobody has listed this, does anyone have one?".
> If a question is ambiguous, say briefly what both mean and answer the more likely one.

---

## 7. Messages

- Direct messages between two people, and group conversations.
- **You can only message someone you share a circle with.**
- Messages arrive live, with delivered and read receipts, and show when someone is typing.
- Conversations can be pinned, muted or archived.

---

## 8. Notifications

Two separate channels:

- **In-app** — the Notifications screen, plus a toast while the app is open.
- **Push** — a system notification that arrives when the app is closed.

The Notifications screen has three tabs: **Alerts**, **Borrow Requests**, **Requested Items**.

There are thirteen notification types: new message; item request created; item request fulfilled;
item removed from a circle; borrow request received, approved and declined; queue position updated;
queue item ready; item handoff confirmed; item received confirmed; return requested; return
confirmed.

Both channels default to **on**, and each type and category can be switched off individually in
Settings → Notifications.

### Push needs permission on every device

A push subscription belongs to one browser, not to the account. Enabling push on a laptop does not
enable it on a phone — each device must be turned on separately in Settings → Notifications, under
"Allow push on this device".

**On iPhone and iPad, push only works once the app has been added to the Home Screen.** Open the
site in Safari, tap Share, then "Add to Home Screen", and open it from that icon. This is an Apple
restriction and not something ShareCircle can change or work around.

If the switch is greyed out, it is one of: the app is not installed (iPhone/iPad), or notifications
were previously blocked for this site and must be re-allowed in the browser's own settings.

---

## 9. Impact

ShareCircle totals what sharing has saved: **money saved**, **CO₂ avoided**, **times borrowed** and
**items shared**. There is a personal view and a circle-wide view. Circle admins additionally see a
per-member breakdown.

CO₂ and weights follow the unit chosen in Settings → Appearance.

---

## 10. Settings

Five tabs: **Profile**, **Account**, **Notifications**, **Appearance**, **About**.

- **Profile** — name, photo, bio.
- **Account** — contact details (email, phone), and password. Changing the password signs out other
  sessions.
- **Notifications** — the per-device push switch, and per-type and per-category controls.
- **Appearance** — light or dark theme, font size, weight unit (kilograms or pounds), and currency.
  Units and currency are saved to the account, so they are the same on every device you sign in on.
- **About** — a link to the homepage, the app version, and **Replay the app tour**.

---

## 11. Installing the app

ShareCircle can be installed to a phone's Home Screen and used like an app, which is also what
enables push notifications on iPhone and iPad.

- **iPhone / iPad**: open in Safari, tap Share, then "Add to Home Screen".
- **Android**: Chrome offers an install prompt, or use the menu → "Install app".
- **Desktop**: installation is deliberately not offered; the app is used in the browser.

---

## 12. Common questions and the honest answers

- **"Why can't anyone see my item?"** — It is almost certainly shared into no circle. Open it from
  My Listings and add a circle.
- **"Why can't I message this person?"** — Messaging requires a shared circle.
- **"My invite code doesn't work."** — Codes expire after 7 days; ask for a new one.
- **"Where is my borrow request?"** — My Activity, under Pending (sent, awaiting the owner) or under
  Active once approved. Requests received from others are under Notifications → Borrow Requests.
- **"I'm not getting notifications."** — Check Settings → Notifications for the per-device switch,
  then the browser's own permission. On iPhone/iPad the app must be installed to the Home Screen.
- **"How do I get my item back?"** — The borrower marks it returned and you confirm; until you
  confirm, the item stays out.
- **"Can I charge for lending?"** — No. There are no payments in ShareCircle.
- **"Can I sell an item?"** — No. It is lending only.
- **"How do I delete my account?"** — Not available in the app; contact support.

---

## 13. What the assistant must not do

- It has **no access to any account, item, message or history** — its own or anyone's. It cannot
  look anything up, change anything, or act on anyone's behalf. For anything specific to a user's
  own data it must explain **where to look**, using the layout for that user's device.
- It must not invent features, screens, buttons, prices, limits or policies. If the answer is not in
  this file, it should say so and point to the Help & Guide or support.
- Support contact: **support@circularimpact.org**.
