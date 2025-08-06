Isntgram Product Requirements Document (PRD)
Goals and Background Context
Goals
To successfully build and deploy a feature-complete "Isntgram" application that mirrors the capabilities of the original human-led version.
To create a comprehensive set of documentation (Project Brief, PRD, Architecture, "Making Of" narrative) that clearly showcases the AI-driven development process.
To demonstrate mastery of the BMad-Method and AI agent orchestration, creating a standout portfolio piece.
Background Context
The software development landscape is undergoing a significant shift towards AI-assisted and AI-driven workflows. This project addresses the need for developers to demonstrate proficiency not just in coding, but in orchestrating these modern, AI-centric processes.
Instead of just presenting a final product, the "Isntgram" rebuild will showcase the process of creation itself as a primary deliverable. By leveraging the BMad-Method's team of specialized AI agents, this project will serve as a detailed case study, providing tangible proof of expertise in guiding an AI-powered team to produce a high-quality, complex application.
Change Log
Date
Version
Description
Author
Aug 6, 2025
1.0
Initial PRD draft from Project Brief
John (PM)
Aug 6, 2025
1.1
Updated feed logic to be personalized (followed users only)
John (PM)

Requirements
Functional
FR1: The system must support user registration, login, and secure authentication.
FR2: The system must include a special "demo mode" feature for frictionless recruiter access.
FR3: Users must be able to view a feed of posts with infinite scroll capability.
FR4: An explore page must be available with search functionality for users, posts, and hashtags.
FR5: Users must be able to view a single post's detail page.
FR6: Users must be able to like and unlike both posts and comments.
FR7: Users must be able to add comments to posts.
FR8: Users must be able to follow and unfollow other users.
FR9: Users must have a personal profile page that displays their own posts and can be edited.
FR10: Users must be able to view the profiles of other users.
FR11: A modal view must be implemented to show a user's followers and following lists.
FR12: Users must be able to upload a new post with an image, a caption, and hashtags.
FR13: Users must be able to delete their own posts and comments.
FR14: The system must provide a secure sign-out mechanism.
Non-Functional
NFR1 (Process): The application must be built using the BMad-Method, leveraging a team of specialized AI agents.
NFR2 (Documentation): The development process itself must be a key deliverable, resulting in comprehensive documentation including a "Making Of" narrative.
NFR3 (Testing): The application must achieve a minimum of 95% test coverage, developed using a strict Test-Driven Development (TDD) methodology.
NFR4 (Performance): The application must achieve a Lighthouse performance score of 90+ and feel fast and responsive, especially during infinite scroll.
NFR5 (Code Quality): The final codebase must be exceptionally clean, well-documented, and maintainable, demonstrating professional best practices.
NFR6 (Hosting Cost): Total hosting and third-party service costs must not exceed a hard limit of $20 per month.
NFR7 (Security): The application must implement standard security practices, including password hashing and secure input validation, with authentication managed by Auth.js.
NFR8 (Technology Stack): The application must use the latest stable versions of React (with Next.js), Redux for state management, and Tailwind CSS for styling. The choice of image storage solution is fully delegated to the Architect.
NFR9 (Compatibility): The application must be responsive and function correctly on the latest stable versions of Chrome, Firefox, Safari, and Edge on both desktop and mobile.
User Interface Design Goals
Overall UX Vision
The user experience should be a clean, modern, and intuitive high-fidelity replication of the core Instagram web application. The primary goal is to provide a seamless and impressive experience for the target users (recruiters and developers), faithfully replicating complex social media features with a polished feel.
Key Interaction Paradigms
Infinite Scroll: The main feed will use infinite scrolling for a frictionless browsing experience.
Modal Dialogs: Modals will be used for key interactions such as viewing followers/following lists and uploading new posts to keep the user within the main application context.
Real-time Feedback: Actions like liking a post or following a user should provide immediate visual feedback without a full page reload.
Core Screens and Views
Based on the MVP scope, the following are the most critical views needed to deliver the core functionality:
Login & Registration Screen
Main Feed (Home)
Explore Page (with Search)
Single Post Detail Page
User Profile Page (for self and others)
Edit Profile Page
Accessibility
The project will adhere to WCAG 2.1 AA standards. This is a common and respected benchmark for modern web applications and would be a strong positive signal in a portfolio piece.
Branding
The branding for "Isntgram" should be simple, clean, and professional. It should evoke the aesthetic of a modern social media app without directly infringing on Instagram's trademark. We will need to define a simple logo and color palette.
Target Device and Platforms
The application must be a responsive web application that works seamlessly on both desktop and mobile browsers.
Technical Assumptions
Repository Structure: Monorepo
Rationale: To manage both frontend and backend code in a single repository, which simplifies dependency management, code sharing (e.g., for data types), and overall project coordination.
Service Architecture: Monolith API
Rationale: For the MVP, a monolithic API will reduce deployment and operational complexity. The architecture should be designed with clear internal boundaries to allow for future evolution if needed.
Testing Requirements: TDD with Full Testing Pyramid (Unit, Integration, and E2E)
Rationale: To meet the non-functional requirement of 95%+ test coverage, a strict Test-Driven Development (TDD) approach is mandatory. This necessitates comprehensive unit, integration, and end-to-end (E2E) tests to ensure full application correctness.
Additional Technical Assumptions and Requests
Frontend Framework: The latest stable version of React, specifically using the Next.js framework, is required.
Frontend State Management: Redux is required for managing global application state.
Styling: Tailwind CSS is required for all styling and UI development.
Backend Framework: A TypeScript-based Node.js framework (such as NestJS) is strongly preferred to ensure a structured, scalable, and type-safe API.
Authentication: Authentication must be managed by Auth.js to handle security and user sessions.
Database Choice: This decision is delegated to the Architect. While PostgreSQL was noted as a good option for relational data, the final choice will be based on the Architect's analysis of project needs and cost constraints.
Image Storage: This decision is fully delegated to the Architect to select the most cost-effective and performant solution.
Hosting/Infrastructure: This decision is delegated to the Architect. The solution must respect the hard budget constraint of <$20/month. Evaluation of Firebase, Vercel, Supabase, AWS, Railway, or other providers is expected.
Epic List
Epic 1: Foundation, Authentication, and User Profiles
Goal: Establish the foundational project structure, including the full testing and CI/CD pipeline, to enable a strict TDD workflow from day one, then implement a complete and secure user authentication system and deliver core user profile functionality.
Epic 2: Core Social Graph & Interactions
Goal: Implement the core social graph by enabling users to follow and unfollow each other, and view those relationships.
Epic 3: Post Creation and Feed
Goal: Enable the core content loop by allowing users to create posts and view a personalized feed of content from users they follow.
Epic 4: Post Engagement and Discovery
Goal: Complete the core user experience by implementing post engagement features (likes, comments) and content discovery through search and an explore page.
Epic 1: Foundation, Authentication, and User Profiles
Expanded Goal: The goal is to establish the complete, testable foundation for the application. This involves setting up the monorepo, initializing the frontend and backend applications, and establishing the full TDD testing harness and CI/CD pipeline as you requested. Once this foundation is laid, the epic will deliver the first piece of core user value: a complete, secure authentication system and the ability for users to manage and view their profiles.
Story 1.1: Monorepo & Project Scaffolding
As a developer, I want a monorepo with separate Next.js (frontend) and NestJS (backend) applications initialized, so that I have a clean, organized structure for full-stack development.
Acceptance Criteria:
A monorepo (e.g., using npm workspaces) is created and initialized with Git.
A new Next.js application is bootstrapped in an apps/web directory.
A new NestJS application is bootstrapped in an apps/api directory.
Root-level package.json scripts exist to run, build, and test each application.
A base .gitignore file is configured for Node.js, Next.js, and NestJS projects.
Story 1.2: TDD Test Harness & CI Pipeline Setup
As a developer, I want a complete testing harness (unit, integration, E2E) and a basic CI pipeline configured, so that I can practice TDD from the very beginning and ensure code quality automatically.
Acceptance Criteria:
Jest and React Testing Library are configured for the Next.js frontend.
Jest is configured for the NestJS backend.
An E2E testing framework (e.g., Cypress or Playwright) is installed and configured.
A basic CI pipeline (e.g., using GitHub Actions) is created that installs dependencies and runs all tests on every push to the main branch.
A sample passing unit test exists in both the frontend and backend to prove the configuration.
The CI pipeline runs successfully on the initial commit.
Story 1.3: User Registration & Login UI
As a new user, I want to see and interact with registration and login forms, so that I can create an account or sign in to the application.
Acceptance Criteria:
A /register page displays a form with fields for email, full name, username, and password.
A /login page displays a form with fields for email and password.
The forms have basic client-side validation (e.g., valid email format, password meets minimum complexity).
The forms are styled with Tailwind CSS to match the modern, clean aesthetic.
Form submission is wired to placeholder functions; direct API integration is not required in this story.
Story 1.4: User Authentication Backend
As a developer, I want to integrate Auth.js and set up the backend endpoints for user registration and login, so that users can be securely created and authenticated.
Acceptance Criteria:
A User data model is created with fields for email, name, username, and a hashed password.
A POST /api/auth/register endpoint is created that validates input, hashes the password, and saves a new user to the database.
Auth.js is configured to handle credential-based login via its standard endpoints.
Upon successful login, a secure session is established for the user.
Appropriate error handling is implemented for duplicate usernames/emails or incorrect login credentials.
Story 1.5: Frontend-Backend Authentication Integration
As a user, I want to submit the registration and login forms and be securely authenticated, so that I can access the application's protected features.
Acceptance Criteria:
The frontend registration form successfully calls the backend API, creating a user.
Upon successful registration, the user is redirected to the login page with a success message.
The login form successfully authenticates the user via the backend.
Upon successful login, the user is redirected to the main feed, and their session state is managed globally (e.g., in Redux).
A "Sign Out" mechanism is implemented that clears the session and redirects to the login page.
Story 1.6: Basic User Profile Page
As a logged-in user, I want to view my own profile page and other users' profile pages, so that I can see basic user information.
Acceptance Criteria:
A dynamic route /[username] is created to display user profiles.
The page fetches and displays the user's username, full name, and placeholders for post counts and follower/following stats.
When viewing my own profile, an "Edit Profile" button is visible.
When viewing another user's profile, a "Follow" button is visible (functionality for this button will be implemented in Epic 2).
The page displays a clear "User not found" message if the username in the URL does not exist.
Story 1.7: Edit Profile Functionality
As a logged-in user, I want to edit my profile information, so that I can keep my details up to date.
Acceptance Criteria:
Clicking the "Edit Profile" button opens a modal or navigates to an edit page containing fields for my full name and username.
The form is pre-populated with my current data.
The form has validation to prevent submitting empty fields or a username that is already taken.
Submitting the form successfully updates the user's information in the database.
The profile page reflects the updated information upon successful submission.
Story 1.8: Demo Mode Access
As a recruiter, I want a "Try our demo" button on the login page, so that I can instantly access the application without registering.
Acceptance Criteria:
A "Try our demo" button is clearly visible on the /login page.
Clicking the button logs the user in as a pre-defined, read-only demo user without requiring a password.
The demo user session is established, and the user is redirected to the main feed.
The demo user account exists in the database with pre-populated data (e.g., posts, followers) to showcase the application's features.
Epic 2: Core Social Graph & Interactions
Expanded Goal: This epic focuses on building the core social graph of the application. It will enable users to form connections by following and unfollowing each other. This functionality will be fully integrated into the user profile, displaying follower/following statistics and allowing users to browse these lists, creating pathways for user discovery.
Story 2.1: Follow/Unfollow Backend Logic
As a developer, I want to create the backend logic and API endpoints to allow one user to follow or unfollow another, so that the social graph relationships can be stored and managed.
Acceptance Criteria:
A Follows data model (or equivalent relationship) is created to link a followerId to a followingId.
A unique constraint is in place to prevent a user from following the same person more than once.
A POST /api/users/{username}/follow endpoint is created that, for the authenticated user, creates a new follow relationship with the specified user.
A DELETE /api/users/{username}/follow endpoint is created that, for the authenticated user, removes an existing follow relationship.
The API prevents users from attempting to follow themselves.
The endpoints are protected and require user authentication.
Story 2.2: Frontend Follow/Unfollow Integration
As a user, I want to click the "Follow" button on another user's profile to follow them, and click it again to unfollow them, so that I can manage my social connections.
Acceptance Criteria:
On another user's profile, the button correctly shows "Follow" if I am not following them, and "Following" if I am.
Clicking the "Follow" button calls the POST endpoint, and on success, the button's state and text updates to "Following" without a page reload.
Clicking the "Following" button calls the DELETE endpoint, and on success, the button's state and text updates to "Follow" without a page reload.
The button is disabled and shows a loading indicator while the API call is in progress.
Story 2.3: Profile Follower/Following Stats
As a user, I want to see the number of followers a user has and the number of users they are following on their profile page, so that I can understand their social context within the application.
Acceptance Criteria:
The backend API that serves user profile data now includes accurate counts for followers and following.
The user profile UI accurately displays the "followers" count.
The user profile UI accurately displays the "following" count.
These counts update correctly after I follow or unfollow a user (a page refresh is an acceptable way to see the update for this story).
Story 2.4: Followers/Following List Modal
As a user, I want to click on the follower/following stats on a profile page to see a list of those users, so that I can discover new people.
Acceptance Criteria:
Clicking the "followers" count on a profile opens a modal dialog.
The modal displays a scrollable list of all users who follow the profile's owner.
Clicking the "following" count on a profile opens a similar modal displaying a list of all users the profile's owner is following.
Each user in the list displays their profile picture, username, and full name.
Clicking on a user in the modal navigates to their respective profile page.
A "Follow" / "Following" button is displayed next to each user in the list (except for myself), and it is fully functional.
Epic 3: Post Creation and Feed
Expanded Goal: With users and social connections established, this epic introduces the core content lifecycle of the application. It will empower users to create and share posts with an image and caption. It will also deliver the main feed, providing the central content consumption experience where users can see a personalized feed of content from users they follow.
Story 3.1: Create Post Backend
As a developer, I want to create the data model and API endpoint for creating a new post, so that users' content can be saved to the application.
Acceptance Criteria:
A Post data model is created that includes fields for an image URL, a caption, an author ID (userId), and timestamps.
A protected POST /api/posts endpoint is created that requires user authentication.
The endpoint validates the input (e.g., caption length limits, presence of an image URL).
A new post record is successfully created in the database and associated with the authenticated user.
Note: The image file upload and storage mechanism will be handled by the solution chosen by the Architect; this story is only concerned with receiving and storing the final image URL.
Story 3.2: Create Post UI and Integration
As a user, I want a simple interface to upload an image and write a caption, so that I can create a new post.
Acceptance Criteria:
A "Create Post" button or icon is available in the main navigation.
Clicking this button opens a modal for creating a new post.
The modal contains a file input for an image and a textarea for the caption.
After an image is selected and successfully uploaded to the storage provider, the user can submit the post (caption and the returned image URL) to the POST /api/posts endpoint.
Upon successful creation, the modal closes, and the user is redirected to the main feed, where their new post should appear at the top.
Story 3.3: Personalized Main Feed Backend
As a developer, I want a backend endpoint that retrieves posts only from users I follow, so that I can populate a personalized main feed.
Acceptance Criteria:
A GET /api/posts endpoint is created.
The endpoint returns a paginated list of posts only from users that the current authenticated user is following, sorted with the newest posts first.
Each post object in the response includes the post's ID, image URL, caption, creation date, and necessary information about the author (e.g., username, profile picture URL).
The endpoint must support pagination (e.g., using a cursor or limit/offset) to enable infinite scroll.
Story 3.4: Personalized Main Feed UI
As a user, I want to see a feed of posts from people I follow on the home page, so that I can see relevant content.
Acceptance Criteria:
The home page (/) fetches and displays posts from the GET /api/posts endpoint.
Each post is displayed in a card format, showing the author's username, the post image, and the caption.
The feed implements infinite scroll, fetching the next page of results when the user nears the bottom of the list.
A loading state is clearly shown while the initial posts are being fetched.
A user-friendly message is shown if the user is not following anyone or if the users they follow have not posted yet (e.g., "Your feed is empty. Follow people to see their posts!").
The author's username on each post is a link to their profile page.
Epic 4: Post Engagement and Discovery
Expanded Goal: This final epic completes the core feature set for the MVP by introducing interactivity and discovery. It will allow users to engage directly with content by viewing post details, liking, and commenting. It also provides users the ability to manage their own content by deleting posts and comments, and will introduce an explore/search page to find new users and posts with hashtags.
Story 4.1: Single Post Detail Page
As a user, I want to click on a post in the feed to view a dedicated detail page, so that I can see the post and all of its comments in one focused view.
Acceptance Criteria:
A GET /api/posts/{postId} endpoint is created that retrieves all data for a single post, including author information and a list of all its comments.
A dynamic route posts/{postId} is created on the frontend.
Clicking on a post from the main feed or a user's profile navigates to this new page.
The page displays the post image, author details, caption, and a full list of comments below it.
The page correctly handles the case where a post ID is invalid or not found.
Story 4.2: Like and Unlike a Post
As a user, I want to like and unlike a post, so that I can show my appreciation for the content.
Acceptance Criteria:
Backend endpoints (POST /api/posts/{postId}/like and DELETE /api/posts/{postId}/like) are created to manage post likes for the authenticated user.
On the feed and post detail pages, a "like" icon and a visible count of total likes are displayed on each post.
The icon's state (e.g., filled vs. outline) correctly reflects whether I have personally liked the post.
Clicking the "like" icon toggles my like status for the post and updates the like count, without requiring a page reload.
Story 4.3: Comment on a Post
As a user, I want to add comments to a post, so that I can share my thoughts and interact with others.
Acceptance Criteria:
A Comment data model is created with fields for the comment text, userId, postId, and timestamps.
A protected POST /api/posts/{postId}/comments endpoint is created.
On the post detail page, a text input is available for writing a new comment.
Submitting the comment adds it to the database and updates the comment list in the UI without a full page reload.
Story 4.4: Delete Own Posts and Comments
As a user, I want to be able to delete my own posts and comments, so that I can manage the content I have created.
Acceptance Criteria:
A DELETE /api/posts/{postId} endpoint is created that only allows the post's author to delete it.
A DELETE /api/comments/{commentId} endpoint is created that only allows the comment's author to delete it.
On my own posts (e.g., from my profile or the detail page), a "delete" option is visible. Clicking it and confirming removes the post.
Next to my own comments, a "delete" option is visible. Clicking it removes the comment from the UI.
Story 4.5: Explore and Search Page
As a user, I want an explore page with a search bar, so that I can discover new users, posts, and content via hashtags.
Acceptance Criteria:
Backend search endpoints are created to find users (by username) and posts (by hashtags within the caption).
An /explore page is created that initially shows a grid of recent posts from all users, providing a discovery mechanism distinct from the main feed.
The page includes a search bar.
Executing a search displays results for matching users and posts.
Hashtags (e.g., #react) in post captions are rendered as clickable links.
Clicking a hashtag link navigates to a search results page for that specific tag.
Checklist Results Report
Category
Status
Critical Issues

1. Problem Definition & Context
   ✅ PASS
   None
2. MVP Scope Definition
   ✅ PASS
   None
3. User Experience Requirements
   ✅ PASS
   None
4. Functional Requirements
   ✅ PASS
   None
5. Non-Functional Requirements
   ✅ PASS
   None
6. Epic & Story Structure
   ✅ PASS
   None
7. Technical Guidance
   ✅ PASS
   None
8. Cross-Functional Requirements
   ✅ PASS
   None
9. Clarity & Communication
   ✅ PASS
   None

Critical Deficiencies:
None. The document is robust, internally consistent, and ready for the next phase.
Recommendations:
Proceed to the UI/UX Specification and Architecture phases. The Architect should pay close attention to the delegated infrastructure decisions (hosting, database, image storage) to design a solution that meets the strict budget constraint of <$20/month.
Final Decision:
READY FOR ARCHITECT & UX-EXPERT
Next Steps
UX Expert Prompt
Sally, the PRD for Isntgram is complete and attached. Please review it to create the UI/UX Specification, focusing on the User Interface Design Goals and the defined user stories to ensure a high-fidelity and intuitive user experience.
Architect Prompt
Winston, the PRD for Isntgram is complete. Please begin your architectural design process. Pay close attention to the Technical Assumptions, especially the delegated decisions regarding hosting, database, and image storage, ensuring the final design adheres to the <$20/month budget constraint and the TDD/E2E testing requirements.
