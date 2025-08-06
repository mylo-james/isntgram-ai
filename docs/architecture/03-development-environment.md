# Development Environment

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Git

## AI Development Tools

### BMAD Method

This project uses BMAD Method for AI-assisted development. Install it globally:

```bash
npx bmad-method install
```

This provides AI agents and workflows for:

- Story development and refinement
- Architecture planning
- Code generation assistance
- Documentation generation
- Testing strategy

**Note**: BMAD Method is used via `npx` and doesn't need to be added to `package.json` dependencies.

## Technology Stack

### Frontend Stack

- **Next.js 14.x** with TypeScript 5.x
- **Tailwind CSS 3.x** for styling
- **Shadcn/ui** component library
- **Redux Toolkit 2.x** for state management
- **Jest + React Testing Library** for testing

### Backend Stack

- **NestJS 10.x** with TypeScript 5.x
- **PostgreSQL 16.x** database
- **TypeORM** for database connectivity
- **Jest** for testing
- **Auth.js (NextAuth) 5.x** for authentication

### Development Tools

- **ESLint 9.x** for code quality
- **Prettier 3.x** for code formatting
- **Husky 9.x** for Git hooks
- **lint-staged 15.x** for pre-commit checks
- **markdownlint-cli** for documentation standards

## Setup Instructions

1. Clone the repository
2. Install dependencies: `npm install`
3. Install BMAD Method: `npx bmad-method install`
4. Start development servers: `npm run dev`

## Development Workflow

- **Frontend Development**: `npm run dev:web`
- **Backend Development**: `npm run dev:api`
- **Testing**: `npm test`
- **Building**: `npm run build`
- **Linting**: `npm run lint`
- **Formatting**: `npm run format`
