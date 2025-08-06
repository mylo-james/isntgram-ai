# Isntgram Product Requirements Document (PRD) - Epic 4: Post Engagement and Discovery

## Epic 4: Post Engagement and Discovery

**Expanded Goal**: This final epic completes the core feature set for the MVP by introducing interactivity and discovery. It will allow users to engage directly with content by viewing post details, liking, and commenting. It also provides users the ability to manage their own content by deleting posts and comments, and will introduce an explore/search page to find new users and posts with hashtags.

### Story 4.1: Single Post Detail Page

**As a user**, I want to click on a post in the feed to view a dedicated detail page, so that I can see the post and all of its comments in one focused view.

**Acceptance Criteria**:

- A `GET /api/posts/{postId}` endpoint is created that retrieves all data for a single post, including author information and a list of all its comments.
- A dynamic route `posts/{postId}` is created on the frontend.
- Clicking on a post from the main feed or a user's profile navigates to this new page.
- The page displays the post image, author details, caption, and a full list of comments below it.
- The page correctly handles the case where a post ID is invalid or not found.

### Story 4.2: Like and Unlike a Post

**As a user**, I want to like and unlike a post, so that I can show my appreciation for the content.

**Acceptance Criteria**:

- Backend endpoints (`POST /api/posts/{postId}/like` and `DELETE /api/posts/{postId}/like`) are created to manage post likes for the authenticated user.
- On the feed and post detail pages, a "like" icon and a visible count of total likes are displayed on each post.
- The icon's state (e.g., filled vs. outline) correctly reflects whether I have personally liked the post.
- Clicking the "like" icon toggles my like status for the post and updates the like count, without requiring a page reload.

### Story 4.3: Comment on a Post

**As a user**, I want to add comments to a post, so that I can share my thoughts and interact with others.

**Acceptance Criteria**:

- A Comment data model is created with fields for the comment text, `userId`, `postId`, and timestamps.
- A protected `POST /api/posts/{postId}/comments` endpoint is created.
- On the post detail page, a text input is available for writing a new comment.
- Submitting the comment adds it to the database and updates the comment list in the UI without a full page reload.

### Story 4.4: Delete Own Posts and Comments

**As a user**, I want to be able to delete my own posts and comments, so that I can manage the content I have created.

**Acceptance Criteria**:

- A `DELETE /api/posts/{postId}` endpoint is created that only allows the post's author to delete it.
- A `DELETE /api/comments/{commentId}` endpoint is created that only allows the comment's author to delete it.
- On my own posts (e.g., from my profile or the detail page), a "delete" option is visible. Clicking it and confirming removes the post.
- Next to my own comments, a "delete" option is visible. Clicking it removes the comment from the UI.

### Story 4.5: Explore and Search Page

**As a user**, I want an explore page with a search bar, so that I can discover new users, posts, and content via hashtags.

**Acceptance Criteria**:

- Backend search endpoints are created to find users (by username) and posts (by hashtags within the caption).
- An `/explore` page is created that initially shows a grid of recent posts from all users, providing a discovery mechanism distinct from the main feed.
- The page includes a search bar.
- Executing a search displays results for matching users and posts.
- Hashtags (e.g., #react) in post captions are rendered as clickable links.
- Clicking a hashtag link navigates to a search results page for that specific tag.
