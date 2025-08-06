# Isntgram UI/UX Specification

## 1. Overall UX Goals & Principles

### 1.1. Target User Personas

#### Primary Persona: The Evaluator (Recruiters & Hiring Managers)

**Profile**: Time-constrained professionals scanning for talent.

**Goal**: To efficiently assess project complexity, code quality, and a candidate's skills.

**Needs**: A live, frictionless demo, clear functionality, and an impressive, polished UI. They value speed and ease of access above all.

#### Secondary Persona: The Reviewer (Peer Developers & Architects)

**Profile**: Technical experts evaluating code and architecture.

**Goal**: To assess technical depth, maintainability, and adherence to best practices.

**Needs**: Well-structured, readable code, comprehensive tests, and clear documentation that explains the "why" behind decisions.

### 1.2. Usability Goals

- **Frictionless Evaluation**: A recruiter must be able to access the live demo and understand the project's quality in under 5 minutes.
- **Efficiency of Use**: The UI should feel fast and responsive, with a focus on smooth infinite scrolling and immediate feedback.
- **Ease of Learning**: The interface should be intuitive, mimicking established social media patterns.
- **High Performance**: Target a Lighthouse performance score of 90+.

### 1.3. Core Design Principles

- **Clarity over Cleverness**: Prioritize clear, intuitive layouts over novel or complex designs.
- **Fidelity & Polish**: The UI must feel like a real, production-grade application with attention to detail.
- **Accessible by Default**: Design and build to meet WCAG 2.1 AA standards from the start.
- **Guided Discovery**: The UI and documentation should make it easy to discover the underlying quality of the work.

## 2. Information Architecture (IA)

### 2.1. Site Map

```mermaid
graph TD
    subgraph Unauthenticated
        A[Login / Register] -->|Login| B(Home Feed);
    end

    subgraph Authenticated
        B(Home Feed) --> C(User Profile);
        B --> D(Single Post Page);
        B --> E(Explore Page);

        subgraph Main Navigation
            F[Nav: Home] --> B;
            G[Nav: Explore] --> E;
            H[Nav: Create Post] --> I(Create Post Modal);
            J[Nav: Profile] --> C;
        end

        C --> D;
        C --> K(Edit Profile Page);
        C --> L(Followers/Following Modal);
        E -- Search --> C;
        E -- Search --> D;
    end
```

### 2.2. Navigation Structure

- **Primary Navigation**: A persistent bar providing access to Home, Explore, Create Post, and Profile.
- **Secondary Navigation**: Contextual links (e.g., clicking a username).
- **Breadcrumb Strategy**: Not required; primary navigation will provide constant orientation.

## 3. User Flows

- **User Registration**: A standard flow from a "Sign up" link to a form, API submission, and redirect to login on success.
- **User Login & Demo Access**: A login page with two paths: standard email/password login or a one-click "Try our demo" button.
- **Create a New Post**: A modal-based flow to select an image, upload it, write a caption, and share to the feed.
- **Post Engagement**: In-feed actions (Like, Comment, Follow) provide immediate optimistic UI updates with API calls in the background.
- **Main Feed & Infinite Scroll**: The default view for logged-in users, automatically fetching older posts as the user scrolls.
- **Explore & Search**: An explore page with a search bar to find users and posts by hashtags.
- **Edit Profile**: A modal or page where users can update their own information.
- **Delete Content**: A confirmation-based flow to allow users to delete their own posts or comments.

## 4. Screen Layouts

### 4.1. Login Screen

**Purpose**: Secure sign-in, registration path, and demo mode access.

**Key Elements**: Logo, input fields (email, password), "Log In" button, "Try our demo" button, "Sign up" link, and a footer with links to your GitHub and personal dev site.

### 4.2. Registration Screen

**Purpose**: New user account creation.

**Key Elements**: Logo, tagline, input fields (email, full name, username, password), "Sign Up" button, "Log in" link, and the same footer links.

### 4.3. Main Feed (Home Screen)

**Purpose**: Primary, infinitely scrolling feed of posts.

**Key Elements**: Main navigation, a single column of post components (each with header, image, action bar, caption, etc.), and a loading spinner for infinite scroll.

### 4.4. User Profile Page

**Purpose**: Display user information and their grid of posts.

**Key Elements**: Profile header (avatar, username, follow/edit button, stats) and a grid of post thumbnails.

### 4.5. Single Post Detail Page

**Purpose**: Focused view of a single post and its comments.

**Key Elements**: A two-column layout on desktop (image on left, details/comments on right) and a single-column layout on mobile.

### 4.6. Explore Page

**Purpose**: Discovery of new content and users.

**Key Elements**: Prominent search bar and a masonry grid of post thumbnails.

### 4.7. Edit Profile Page

**Purpose**: Allow users to modify their personal information.

**Key Elements**: A simple form with fields for "Full Name" and "Username".

## 5. Responsiveness Strategy

- **Mobile-First Approach**: Layouts are designed for mobile first, then adapted for larger screens.
- **Breakpoints**: Mobile (<768px), Tablet (768px-1024px), Desktop (>1024px).
- **Navigation**: The primary navigation bar will be at the bottom on mobile and at the top on desktop/tablet.

## 6. Component Library / Design System

- **Foundation**: We will use Shadcn/ui as a base for our components.
- **Styling**: All components will be styled with Tailwind CSS.
- **Core Components**: Button, Input, Modal, Card, Avatar, Toast.

## 7. Branding & Style Guide

- **Aesthetic**: "Cute and full of personality, but still professional."
- **Color Palette**: A vibrant, multi-color theme using a rainbow of pastel accents against a neutral background. The primary colors will be soft, complementary shades of Red, Yellow, Green, Blue, and Purple.
- **Typography**: A standard, highly-readable sans-serif system font.
- **Iconography**: A clean, modern icon set like Lucide Icons.

## 8. Notifications & Feedback

- **Standard**: Non-blocking feedback (e.g., "Profile updated") will be delivered via a toast notification library (e.g., react-toastify).
- **Critical Errors**: Form validation errors will appear inline, next to the relevant field.

## 9. Animation & Micro-interactions

- **Principle**: Motion will be subtle and purposeful.
- **Examples**: Gentle fade-in for modals, a "pop" effect for the like button, and skeleton loaders for feed content.

## 10. Performance Considerations

- **Goal**: Lighthouse score of 90+.
- **Strategies**: Automatic image optimization/compression and lazy loading for images in the feed.
