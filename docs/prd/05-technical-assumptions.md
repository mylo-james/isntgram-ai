# Isntgram Product Requirements Document (PRD) - Technical Assumptions

## Technical Assumptions

### Repository Structure: Monorepo

**Rationale**: To manage both frontend and backend code in a single repository, which simplifies dependency management,
code sharing (e.g., for data types), and overall project coordination.

### Service Architecture: Monolith API

**Rationale**: For the MVP, a monolithic API will reduce deployment and operational complexity. The architecture should
be designed with clear internal boundaries to allow for future evolution if needed.

### Testing Requirements: TDD with Full Testing Pyramid (Unit, Integration, and E2E)

**Rationale**: To meet the non-functional requirement of 95%+ test coverage, a strict Test-Driven Development (TDD)
approach is mandatory. This necessitates comprehensive unit, integration, and end-to-end (E2E) tests to ensure full
application correctness.

## Additional Technical Assumptions and Requests

### Frontend Framework

The latest stable version of React, specifically using the Next.js framework, is required.

### Frontend State Management

Redux is required for managing global application state.

### Styling

Tailwind CSS is required for all styling and UI development.

### Backend Framework

A TypeScript-based Node.js framework (such as NestJS) is strongly preferred to ensure a structured, scalable, and
type-safe API.

### Authentication

Authentication must be managed by Auth.js to handle security and user sessions.

### Database Choice

This decision is delegated to the Architect. While PostgreSQL was noted as a good option for relational data, the final
choice will be based on the Architect's analysis of project needs and cost constraints.

### Image Storage

This decision is fully delegated to the Architect to select the most cost-effective and performant solution.

### Hosting/Infrastructure

This decision is delegated to the Architect. The solution must respect the hard budget constraint of <$20/month.
Evaluation of Firebase, Supabase, AWS, Railway, or other providers is expected.
