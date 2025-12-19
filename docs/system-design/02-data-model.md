# System Design — Data Model

## Tables

```mermaid
erDiagram
  USERS ||--o{ POSTS : creates
  USERS ||--o{ FOLLOWS : follower
  USERS ||--o{ FOLLOWS : following

  USERS {
    uuid id PK
    string username
    string email
  }
  POSTS {
    uuid id PK
    uuid authorId FK
    text content
  }
  FOLLOWS {
    uuid id PK
    uuid followerId FK
    uuid followingId FK
  }
```

### users

- `id` (uuid, pk)
- `username` (unique)
- `fullName`
- `email` (unique)
- `hashedPassword`
- `profilePictureUrl` (nullable)
- `bio` (nullable)
- `postsCount`, `followerCount`, `followingCount`
- `createdAt`, `updatedAt`

### posts

- `id` (uuid, pk)
- `authorId` (fk → users.id)
- `content`
- `mediaUrl` (nullable)
- `createdAt`, `updatedAt`

### follows

- `id` (uuid, pk)
- `followerId` (fk → users.id)
- `followingId` (fk → users.id)
- `createdAt`

## Relationships

```text
users 1 ──── * posts
users 1 ──── * follows (as follower)
users 1 ──── * follows (as following)
```

## Key indexes

- `users(username)`
- `users(email)`
- `posts(authorId, createdAt)`
- `follows(followerId)`
- `follows(followingId)`

## Notes

- Follow counts are updated transactionally on follow/unfollow.
- Post counts are updated on create (future: decrement on delete).
