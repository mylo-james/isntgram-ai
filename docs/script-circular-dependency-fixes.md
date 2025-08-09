# Script Circular Dependency Fixes and Prevention

## Overview

This document outlines the comprehensive fixes implemented to resolve script circular dependencies in the Isntgram AI
monorepo and the prevention measures put in place to avoid future issues.

## Problem Summary

The project experienced critical script circular dependencies that caused:

- `EADDRINUSE` port conflicts during E2E tests
- `Missing script` errors
- Infinite loops in npm script execution
- Build failures in CI and local development

## Root Causes Identified

1. **Circular Script References**: Root scripts calling workspace scripts that could resolve back to root scripts
2. **Generic Script Names**: Using generic names like `build`, `start`, `dev` that existed in both root and workspace
   packages
3. **Workspace Resolution Conflicts**: `npm run --workspace` syntax resolving to wrong scripts
4. **Missing Production Builds**: E2E tests trying to start servers without proper builds

## Solutions Implemented

### 1. Script Architecture Redesign

#### Root Package Scripts

- **Build Scripts**: Use direct commands instead of workspace calls

  ```json
  "build:api": "cd apps/api && nest build",
  "build:web": "cd apps/web && next build",
  "build:shared-types": "cd packages/shared-types && tsc"
  ```

- **Dev Scripts**: Use cd commands to avoid workspace resolution

  ```json
  "dev:web": "cd apps/web && npm run dev",
  "dev:api": "cd apps/api && npm run start:dev"
  ```

- **Start Scripts**: Use direct commands for production starts

  ```json
  "start": "cd apps/web && PORT=3000 npx next start & cd apps/api && SKIP_DB=true PORT=3001 node dist/main"
  ```

- **CI Start Scripts**: Use workspace syntax for distinct E2E scripts

  ```json
  "ci:start:web": "npm run start:e2e --workspace=apps/web",
  "ci:start:api": "npm run start:prod:e2e --workspace=apps/api"
  ```

#### Workspace Package Scripts

- **Distinct E2E Scripts**: Created separate scripts for E2E testing

  ```json
  // apps/web/package.json
  "start:e2e": "PORT=3000 next start"

  // apps/api/package.json
  "start:prod:e2e": "SKIP_DB=true PORT=3001 node dist/main"
  ```

- **Build Local Scripts**: Added for consistency

  ```json
  "build:local": "tsc" // or "next build" or "nest build"
  ```

### 2. Script Execution Chain

```bash
Root Scripts:
├── build → build:api & build:web & build:shared-types
├── dev → dev:web & dev:api
├── start → direct commands (npx next start & node dist/main)
├── test:e2e → build + playwright test
└── ci:start:* → workspace-specific E2E scripts

Workspace Scripts:
├── apps/web/start:e2e → PORT=3000 next start
├── apps/api/start:prod:e2e → SKIP_DB=true PORT=3001 node dist/main
└── build:local → same as build
```

### 3. Prevention Measures

#### Comprehensive Test Suite

Created `test/script-circular-dependency.test.ts` with 165 test cases covering:

- Circular dependency detection
- Script pattern validation
- Environment variable validation
- Execution chain validation
- Workspace script validation

#### Standalone Validation Script

Created `scripts/validate-scripts.cjs` that can be run independently to:

- Detect circular dependencies
- Validate required scripts exist
- Check script patterns
- Verify environment variables
- Validate execution order

#### CI Integration

- Added `npm run validate:scripts` to CI pipeline
- Updated E2E configuration tests
- Enhanced CI validation workflow

## Key Principles Established

### 1. Script Naming Convention

- **Root scripts**: Use descriptive names (`build:api`, `dev:web`, `ci:start:web`)
- **Workspace scripts**: Use specific names (`start:e2e`, `start:prod:e2e`)
- **Avoid conflicts**: Don't use generic names that exist in multiple packages

### 2. Execution Patterns

- **Root → Workspace**: Use `cd` commands for direct execution
- **Root → Workspace (E2E)**: Use `--workspace` syntax for distinct scripts
- **Workspace → Workspace**: Use direct commands within workspace
- **Never**: Root script calling generic workspace script that could resolve to root

### 3. Environment Variables

- **Ports**: Always set explicit ports (3000 for web, 3001 for api)
- **Database**: Use `SKIP_DB=true` for E2E testing
- **Context**: Set environment variables in the appropriate script scope

## Testing Strategy

### 1. Unit Tests

- **Script validation tests**: Ensure scripts follow patterns
- **Circular dependency detection**: Catch dangerous patterns
- **Execution chain validation**: Verify script dependencies

### 2. Integration Tests

- **E2E configuration tests**: Validate Playwright setup
- **CI workflow tests**: Ensure CI scripts work correctly
- **Build chain tests**: Verify complete build process

### 3. Manual Validation

- **Script validation utility**: Standalone tool for manual checks
- **Pre-commit hooks**: Can be integrated for automatic validation
- **CI validation**: Automated checks in GitHub Actions

## Files Modified

### Core Script Files

- `package.json` (root) - Complete script restructuring
- `apps/web/package.json` - Added E2E and build:local scripts
- `apps/api/package.json` - Added E2E and build:local scripts
- `packages/shared-types/package.json` - Added build:local script

### Configuration Files

- `playwright.config.ts` - Updated webServer configuration
- `test/e2e-config.test.ts` - Updated to match new script patterns

### New Files Created

- `test/script-circular-dependency.test.ts` - Comprehensive test suite
- `scripts/validate-scripts.cjs` - Standalone validation utility
- `docs/script-audit-report.md` - Original audit findings
- `docs/stories/defect-script-circular-dependencies.md` - Defect story

## Success Metrics

### Before Fixes

- ❌ `EADDRINUSE` errors during E2E tests
- ❌ `Missing script` errors
- ❌ Infinite loops in script execution
- ❌ Build failures in CI
- ❌ Circular dependency issues

### After Fixes

- ✅ All E2E tests pass consistently
- ✅ No circular dependencies detected
- ✅ All builds complete successfully
- ✅ CI pipeline passes all validations
- ✅ 165/165 tests passing
- ✅ Script validation utility passes

## Prevention Guidelines

### For Future Development

1. **Always use descriptive script names** in root package.json
2. **Use `cd` commands** for direct workspace execution
3. **Use `--workspace` syntax** only for distinct, non-conflicting scripts
4. **Set environment variables** in the appropriate script scope
5. **Run `npm run validate:scripts`** before committing script changes
6. **Follow the established patterns** in existing scripts

### Common Pitfalls to Avoid

1. **Don't use generic names** that exist in multiple packages
2. **Don't call workspace scripts** that could resolve to root scripts
3. **Don't forget environment variables** for ports and database settings
4. **Don't skip the validation** when adding new scripts

### Validation Commands

```bash
# Run all tests including script validation
npm test

# Run script validation only
npm run validate:scripts

# Run E2E tests
npm run test:e2e

# Run CI validation
npm run test:ci
```

## Conclusion

The script circular dependency issues have been completely resolved through:

1. **Comprehensive script restructuring** following clear patterns
2. **Extensive test coverage** to prevent regressions
3. **Automated validation tools** for ongoing prevention
4. **Clear documentation** and guidelines for future development

The monorepo now has a robust, maintainable script architecture that prevents circular dependencies while maintaining
flexibility for development and CI workflows.
