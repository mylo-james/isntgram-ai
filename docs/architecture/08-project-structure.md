# Isntgram Fullstack Architecture Document - Project Structure

## Unified Project Structure

A monorepo structure using pnpm workspaces has been defined, including:

- `.cursor/` for AI agent rules.
- `apps/web` for the Next.js frontend, including a **tests** directory.
- `apps/api` for the NestJS backend.
- `docs/` for all project documentation.

## Frontend Architecture

Detailed architecture for the Next.js app is defined, including:

- A feature-sliced component organization.
- A modern component template with styling defined after the component logic.
- Next.js App Router for file-system-based routing.
- A centralized API client services layer.

## Backend Architecture

Detailed architecture for the NestJS API is defined, including:

- A feature-based modular structure (controllers, services, DTOs, entities).
- Strict adherence to the Repository Pattern using TypeORM.
- A JWT-based authentication strategy using NestJS Guards to validate **Bearer tokens** issued during login.

## Development Workflow

The local development setup process and common npm scripts (`dev`, `build`, `test`) are defined.

## Deployment Architecture

A containerized deployment strategy is defined:

- **Frontend (Next.js)**: Containerized with Docker for consistent deployment.
- **Backend (NestJS)**: Containerized with Docker and deployed to Railway.
- **CI/CD**: Automated via GitHub Actions for linting, testing, and building.
