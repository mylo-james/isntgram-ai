# Isntgram Product Requirements Document (PRD) - Epic 2: Core Social Graph & Interactions

## Epic 2: Core Social Graph & Interactions

**Expanded Goal**: This epic focuses on building the core social graph of the application. It will enable users to form connections by following and unfollowing each other. This functionality will be fully integrated into the user profile, displaying follower/following statistics and allowing users to browse these lists, creating pathways for user discovery.

### Story 2.1: Follow/Unfollow Backend Logic

**As a developer**, I want to create the backend logic and API endpoints to allow one user to follow or unfollow another, so that the social graph relationships can be stored and managed.

**Acceptance Criteria**:

- A Follows data model (or equivalent relationship) is created to link a `followerId` to a `followingId`.
- A unique constraint is in place to prevent a user from following the same person more than once.
- A `POST /api/users/{username}/follow` endpoint is created that, for the authenticated user, creates a new follow relationship with the specified user.
- A `DELETE /api/users/{username}/follow` endpoint is created that, for the authenticated user, removes an existing follow relationship.
- The API prevents users from attempting to follow themselves.
- The endpoints are protected and require user authentication.

### Story 2.2: Frontend Follow/Unfollow Integration

**As a user**, I want to click the "Follow" button on another user's profile to follow them, and click it again to unfollow them, so that I can manage my social connections.

**Acceptance Criteria**:

- On another user's profile, the button correctly shows "Follow" if I am not following them, and "Following" if I am.
- Clicking the "Follow" button calls the POST endpoint, and on success, the button's state and text updates to "Following" without a page reload.
- Clicking the "Following" button calls the DELETE endpoint, and on success, the button's state and text updates to "Follow" without a page reload.
- The button is disabled and shows a loading indicator while the API call is in progress.

### Story 2.3: Profile Follower/Following Stats

**As a user**, I want to see the number of followers a user has and the number of users they are following on their profile page, so that I can understand their social context within the application.

**Acceptance Criteria**:

- The backend API that serves user profile data now includes accurate counts for followers and following.
- The user profile UI accurately displays the "followers" count.
- The user profile UI accurately displays the "following" count.
- These counts update correctly after I follow or unfollow a user (a page refresh is an acceptable way to see the update for this story).

### Story 2.4: Followers/Following List Modal

**As a user**, I want to click on the follower/following stats on a profile page to see a list of those users, so that I can discover new people.

**Acceptance Criteria**:

- Clicking the "followers" count on a profile opens a modal dialog.
- The modal displays a scrollable list of all users who follow the profile's owner.
- Clicking the "following" count on a profile opens a similar modal displaying a list of all users the profile's owner is following.
- Each user in the list displays their profile picture, username, and full name.
- Clicking on a user in the modal navigates to their respective profile page.
- A "Follow" / "Following" button is displayed next to each user in the list (except for myself), and it is fully functional.
