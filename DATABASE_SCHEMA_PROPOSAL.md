# 📦 ShareCircle Database Schema

This document outlines the relational database schema for the ShareCircle project.

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

| Column         | Type     | Description                              |
|----------------|----------|------------------------------------------|
| `id`           | Integer  | Primary Key                              |
| `name`         | Varchar  | Circle name                              |
| `description`  | Varchar  | Description of the group                 |
| `category`     | Varchar  | Circle category (e.g., local, school)    |

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

## 🔁 Transactions

Represents all item-related transactions: lend, borrow, return, repair, etc.

| Column                | Type     | Description                                  |
|-----------------------|----------|----------------------------------------------|
| `id`                  | Integer  | Primary Key                                  |
| `item_id`             | Integer  | Foreign Key → `items.id`                     |
| `borrower_id`         | Integer  | Foreign Key → `users.id`                     |
| `lender_id`           | Integer  | Foreign Key → `users.id`                     |
| `start_date`          | Date     | Start of transaction                         |
| `end_date`            | Date     | End of transaction                           |
| `transaction_type`    | Varchar  | borrow / return / repair                     |
| `status`              | Varchar  | pending / completed / failed                 |
| `return_transaction_id` | Integer | (Nullable) FK → `transactions.id` (self ref) |
| `payment_id`          | Integer  | (Nullable) FK → `payments.id`                |

---

## 💳 Payments

Stores financial information for transactions.

| Column            | Type     | Description                          |
|-------------------|----------|--------------------------------------|
| `id`              | Integer  | Primary Key                          |
| `transaction_id`  | Integer  | Foreign Key → `transactions.id`      |
| `amount`          | Decimal  | Total amount paid                    |
| `security_deposit`| Decimal  | Deposit value                        |
| `rental_fee`      | Decimal  | Fee for item rental                  |
| `paid_by`         | Varchar  | borrower / platform                  |
| `payment_method`  | Varchar  | credit_card / wallet / etc.          |
| `created_at`      | DateTime | Payment timestamp                    |

---

## 🗣️ Item Feedbacks

User reviews for items they've borrowed.

| Column         | Type     | Description                                |
|----------------|----------|--------------------------------------------|
| `id`           | Integer  | Primary Key                                |
| `transaction_id`| Integer | Foreign Key → `transactions.id`            |
| `item_id`      | Integer  | Foreign Key → `items.id`                   |
| `reviewer_id`  | Integer  | Foreign Key → `users.id`                   |
| `rating`       | Integer  | 1–5 star rating                            |
| `comment`      | Text     | Optional text feedback                     |
| `created_at`   | DateTime | Timestamp                                  |

---

## 🧑‍🤝‍🧑 User Feedbacks

Mutual feedback between borrower and lender.

| Column         | Type     | Description                                |
|----------------|----------|--------------------------------------------|
| `id`           | Integer  | Primary Key                                |
| `transaction_id`| Integer | Foreign Key → `transactions.id`            |
| `from_user_id` | Integer  | Rater → `users.id`                         |
| `to_user_id`   | Integer  | Rated → `users.id`                         |
| `rating`       | Integer  | 1–5 star rating                            |
| `comment`      | Text     | Optional comment                           |
| `created_at`   | DateTime | Timestamp                                  |

---

## 🛠️ Repair Records

Tracks item repairs, costs, and who paid.

| Column         | Type     | Description                                |
|----------------|----------|--------------------------------------------|
| `id`           | Integer  | Primary Key                                |
| `item_id`      | Integer  | Foreign Key → `items.id`                   |
| `transaction_id`| Integer | Foreign Key → `transactions.id`            |
| `reported_by`  | Integer  | Foreign Key → `users.id`                   |
| `repair_status`| Varchar  | pending / in_progress / completed          |
| `repair_cost`  | Decimal  | Repair fee                                 |
| `paid_by`      | Varchar  | borrower / lender / both                   |
| `description`  | Text     | Issue summary                              |
| `repair_center`| Varchar  | Name or contact of repair service          |
| `created_at`   | DateTime | When reported                              |
| `updated_at`   | DateTime | Last status update                         |

---

## 🔔 Notifications

Sends alerts to users.

| Column         | Type     | Description                        |
|----------------|----------|------------------------------------|
| `id`           | Integer  | Primary Key                        |
| `user_id`      | Integer  | Foreign Key → `users.id`           |
| `type`         | Varchar  | e.g. item_due, new_comment         |
| `message`      | Text     | Content of the notification        |
| `is_read`      | Boolean  | Seen or not                        |
| `created_at`   | DateTime | Timestamp                          |

---

## ⚙️ User Settings

Stores user preferences and archival options.

| Column              | Type     | Description                        |
|---------------------|----------|------------------------------------|
| `id`                | Integer  | Primary Key                        |
| `user_id`           | Integer  | Foreign Key → `users.id`           |
| `receive_notifications` | Boolean | User allows system alerts     |
| `item_visibility`   | Varchar  | default item privacy setting       |
| `archive_after_days`| Integer  | Auto-archive items after X days    |
| `updated_at`        | DateTime | Last update                        |

---

📝 _This schema is flexible and ready to evolve based on future needs such as logistics, shipping, or user permissions._
