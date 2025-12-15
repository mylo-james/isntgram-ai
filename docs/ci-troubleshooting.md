# CI Pipeline Troubleshooting Guide

## Overview

This guide helps diagnose and fix common CI pipeline issues in the Isntgram-ai project.

## Common Issues & Solutions

### 1. Build Failures

#### Symptoms

- `pnpm run build:all` fails
- TypeScript compilation errors
- Missing dependencies

#### Solutions

```bash
# Check for missing dependencies
corepack enable
pnpm install --frozen-lockfile

# Verify TypeScript configuration
pnpm run type-check

# Build everything (matches CI)
pnpm run build:all
```

### 2. Container Health Check Failures

#### Symptoms

- PostgreSQL not ready
- Node.js services not responding
- Container startup timeouts

#### Solutions

```bash
# Check container logs
docker logs ci-container

# Verify PostgreSQL is running
docker exec ci-container pg_isready -U postgres

# Check service health endpoints
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### 3. Test Failures

#### Unit Tests

```bash
# Run unit tests locally
pnpm test --watchAll=false

# Check specific workspace
pnpm test --selectProjects web --watchAll=false
pnpm test --selectProjects api --watchAll=false
```

#### Integration Tests

```bash
# Run with database
pnpm run test:integration

# Check database connection
docker compose ps postgres
```

#### E2E Tests

```bash
# Run Playwright tests
pnpm run test:e2e

# Run with UI
pnpm exec playwright test --ui
```

### 4. Linting & Type Checking Issues

#### Linting

```bash
# Fix auto-fixable issues
pnpm run lint:all

# Check specific workspace
pnpm run lint:web
pnpm run lint:api
```

#### Type Checking

```bash
# Run type checking
pnpm run type-check

# Check specific workspace
pnpm exec tsc -p apps/web/tsconfig.json --noEmit
pnpm exec tsc -p apps/api/tsconfig.json --noEmit
```

## Debugging Steps

### 1. Local Reproduction

```bash
# Build test container locally
docker build -f Dockerfile.test -t isntgram-test .

# Run container
docker run -d --name ci-container \
  -p 3000:3000 -p 3001:3001 -p 5432:5432 \
  isntgram-test

# Execute commands manually
docker exec ci-container corepack enable
docker exec ci-container pnpm install --frozen-lockfile
docker exec ci-container pnpm run build:all
```

### 2. Check Artifacts

After a CI run, download and examine:

- `coverage/` - Test coverage reports
- `test-results/` - Test output
- `playwright-report/` - E2E test reports
- `container-logs.txt` - Container logs

### 3. Environment Variables

Ensure these are set in CI:

```bash
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<set-a-secure-password>
DB_NAME=isntgram_test
```

## Performance Optimization

### 1. Caching

Consider adding these to CI:

```yaml
- name: Cache node_modules
  uses: actions/cache@v3
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
```

### 2. Parallel Jobs

Split into separate jobs:

- Build & Lint
- Unit Tests
- Integration Tests
- E2E Tests

## Monitoring & Alerts

### 1. Set up notifications for

- Build failures
- Test failures
- Security vulnerabilities
- Performance regressions

### 2. Metrics to track

- Build time
- Test execution time
- Failure rate
- Coverage trends

## Best Practices

### 1. Always include

- ✅ Proper error handling
- ✅ Health checks
- ✅ Artifact collection
- ✅ Timeout limits
- ✅ Step IDs for debugging

### 2. Avoid

- ❌ Arbitrary sleep times
- ❌ Missing error reporting
- ❌ No artifact collection
- ❌ No timeout limits

## Emergency Procedures

### 1. If CI is completely broken

1. Check recent changes to CI configuration
2. Verify all dependencies are available
3. Test locally with Docker
4. Rollback to last working commit if necessary

### 2. If tests are flaky

1. Add retry logic for E2E tests
2. Increase timeouts for slow operations
3. Add better error reporting
4. Consider test isolation improvements

## Contact & Support

For CI/CD issues:

1. Check this troubleshooting guide
2. Review GitHub Actions logs
3. Test locally with Docker
4. Create issue with detailed error logs
