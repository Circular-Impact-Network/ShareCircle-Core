# 📦 ShareCircle Database Schema Proposal

This document outlines the proposed database schema design for the ShareCircle platform. The goal is to support user accounts, group circles, and item sharing with various rental statuses.

---

## 🗂️ Entities Overview

### 1. `users`
- `id`: primary key
- `name`: user's full name
- `phone_number`: contact number
- `email_address`: unique email ID
- `address`: field for delivery or pickup

### 2. `circles`
- `id`: primary key
- `name`: name of the group

### 3. `circle_members`
- A join table representing many-to-many relationship between `users` and `circles`
- Composite primary key: (`user_id`, `circle_id`)

### 4. `items`
- `id`: primary key
- `name`: item name
- `description`: text
- `image_url`: image link or path
- `status`: one of ('available', 'reserved', 'borrowed', 'overdue')
- `rental_amount`: price to rent the item
- `security_deposit`: deposit required
- `current_user_id`: user currently associated with the item (can be null)

---

## 🔗 Relationships

- One `user` can own many `items`
- One `item` can only be held/reserved/borrowed by one `user` at a time
- Many-to-many relationship between `users` and `circles` via `circle_members`

---

## 📄 ERD Diagram

See the ERD diagram below for a visual representation of the schema design:

![ERD PDF](./docs/share%20circle%20database%20ERD.pdf)

---

## 📝 Notes

- `current_user_id` in `items` is nullable when available
