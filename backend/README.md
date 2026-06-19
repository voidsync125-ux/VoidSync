# VoidSync Server

Backend for VoidSync — a cosmic chat platform. Express + Socket.IO + MongoDB (Mongoose).

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your MongoDB URI and a real JWT secret
npm run dev    # with nodemon
# or
npm start
```

### MongoDB

- **Local:** `mongodb://localhost:27017/voidsync`
- **Atlas:** `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/voidsync`

### Environment variables (`.env`)

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string for signing tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `PORT` | Server port (default 5000) |
| `CLIENT_URL` | Frontend origin, for CORS |

---

## Auth

All authenticated routes require `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | `{ username, email, password }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Current user (restore session) |
| POST | `/api/auth/logout` | Marks user offline |

## Rooms

| Method | Route | Description |
|---|---|---|
| GET | `/api/rooms` | List public rooms (+ private ones you're in) |
| POST | `/api/rooms` | Create a room `{ name, description, tag, color, isPrivate }` |
| POST | `/api/rooms/:id/join` | Join a room |
| POST | `/api/rooms/:id/leave` | Leave a room |
| GET | `/api/rooms/:id/members` | Members with online status + role |
| GET | `/api/rooms/:id/messages?before=&limit=` | Paginated history |
| POST | `/api/rooms/:id/messages` | Send a message (also broadcasts via socket) |
| POST | `/api/rooms/:id/messages/:msgId/react` | Toggle emoji reaction `{ emoji }` |

## Direct Messages

| Method | Route | Description |
|---|---|---|
| GET | `/api/dms` | List conversations (WhatsApp-style, with last message) |
| POST | `/api/dms/start` | Find/create conversation `{ userId }` or `{ username }` |
| GET | `/api/dms/:id/messages?before=&limit=` | Paginated history |
| POST | `/api/dms/:id/messages` | Send a message |
| POST | `/api/dms/:id/messages/:msgId/react` | Toggle emoji reaction |

## Friends

| Method | Route | Description |
|---|---|---|
| GET | `/api/friends` | List friends (online/offline) |
| GET | `/api/friends/requests` | Pending requests received |
| POST | `/api/friends/requests` | Send request `{ username }` |
| POST | `/api/friends/requests/:id/accept` | Accept |
| POST | `/api/friends/requests/:id/decline` | Decline |
| DELETE | `/api/friends/:userId` | Unfriend |
| GET | `/api/friends/search?q=` | Search users by username |

## Arcade

| Method | Route | Description |
|---|---|---|
| POST | `/api/arcade/scores` | Submit score `{ game, score, meta }` |
| GET | `/api/arcade/leaderboard/:game?scope=global\|friends&limit=` | Top scores |
| GET | `/api/arcade/me` | Your personal bests across all games |

`game` ∈ `memory | sequence | nebula | wordwarp`. For `memory`, lower scores (fewer moves) rank higher.

## Users / Profile

| Method | Route | Description |
|---|---|---|
| GET | `/api/users/:username` | Public profile (own or another user's) |
| PATCH | `/api/users/me` | Update `{ bio, location, avatarColor }` |
| PATCH | `/api/users/me/status` | Update presence `{ status }` |
| PATCH | `/api/users/me/preferences` | Update settings toggles |
| PATCH | `/api/users/me/password` | Change password |
| DELETE | `/api/users/me` | Delete account |

---

## Socket.IO

Connect with `auth: { token: "<jwt>" }`.

| Event (client → server) | Payload |
|---|---|
| `room:join` | `roomId` |
| `room:leave` | `roomId` |
| `typing:start` | `{ roomId }` or `{ recipientId, conversationId }` |
| `typing:stop` | same |
| `voice:join` | `channelId` |
| `voice:leave` | `channelId` |

| Event (server → client) | Payload |
|---|---|
| `message:new` | New room message |
| `message:reaction` | `{ messageId, reactions }` |
| `dm:new` | `{ conversationId, message }` |
| `dm:reaction` | `{ conversationId, messageId, reactions }` |
| `presence:update` | `{ userId, status }` |
| `typing:start` / `typing:stop` | `{ userId, username, roomId?, conversationId? }` |
| `voice:user-joined` / `voice:user-left` | `{ userId, username?, channelId }` |

---

## Data Models

- **User** — auth, profile, presence, friends, preferences
- **Room** — public/private chat rooms
- **Conversation** — 1-on-1 DM threads
- **Message** — text/voice/file/image, reactions, replies (belongs to Room OR Conversation)
- **FriendRequest** — pending/accepted/declined
- **GameScore** — arcade leaderboard entries
