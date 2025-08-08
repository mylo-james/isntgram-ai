# Isntgram Product Requirements Document (PRD) - Epic 3: Post Creation and Feed

## Epic 3: Post Creation and Feed

**Expanded Goal**: With users and social connections established, this epic introduces the core content lifecycle of the
application. It will empower users to create and share posts with an image and caption. It will also deliver the main
feed, providing the central content consumption experience where users can see a personalized feed of content from users
they follow.

### Story 3.1: Create Post Backend

**As a developer**, I want to create the data model and API endpoint for creating a new post, so that users' content can
be saved to the application.

**Acceptance Criteria**:

- A Post data model is created that includes fields for an image URL, a caption, an author ID (`userId`), and
  timestamps.
- A protected `POST /api/posts` endpoint is created that requires user authentication.
- The endpoint validates the input (e.g., caption length limits, presence of an image URL).
- A new post record is successfully created in the database and associated with the authenticated user.

**Note**: The image file upload and storage mechanism will be handled by the solution chosen by the Architect; this
story is only concerned with receiving and storing the final image URL.

### Story 3.2: Create Post UI and Integration

**As a user**, I want a simple interface to upload an image and write a caption, so that I can create a new post.

**Acceptance Criteria**:

- A "Create Post" button or icon is available in the main navigation.
- Clicking this button opens a modal for creating a new post.
- The modal contains a file input for an image and a textarea for the caption.
- After an image is selected and successfully uploaded to the storage provider, the user can submit the post (caption
  and the returned image URL) to the `POST /api/posts` endpoint.
- Upon successful creation, the modal closes, and the user is redirected to the main feed, where their new post should
  appear at the top.

### Story 3.3: Personalized Main Feed Backend

**As a developer**, I want a backend endpoint that retrieves posts only from users I follow, so that I can populate a
personalized main feed.

**Acceptance Criteria**:

- A `GET /api/posts` endpoint is created.
- The endpoint returns a paginated list of posts only from users that the current authenticated user is following,
  sorted with the newest posts first.
- Each post object in the response includes the post's ID, image URL, caption, creation date, and necessary information
  about the author (e.g., username, profile picture URL).
- The endpoint must support pagination (e.g., using a cursor or limit/offset) to enable infinite scroll.

### Story 3.4: Personalized Main Feed UI

**As a user**, I want to see a feed of posts from people I follow on the home page, so that I can see relevant content.

**Acceptance Criteria**:

- The home page (`/`) fetches and displays posts from the `GET /api/posts` endpoint.
- Each post is displayed in a card format, showing the author's username, the post image, and the caption.
- The feed implements infinite scroll, fetching the next page of results when the user nears the bottom of the list.
- A loading state is clearly shown while the initial posts are being fetched.
- A user-friendly message is shown if the user is not following anyone or if the users they follow have not posted yet
  (e.g., "Your feed is empty. Follow people to see their posts!").
- The author's username on each post is a link to their profile page.
