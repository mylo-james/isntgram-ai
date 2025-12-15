# Isntgram Fullstack Architecture Document - Components

## Components

### Frontend Web App (`apps/web`)

Provides the complete UI, built with Next.js.

### Backend API (`apps/api`)

The central hub for business logic, built with NestJS.

### Authentication Service (Logical)

Manages user sessions and security, powered by Auth.js.

### Database Service (Physical)

Persistent storage using PostgreSQL on Railway.

### Image Storage Service (Physical)

Stores and delivers images using AWS S3.

### Shared Contract (Intentional)

There is no `packages/shared-types` package in the current codebase. The API contract is defined by the NestJS DTOs and
response shapes, and the web app consumes it via the API client.

If we want stronger compile-time guarantees in the future, prefer generating a typed client from OpenAPI/Swagger rather
than maintaining hand-written shared types that can drift.

## External APIs

### AWS S3 (Simple Storage Service) API

Used for storing and serving all user-uploaded images via secure pre-signed URLs.

## Core Workflows

Sequence diagrams have been defined for:

- User Registration
- User Login
- Create a New Post (with Secure Image Upload)
- View Personalized Feed
