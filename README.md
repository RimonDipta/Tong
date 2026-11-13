# Tong

A real-time chat app: direct messages and group chats with typing indicators,
read receipts, reactions, replies, edits, file sharing and online presence.

- **client/** — React 19, TypeScript, Vite, Tailwind CSS 4, Socket.IO client
- **server/** — Express 5, TypeScript, MongoDB (Mongoose), Socket.IO, Cloudinary

## Features

- Email/password accounts with short-lived access tokens and an httpOnly refresh cookie
  (requests transparently refresh on expiry)
- Direct and group conversations, live sidebar with unread counts, typing and previews
- Messages: replies, edits, deletes, emoji reactions, read receipts, day dividers,
  infinite scroll for older history
- Attachments: up to 5 files (10 MB each) by picker, paste or drag-and-drop
- Groups: rename, group photo, add/remove members, promote/demote admins, leave
  (a remaining member is promoted if the last admin leaves)
- Presence (online / last seen) across multiple tabs and devices
- Profile editing with avatar upload
- Responsive layout, keyboard friendly (Enter to send, Shift+Enter for a new line,
  Esc to cancel, ↑ to edit your last message), respects reduced-motion

## Getting started

Requirements: Node.js 20+, MongoDB, and a Cloudinary account for uploads.

```bash
# API
cd server
cp .env.example .env   # fill in the values
npm install
npm run dev            # http://localhost:5000

# Web client (in another terminal)
cd client
cp .env.example .env   # optional, defaults to http://localhost:5000
npm install
npm run dev            # http://localhost:5173
```

## API overview

All routes are under `/api` and, except auth, require `Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` | Session |
| GET / PATCH | `/users/me` | Current profile |
| GET | `/users/search?q=` | Find people |
| POST | `/avatar` | Upload profile photo |
| POST | `/uploads` | Upload message attachments |
| GET | `/conversations` | List chats with `unreadCount` |
| POST | `/conversations/direct`, `/conversations/group` | Start a chat |
| GET | `/conversations/:id/messages?before=&limit=` | Paginated history |
| PATCH | `/conversations/:id` | Rename group (admin) |
| POST | `/conversations/:id/avatar` | Group photo (admin) |
| GET / POST | `/conversations/:id/members` | List / add members |
| DELETE | `/conversations/:id/members/:userId` | Remove member (admin) |
| POST / DELETE | `/conversations/:id/admins/:userId` | Promote / demote (admin) |
| POST | `/conversations/:id/leave` | Leave group |

Realtime events (Socket.IO): `message:send|edit|delete|reaction`, `conversation:read`,
`typing:start|stop` from the client; `message:new|edited|deleted|reaction|read`,
`conversation:new|updated|removed|read`, `typing:*`, `presence:*` from the server.
