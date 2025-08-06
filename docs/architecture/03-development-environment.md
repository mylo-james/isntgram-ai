# Isntgram Fullstack Architecture Document - Development Environment & Tooling

## Recommended Development Environment & Tooling

This section outlines the recommended tools for developers working on this project. While the application itself depends on the technologies in the stack below, this environment is optimized for the BMad-Method and AI-agent collaboration used to build Isntgram.

| Category        | Technology                | Purpose                | Rationale                                                                                                                                                                                                  |
| --------------- | ------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDE             | Cursor                    | AI-native code editor  | The entire project is orchestrated through AI agents. Cursor is a purpose-built IDE for this workflow, providing the necessary context and features to effectively manage and guide AI-driven development. |
| Version Control | Git & GitHub              | Source code management | Standard for version control. GitHub will be used for CI/CD pipelines via GitHub Actions.                                                                                                                  |
| Terminal        | iTerm2 / Windows Terminal | Command-line interface | A modern terminal is recommended for managing the monorepo and running development scripts.                                                                                                                |

## Technology Stack Table

This table defines the technologies that are direct dependencies of the Isntgram application itself.

| Category                   | Technology              | Version | Purpose                                                   | Rationale                                                                                                             |
| -------------------------- | ----------------------- | ------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Frontend Language**      | TypeScript              | ~5.x    | Primary language for frontend development.                | Provides type safety and scalability, reducing errors in a complex application.                                       |
| **Frontend Framework**     | Next.js                 | ~14.x   | The core React framework for the user interface.          | Required by the PRD; provides SSR, routing, and performance optimizations out-of-the-box.                             |
| **UI Component Library**   | Shadcn/ui               | latest  | Base component library for building the UI.               | Required by the UI/UX spec; provides accessible and unstyled components that we can shape with Tailwind CSS.          |
| **State Management**       | Redux Toolkit           | ~2.x    | Manages global application state.                         | Explicitly required by the PRD for state management.                                                                  |
| **Styling**                | Tailwind CSS            | ~3.x    | Utility-first CSS framework for styling.                  | Required by the PRD; allows for rapid and consistent UI development.                                                  |
| **Backend Language**       | TypeScript              | ~5.x    | Primary language for backend development.                 | Ensures type consistency across the full stack and aligns with the NestJS framework.                                  |
| **Backend Framework**      | NestJS                  | ~10.x   | The core framework for the monolithic API.                | Strongly preferred by the PRD; provides a structured, modular architecture suitable for TDD.                          |
| **API Style**              | REST                    | N/A     | Defines the architecture for client-server communication. | A standard, well-understood approach that integrates cleanly between a Next.js frontend and a NestJS backend.         |
| **Database**               | PostgreSQL              | 16.x    | Primary data store for all application data.              | A robust relational database ideal for managing the social graph's data. Fits within Railway's free tier.             |
| **File Storage**           | AWS S3                  | N/A     | Stores all user-uploaded images.                          | Required by the Project Brief and is a cost-effective, highly scalable solution for object storage.                   |
| **Authentication**         | Auth.js (NextAuth)      | ~5.x    | Manages user authentication and sessions.                 | Explicitly required by the PRD for secure and robust authentication handling.                                         |
| **Code Quality & Tooling** | ESLint                  | ~9.x    | Enforces code quality and finds potential bugs.           | Industry standard for linting TypeScript. Essential for maintaining a uniform, high-quality codebase.                 |
| **Code Quality & Tooling** | Prettier                | ~3.x    | Provides consistent, opinionated code formatting.         | Automates code formatting to eliminate style debates and ensure readability.                                          |
| **Code Quality & Tooling** | markdownlint-cli        | latest  | Enforces standards in all Markdown documentation.         | Crucial for maintaining the quality of core documents like the PRD and Architecture, which guide the AI agents.       |
| **Code Quality & Tooling** | Husky                   | ~9.x    | Manages Git hooks to automate tasks.                      | Automates pre-commit checks to ensure no low-quality code enters the repository.                                      |
| **Code Quality & Tooling** | lint-staged             | ~15.x   | Runs linters on staged files before commit.               | Works with Husky to make pre-commit checks fast and efficient by only checking changed files.                         |
| **Frontend Testing**       | Jest & RTL              | latest  | For unit and integration testing of React components.     | Standard for Next.js and essential for meeting the 95%+ TDD coverage requirement.                                     |
| **Backend Testing**        | Jest                    | latest  | For unit and integration testing of the NestJS API.       | The default and recommended testing framework for NestJS, aligning with our TDD goals.                                |
| **E2E Testing**            | Playwright              | ~1.x    | For end-to-end testing of critical user flows.            | A modern, powerful E2E framework that supports our TDD pyramid approach.                                              |
| **CI/CD**                  | GitHub Actions          | N/A     | Automates testing and deployment pipelines.               | A free and powerful CI/CD solution that integrates directly with our code repository.                                 |
| **Monitoring & Logging**   | Vercel/Railway Built-in | N/A     | Provides runtime analytics and logging.                   | Using the platforms' native tools is the most cost-effective way to meet monitoring needs while staying under budget. |
