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

### Shared Library (`packages/shared-types`)

Contains shared TypeScript types for consistency.

## External APIs

### AWS S3 (Simple Storage Service) API

Used for storing and serving all user-uploaded images via secure pre-signed URLs.

## Core Workflows

Sequence diagrams have been defined for:

- User Registration
- User Login
- Create a New Post (with Secure Image Upload)
- View Personalized Feed
