# Isntgram Product Requirements Document (PRD) - Epic 1: Foundation, Authentication, and User Profiles

## Epic 1: Foundation, Authentication, and User Profiles

**Expanded Goal**: The goal is to establish the complete, testable foundation for the application. This involves setting up the monorepo, initializing the frontend and backend applications, and establishing the full TDD testing harness and CI/CD pipeline as you requested. Once this foundation is laid, the epic will deliver the first piece of core user value: a complete, secure authentication system and the ability for users to manage and view their profiles.

### Story 1.1: Monorepo & Project Scaffolding

**As a developer**, I want a monorepo with separate Next.js (frontend) and NestJS (backend) applications initialized, so that I have a clean, organized structure for full-stack development.

**Acceptance Criteria**:

- A monorepo (e.g., using npm workspaces) is created and initialized with Git.
- A new Next.js application is bootstrapped in an `apps/web` directory.
- A new NestJS application is bootstrapped in an `apps/api` directory.
- Root-level package.json scripts exist to run, build, and test each application.
- A base .gitignore file is configured for Node.js, Next.js, and NestJS projects.

### Story 1.2: TDD Test Harness & CI Pipeline Setup

**As a developer**, I want a complete testing harness (unit, integration, E2E) and a basic CI pipeline configured, so that I can practice TDD from the very beginning and ensure code quality automatically.

**Acceptance Criteria**:

- Jest and React Testing Library are configured for the Next.js frontend.
- Jest is configured for the NestJS backend.
- An E2E testing framework (e.g., Cypress or Playwright) is installed and configured.
- A basic CI pipeline (e.g., using GitHub Actions) is created that installs dependencies and runs all tests on every push to the main branch.
- A sample passing unit test exists in both the frontend and backend to prove the configuration.
- The CI pipeline runs successfully on the initial commit.

### Story 1.3: User Registration & Login UI

**As a new user**, I want to see and interact with registration and login forms, so that I can create an account or sign in to the application.

**Acceptance Criteria**:

- A `/register` page displays a form with fields for email, full name, username, and password.
- A `/login` page displays a form with fields for email and password.
- The forms have basic client-side validation (e.g., valid email format, password meets minimum complexity).
- The forms are styled with Tailwind CSS to match the modern, clean aesthetic.
- Form submission is wired to placeholder functions; direct API integration is not required in this story.

### Story 1.4: User Authentication Backend

**As a developer**, I want to integrate Auth.js and set up the backend endpoints for user registration and login, so that users can be securely created and authenticated.

**Acceptance Criteria**:

- A User data model is created with fields for email, name, username, and a hashed password.
- A `POST /api/auth/register` endpoint is created that validates input, hashes the password, and saves a new user to the database.
- Auth.js is configured to handle credential-based login via its standard endpoints.
- Upon successful login, a secure session is established for the user.
- Appropriate error handling is implemented for duplicate usernames/emails or incorrect login credentials.

### Story 1.5: Frontend-Backend Authentication Integration

**As a user**, I want to submit the registration and login forms and be securely authenticated, so that I can access the application's protected features.

**Acceptance Criteria**:

- The frontend registration form successfully calls the backend API, creating a user.
- Upon successful registration, the user is redirected to the login page with a success message.
- The login form successfully authenticates the user via the backend.
- Upon successful login, the user is redirected to the main feed, and their session state is managed globally (e.g., in Redux).
- A "Sign Out" mechanism is implemented that clears the session and redirects to the login page.

### Story 1.6: Basic User Profile Page

**As a logged-in user**, I want to view my own profile page and other users' profile pages, so that I can see basic user information.

**Acceptance Criteria**:

- A dynamic route `/[username]` is created to display user profiles.
- The page fetches and displays the user's username, full name, and placeholders for post counts and follower/following stats.
- When viewing my own profile, an "Edit Profile" button is visible.
- When viewing another user's profile, a "Follow" button is visible (functionality for this button will be implemented in Epic 2).
- The page displays a clear "User not found" message if the username in the URL does not exist.

### Story 1.7: Edit Profile Functionality

**As a logged-in user**, I want to edit my profile information, so that I can keep my details up to date.

**Acceptance Criteria**:

- Clicking the "Edit Profile" button opens a modal or navigates to an edit page containing fields for my full name and username.
- The form is pre-populated with my current data.
- The form has validation to prevent submitting empty fields or a username that is already taken.
- Submitting the form successfully updates the user's information in the database.
- The profile page reflects the updated information upon successful submission.

### Story 1.8: Demo Mode Access

**As a recruiter**, I want a "Try our demo" button on the login page, so that I can instantly access the application without registering.

**Acceptance Criteria**:

- A "Try our demo" button is clearly visible on the `/login` page.
- Clicking the button logs the user in as a pre-defined, read-only demo user without requiring a password.
- The demo user session is established, and the user is redirected to the main feed.
- The demo user account exists in the database with pre-populated data (e.g., posts, followers) to showcase the application's features.
