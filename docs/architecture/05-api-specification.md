# Isntgram Fullstack Architecture Document - API Specification

## API Specification

The API is served by the NestJS service under the `/api/*` prefix.

Note: NextAuth/Auth.js routes live on the **web** service under `/auth/*` (not under `/api/*`) to avoid collisions with
the NestJS API routes.

```yaml
openapi: 3.0.1
info:
  title: Isntgram API
  description: The API for the Isntgram portfolio project.
  version: 1.0.0
servers:
  - url: /api
paths:
  /auth/register:
    post:
      summary: Register a new user
  /auth/signin:
    post:
      summary: Sign in (returns JWT access token)
  /auth/signout:
    post:
      summary: Sign out (no-op for JWT; included for parity)
  /auth/demo:
    post:
      summary: Ensure demo user exists (used by web demo flow)
  /health:
    get:
      summary: Health check
  /posts:
    post:
      summary: Create a new post
  /posts/feed:
    get:
      summary: Get the authenticated user's feed
  /posts/explore:
    get:
      summary: Get explore posts (public; optional auth for likedByMe)
  /posts/user/{username}:
    get:
      summary: Get posts authored by username
  /posts/{postId}:
    get:
      summary: Get a single post by its ID
    delete:
      summary: Delete a post by its ID
  /posts/{postId}/comments:
    get:
      summary: List comments for a post
    post:
      summary: Add a comment to a post
  /posts/{postId}/comments/{commentId}:
    delete:
      summary: Delete a comment by its ID (author-only)
  /posts/{postId}/like:
    post:
      summary: Like a post
    delete:
      summary: Unlike a post
  /ai/captions:
    post:
      summary: Generate caption suggestions (requires OPENAI_API_KEY)
  /users/{username}:
    get:
      summary: Get a user's profile information
  /users/me:
    get:
      summary: Get the current authenticated user's profile
  /users/{username}/follow:
    post:
      summary: Follow a user
    delete:
      summary: Unfollow a user
  /users/{username}/is-following:
    get:
      summary: Check if the current user is following username
  /users/{username}/followers:
    get:
      summary: Get a list of a user's followers
  /users/{username}/following:
    get:
      summary: Get a list of users a user is following
  /users/profile:
    put:
      summary: Update the current authenticated user's profile
  /users/check-username/{username}:
    get:
      summary: Check username availability
  /search:
    get:
      summary: Search for users and posts by hashtag
```
