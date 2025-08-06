# Isntgram Fullstack Architecture Document - Data Models

## Data Models

### User

**Purpose**: Represents an individual user account in the system.

**TypeScript Interface**:

```typescript
export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  postsCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships**: Has many Posts, Comments, Likes, and Follows.

### Post

**Purpose**: Represents a single image post created by a user.

**TypeScript Interface**:

```typescript
import { User } from "./user";

export interface Post {
  id: string;
  authorId: string;
  imageUrl: string;
  caption?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  author?: User; // Optional populated field
}
```

**Relationships**: Belongs to one User (author), has many Comments and Likes.

### Comment

**Purpose**: Represents a single comment made by a user on a Post.

**TypeScript Interface**:

```typescript
import { User } from "./user";

export interface Comment {
  id: string;
  authorId: string;
  postId: string;
  text: string;
  likesCount: number;
  createdAt: Date;
  updatedAt: Date;
  author?: User; // Optional populated field
}
```

**Relationships**: Belongs to one User (author) and one Post, has many Likes.

### Like

**Purpose**: Represents a "like" action from a user on either a Post or a Comment.

**TypeScript Interface**:

```typescript
export type LikeableType = "POST" | "COMMENT";

export interface Like {
  id: string;
  userId: string;
  likeableId: string;
  likeableType: LikeableType;
  createdAt: Date;
}
```

**Relationships**: Belongs to one User and either one Post or one Comment.

### Follows

**Purpose**: A join table representing the many-to-many relationship between users.

**TypeScript Interface**:

```typescript
export interface Follows {
  followerId: string;
  followingId: string;
  createdAt: Date;
}
```

**Relationships**: Connects two User records.
