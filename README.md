# Isntgram AI

An AI-powered social media platform built with Next.js, NestJS, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop
- Git

### Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd isntgram-ai
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the database**

   ```bash
   npm run db:start
   ```

4. **Set up environment variables**

   ```bash
   # Copy API environment file
   cp apps/api/env.example apps/api/.env

   # Copy web environment file (if needed)
   cp apps/web/.env.example apps/web/.env.local
   ```

5. **Run database migrations**

   ```bash
   cd apps/api
   npm run migration:run
   ```

6. **Start development servers**

   ```bash
   # Start both frontend and backend
   npm run dev

   # Or start them separately
   npm run dev:web  # Frontend on http://localhost:3000
   npm run dev:api  # Backend on http://localhost:3001
   ```

## 🗄️ Database Setup

### Local Development

The project uses Docker Compose to run PostgreSQL locally:

```bash
# Start database
npm run db:start

# Stop database
npm run db:stop

# View database logs
npm run db:logs

# Reset database (removes all data)
npm run db:reset
```

### Database Commands

```bash
# Run migrations
cd apps/api && npm run migration:run

# Generate new migration
cd apps/api && npm run migration:generate -- -n MigrationName

# Revert last migration
cd apps/api && npm run migration:revert
```

## 🧪 Testing

### Unit Tests

```bash
npm test                    # Run all tests
npm run test:web           # Frontend tests only
npm run test:api           # Backend tests only
```

### E2E Tests

```bash
npm run test:e2e           # Run E2E tests
npm run test:e2e:headed    # Run with browser visible
npm run test:e2e:ui        # Run with Playwright UI
```

### Integration Tests

```bash
npm run test:api           # Includes integration tests
```

## 🔧 Development

### Code Quality

```bash
npm run lint               # Run all linters
npm run format             # Format all code
npm run type-check         # TypeScript type checking
```

### Database Management

```bash
npm run db:start           # Start PostgreSQL
npm run db:stop            # Stop PostgreSQL
npm run db:logs            # View database logs
npm run db:reset           # Reset database
```

## 📁 Project Structure

```bash
isntgram-ai/
├── apps/
│   ├── api/              # NestJS backend
│   └── web/              # Next.js frontend
├── packages/
│   └── shared-types/     # Shared TypeScript types
├── docs/                 # Documentation
├── e2e/                  # End-to-end tests
└── scripts/              # Development scripts
```

## 🚀 Deployment

### Environment Variables

Copy the example environment files and configure them:

```bash
# Backend
cp apps/api/env.example apps/api/.env

# Frontend
cp apps/web/.env.example apps/web/.env.local
```

### Production Build

```bash
npm run build
```

## 🐛 Troubleshooting

### Database Connection Issues

1. **Docker not running**: Start Docker Desktop
2. **Port already in use**: Stop other PostgreSQL instances
3. **Permission denied**: Run `chmod +x scripts/dev-db.sh`

### Test Failures

1. **Integration tests failing**: Ensure database is running
2. **E2E tests failing**: Check if both frontend and backend are running
3. **Unit tests failing**: Check for TypeScript errors

### Common Issues

- **"Database connection failed"**: Run `npm run db:start`
- **"Port 3000/3001 in use"**: Kill existing processes or change ports
- **"TypeScript errors"**: Run `npm run type-check` to see issues

## 📚 Documentation

- [Architecture Documentation](./docs/architecture/)
- [Product Requirements](./docs/prd/)
- [User Stories](./docs/stories/)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Run linting: `npm run lint`
5. Commit with proper message
6. Create a pull request

## 📄 License

This project is licensed under the MIT License.
