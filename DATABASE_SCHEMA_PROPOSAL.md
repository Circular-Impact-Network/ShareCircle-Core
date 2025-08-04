# 📦 ShareCircle Database Schema (Task 2.1)

This document outlines the proposed relational database schema for the ShareCircle project.

---

## 👤 Users

Stores user profile and contact information.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `name`         | Varchar  | User's name                        |
| `email`        | Varchar  | Email address                      |
| `phone_number` | Varchar  | Contact number                     |
| `address`      | Varchar  | Physical address                   |
| `zip_code`     | Varchar  | Postal code                        |
| `country`      | Varchar  | Country of residence               |

---

## 👥 Circles

Represents sharing groups that users can join.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `name`         | Varchar  | Circle name                        |
| `description`  | Varchar  | Description of the group           |
| `category`     | Varchar  | Circle category (e.g., local, school) |

---

## 🔗 Circle Members

Join table between `users` and `circles` (many-to-many).

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `user_id`      | Integer  | Foreign Key → `users.id`           |
| `circle_id`    | Integer  | Foreign Key → `circles.id`         |

---

## 🎁 Items

Represents shareable or rentable items.

| Column            | Type     | Description                          |
|-------------------|----------|--------------------------------------|
| `id`              | Integer  | Primary Key                          |
| `name`            | Varchar  | Item name                            |
| `description`     | Text     | Description of the item              |
| `status`          | Varchar  | Status (e.g., available, borrowed)   |
| `security_deposit`| Decimal  | Deposit required                     |
| `rental_amount`   | Decimal  | Rental fee                           |
| `owner_id`        | Integer  | Foreign Key → `users.id`             |
| `visibility`      | Varchar  | Public / circle_only / private       |
| `condition`       | Text     | Current physical condition           |

---

## 🖼️ Item Images

Stores multiple images per item.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `item_id`      | Integer  | Foreign Key → `items.id`           |
| `image_url`    | Varchar  | Path or URL to image               |
| `order_index`  | Integer  | Display order                      |
| `is_cover`     | Boolean  | Whether this is the cover image    |

---

## ⭐ Favorites

Tracks which items a user has favorited.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `user_id`      | Integer  | Foreign Key → `users.id`           |
| `item_id`      | Integer  | Foreign Key → `items.id`           |
| `created_at`   | DateTime | When item was favorited            |

---

## 🔄 Borrow Transactions

Represents rental/lending transactions.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `item_id`      | Integer  | Foreign Key → `items.id`           |
| `borrower_id`  | Integer  | Foreign Key → `users.id`           |
| `start_date`   | Date     | Start of transaction               |
| `end_date`     | Date     | End of transaction                 |
| `status`       | Varchar  | Status (borrowed, returned, etc.)  |

---

## 🗣️ Item Feedbacks

User feedback for items after usage.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `transaction_id`| Integer | Foreign Key → `borrow_transactions.id` |
| `item_id`      | Integer  | Foreign Key → `items.id`           |
| `reviewer_id`  | Integer  | Foreign Key → `users.id`           |
| `rating`       | Integer  | 1–5 star rating                    |
| `comment`      | Text     | Optional text feedback             |
| `created_at`   | DateTime | Timestamp                          |

---

## 🧑‍🤝‍🧑 User Feedbacks

Mutual ratings between borrower and lender.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `transaction_id`| Integer | Foreign Key → `borrow_transactions.id` |
| `from_user_id` | Integer  | Rater → `users.id`                 |
| `to_user_id`   | Integer  | Rated → `users.id`                 |
| `rating`       | Integer  | 1–5 star rating                    |
| `comment`      | Text     | Optional comment                   |
| `created_at`   | DateTime | Timestamp                          |

---

## 🛠️ Repair Records

Tracks item repair history and cost responsibilities.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `item_id`      | Integer  | Foreign Key → `items.id`           |
| `transaction_id`| Integer | Foreign Key → `borrow_transactions.id` |
| `reported_by`  | Integer  | User who reported → `users.id`     |
| `repair_status`| Varchar  | pending / in_progress / completed  |
| `repair_cost`  | Decimal  | Cost of repair                     |
| `paid_by`      | Varchar  | borrower / lender / both           |
| `description`  | Text     | What’s broken / damage summary     |
| `repair_center`| Varchar  | Name of repair center              |
| `created_at`   | DateTime | When reported                      |
| `updated_at`   | DateTime | Last update                        |

---

## 🔔 Notifications

In-app alerts for events and reminders.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `user_id`      | Integer  | Foreign Key → `users.id`           |
| `type`         | Varchar  | Notification type (e.g. overdue)   |
| `message`      | Text     | Message content                    |
| `is_read`      | Boolean  | Whether the user has seen it       |
| `created_at`   | DateTime | When created                       |

---

## ⚙️ User Settings

Stores each user's preferences.

| Column              | Type     | Description                        |
|---------------------|----------|------------------------------------|
| `id`                | Integer  | Primary Key                        |
| `user_id`           | Integer  | Foreign Key → `users.id`           |
| `receive_notifications` | Boolean | Opt-in for email/alerts        |
| `item_visibility`   | Varchar  | Default visibility of new items   |
| `archive_after_days`| Integer  | Auto-archive duration (optional)  |
| `updated_at`        | DateTime | Last update                        |

---

📝 _This schema is a starting point and can be extended further based on future platform needs such as logistics integration, reporting, or user roles._
