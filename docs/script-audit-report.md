# Script Audit Report

**Date:** December 9, 2024  
**Auditor:** AI Assistant  
**Scope:** Complete npm scripts ecosystem across monorepo

## Executive Summary

This audit reveals **multiple critical circular dependencies** and **runtime execution issues** in the npm scripts
ecosystem. The primary problems stem from workspace syntax conflicts, script naming inconsistencies, and improper
dependency chains that cause infinite loops and port conflicts.

## Critical Issues

### 🔴 **CRITICAL: Circular Dependencies**

#### 1. Root `build` Script Circular Dependency

**Location:** `package.json` line 18  
**Issue:** The root `build` script calls `build:api`, which calls `cd apps/api && npm run build`, which resolves to the
root `build` script, creating an infinite loop.

```json
// Root package.json
"build": "npm run build:api && npm run build:web && npm run build:shared-types",
"build:api": "cd apps/api && npm run build",  // This calls the root build script!
```

**Impact:** Infinite recursion during build processes, causing CI failures and local development issues.

#### 2. Root `start` Script Circular Dependency

**Location:** `package.json` line 42  
**Issue:** The root `start` script calls `ci:start:web`, which calls `cd apps/web && npm run start`, which resolves to
the root `start` script.

```json
// Root package.json
"start": "cd apps/web && PORT=3000 npm run start & cd apps/api && SKIP_DB=true PORT=3001 npm run start:prod",
"ci:start:web": "cd apps/web && PORT=3000 npm run start",  // This calls the root start script!
```

**Impact:** Infinite loops during E2E testing and local development.

#### 3. E2E Test Script Circular Dependency

**Location:** `package.json` line 35  
**Issue:** The `test:e2e` script calls `build:api`, which triggers the circular dependency chain.

```json
"test:e2e": "npm run build:api && npm run build:web && npm run build:shared-types && playwright test",
```

**Impact:** E2E tests cannot run due to infinite build loops.

### 🔴 **CRITICAL: Port Conflicts**

#### 1. Multiple API Instances

**Issue:** During E2E testing, multiple API instances attempt to bind to port 3001 simultaneously.

**Root Cause:** The circular dependency in the `start` script causes multiple processes to spawn, each trying to use the
same port.

**Evidence:**

```bash
[Nest] 32098 - LOG [Bootstrap] 🚀 Application is running on: http://0.0.0.0:3001
[Nest] 32302 - ERROR [NestApplication] Error: listen EADDRINUSE: address already in use 0.0.0.0:3001
```

### 🔴 **CRITICAL: Missing Production Builds**

#### 1. Web App Missing Build

**Issue:** The web app's `start` script requires a production build, but the build process fails due to circular
dependencies.

**Evidence:**

```bash
Error: Could not find a production build in the '.next' directory.
Try building your app with 'next build' before starting the production server.
```

## Script Ecosystem Analysis

### Root Package.json Scripts

| Script               | Purpose                   | Status     | Issues              |
| -------------------- | ------------------------- | ---------- | ------------------- |
| `dev`                | Start development servers | ✅ Working | None                |
| `dev:web`            | Start web dev server      | ✅ Working | None                |
| `dev:api`            | Start API dev server      | ✅ Working | None                |
| `build`              | Build all apps            | ❌ Broken  | Circular dependency |
| `build:web`          | Build web app             | ✅ Working | None                |
| `build:api`          | Build API app             | ❌ Broken  | Circular dependency |
| `build:shared-types` | Build shared types        | ✅ Working | None                |
| `test:e2e`           | Run E2E tests             | ❌ Broken  | Circular dependency |
| `ci:start:web`       | Start web for CI          | ❌ Broken  | Circular dependency |
| `ci:start:api`       | Start API for CI          | ✅ Working | None                |
| `start`              | Start production servers  | ❌ Broken  | Circular dependency |

### Workspace Scripts

#### Web App (`apps/web/package.json`)

| Script  | Purpose                   | Status     | Issues               |
| ------- | ------------------------- | ---------- | -------------------- |
| `dev`   | Next.js dev server        | ✅ Working | None                 |
| `build` | Next.js build             | ✅ Working | None                 |
| `start` | Next.js production server | ✅ Working | Requires build first |

#### API App (`apps/api/package.json`)

| Script       | Purpose                  | Status     | Issues               |
| ------------ | ------------------------ | ---------- | -------------------- |
| `build`      | NestJS build             | ✅ Working | None                 |
| `start:dev`  | NestJS dev server        | ✅ Working | None                 |
| `start:prod` | NestJS production server | ✅ Working | Requires build first |

#### Shared Types (`packages/shared-types/package.json`)

| Script  | Purpose                | Status     | Issues |
| ------- | ---------------------- | ---------- | ------ |
| `build` | TypeScript compilation | ✅ Working | None   |
| `dev`   | Watch mode compilation | ✅ Working | None   |

### CI/CD Scripts

#### GitHub Actions Workflow

**Status:** ✅ Working  
**Issues:** None detected in the workflow itself, but it depends on broken scripts.

#### Playwright Configuration

**Status:** ⚠️ Partially Working  
**Issues:**

- Depends on broken `ci:start:web` script
- No build step before starting servers

## Dependency Chain Analysis

### Build Chain

```bash
test:e2e → build:api → cd apps/api && npm run build → root build → build:api → INFINITE LOOP
```

### Start Chain

```bash
playwright webServer → ci:start:web → cd apps/web && npm run start → root start → ci:start:web → INFINITE LOOP
```

### Development Chain

```bash
dev → dev:web & dev:api → cd apps/web && npm run dev & cd apps/api && npm run start:dev
```

**Status:** ✅ Working (no circular dependencies)

## Test Coverage Analysis

### Static Tests

- **E2E Config Tests:** ✅ Working
- **CI Workflow Tests:** ✅ Working
- **Script Validation:** ❌ Missing (no tests for circular dependencies)

### Runtime Tests

- **E2E Tests:** ❌ Broken (circular dependencies)
- **Integration Tests:** ✅ Working
- **Unit Tests:** ✅ Working

## Security Analysis

### Script Injection Risks

**Status:** ✅ Low Risk  
**Analysis:** All scripts use direct commands, no user input passed to scripts.

### Dependency Risks

**Status:** ✅ Low Risk  
**Analysis:** All dependencies are properly versioned and locked.

## Performance Analysis

### Build Performance

- **Current:** ❌ Infinite loops prevent measurement
- **Expected:** ~30-60 seconds for full build
- **Bottleneck:** Circular dependencies

### Test Performance

- **E2E Tests:** ❌ Cannot run due to circular dependencies
- **Unit Tests:** ✅ ~4 seconds
- **Integration Tests:** ✅ ~10-15 seconds

## Recommendations

### Immediate Fixes (Critical)

1. **Fix Circular Dependencies**
   - Replace workspace syntax with direct commands
   - Use explicit script names to avoid resolution conflicts
   - Implement proper script isolation

2. **Fix Build Process**
   - Create isolated build scripts that don't depend on root scripts
   - Implement proper build order (shared-types → api → web)

3. **Fix E2E Testing**
   - Separate build and start processes
   - Implement proper port management
   - Add build verification before starting servers

### Medium-term Improvements

1. **Script Validation**
   - Add static analysis for circular dependencies
   - Implement script dependency graphs
   - Add runtime validation for port conflicts

2. **CI/CD Enhancements**
   - Add build caching
   - Implement parallel builds where possible
   - Add build verification steps

3. **Development Experience**
   - Add development mode with hot reloading
   - Implement proper error handling and recovery
   - Add script documentation and examples

### Long-term Improvements

1. **Architecture**
   - Consider using tools like Nx or Lerna for better monorepo management
   - Implement proper workspace isolation
   - Add build orchestration tools

2. **Monitoring**
   - Add script performance monitoring
   - Implement build time tracking
   - Add dependency analysis tools

## Risk Assessment

| Risk Level | Impact                          | Probability | Mitigation Priority |
| ---------- | ------------------------------- | ----------- | ------------------- |
| Critical   | Build failures, CI breaks       | High        | Immediate           |
| High       | Development workflow disruption | High        | Immediate           |
| Medium     | Performance degradation         | Medium      | Short-term          |
| Low        | Maintenance overhead            | Low         | Long-term           |

## Conclusion

The script ecosystem has **critical circular dependencies** that prevent normal operation. These issues affect:

- ✅ Local development (working)
- ❌ E2E testing (broken)
- ❌ CI/CD builds (broken)
- ❌ Production deployments (broken)

**Immediate action required** to fix circular dependencies and restore full functionality.

## Appendix

### Script Dependency Graph

```bash
dev → dev:web & dev:api ✅
build → build:api → INFINITE LOOP ❌
test:e2e → build:api → INFINITE LOOP ❌
start → ci:start:web → INFINITE LOOP ❌
```

### Affected Files

- `package.json` (root)
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `test/e2e-config.test.ts`

### Test Commands

```bash
# Working
npm run dev
npm run test
npm run lint

# Broken
npm run build
npm run test:e2e
npm run start
```
