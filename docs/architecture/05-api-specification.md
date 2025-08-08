# Isntgram Fullstack Architecture Document - API Specification

## API Specification

This specification uses the OpenAPI 3.0 standard. Authentication endpoints like login and logout are handled
automatically by Auth.js at `/api/auth/*`.

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
  /posts:
    get:
      summary: Get the main personalized feed of posts
    post:
      summary: Create a new post
  /posts/{postId}:
    get:
      summary: Get a single post by its ID
    delete:
      summary: Delete a post by its ID
  /posts/{postId}/comments:
    post:
      summary: Add a comment to a post
  /comments/{commentId}:
    delete:
      summary: Delete a comment by its ID
  /posts/{postId}/like:
    post:
      summary: Like a post
    delete:
      summary: Unlike a post
  /comments/{commentId}/like:
    post:
      summary: Like a comment
    delete:
      summary: Unlike a comment
  /users/{username}:
    get:
      summary: Get a user's profile information
  /users/{username}/posts:
    get:
      summary: Get all posts created by a specific user
  /users/{username}/follow:
    post:
      summary: Follow a user
    delete:
      summary: Unfollow a user
  /users/{username}/followers:
    get:
      summary: Get a list of a user's followers
  /users/{username}/following:
    get:
      summary: Get a list of users a user is following
  /profile:
    put:
      summary: Update the current authenticated user's profile
  /search:
    get:
      summary: Search for users and posts by hashtag
  /explore:
    get:
      summary: Get a grid of posts for the Explore page
  /uploads/presigned-url:
    post:
      summary: Get a secure pre-signed URL for uploading a file to S3
```
