# Jeak - Minimal Invite-Only Social Network

## Tech Stack
- **Frontend**: React, Tailwind CSS, Lucide Icons, Motion
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT with Cookie-based sessions

## Setup & Run

### Prerequisites
- Docker & Docker Compose

### Running with Docker
1. Clone the repository.
2. Run the following command:
   ```bash
   docker-compose up --build
   ```
3. Open `http://localhost:3000` in your browser.

### Initial Superuser
- **Username**: `seenpeh`
- **Password**: `19712Almas`

## Invite System Hierarchy
- **Superuser (Tier 0)**: Unlimited `VIP-` codes.
- **Tier 1 (VIP)**: Users who join with a `VIP-` code. Can generate 3 `STD-` codes.
- **Tier 2 (Standard)**: Users who join with a `STD-` code. Cannot generate codes.

## Features
- **Following Feed**: Chronological posts from people you follow.
- **Explore**: Posts liked by people you follow.
- **Search**: Global search for users and tweet content.
- **Profile**: Stats and personal feed.
- **Settings**: Theme toggle, password change, and invite management.
