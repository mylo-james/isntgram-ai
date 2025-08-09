# Defect: Critical Circular Dependencies in NPM Scripts Ecosystem

**Story ID:** DEF-001  
**Type:** Defect  
**Priority:** Critical  
**Status:** Open  
**Created:** December 9, 2024  
**Assigned:** Development Team

## 🚨 **Summary**

Critical circular dependencies in the npm scripts ecosystem are preventing E2E testing, CI/CD builds, and production
deployments. The root cause is workspace script resolution conflicts that create infinite loops.

## 📋 **Acceptance Criteria**

### Must Have

- [ ] E2E tests can run without infinite loops
- [ ] CI/CD pipeline builds successfully
- [ ] Production builds complete without circular dependencies
- [ ] Local development remains functional
- [ ] All script dependencies are properly isolated

### Should Have

- [ ] Build performance is optimized (target: <60 seconds)
- [ ] Script validation prevents future circular dependencies
- [ ] Clear documentation of script dependencies

### Could Have

- [ ] Parallel build execution where possible
- [ ] Build caching for faster subsequent builds
- [ ] Script performance monitoring

## 🔍 **Problem Description**

### Current Behavior

1. **Infinite Loops**: Running `npm run build`, `npm run test:e2e`, or `npm run start` causes infinite recursion
2. **Port Conflicts**: Multiple API instances attempt to bind to port 3001 simultaneously
3. **CI Failures**: GitHub Actions builds fail due to circular dependencies
4. **Missing Builds**: Production builds cannot complete, preventing deployments

### Expected Behavior

1. **Clean Builds**: All build scripts complete successfully in <60 seconds
2. **E2E Testing**: Playwright tests run with proper server startup
3. **CI Success**: GitHub Actions pipeline completes all jobs
4. **Production Ready**: Apps can be built and started for production

## 🎯 **Root Cause Analysis**

### Primary Issue: Workspace Script Resolution

When using `cd apps/api && npm run build`, npm resolves `build` to the root workspace's `build` script instead of the
local one, creating infinite loops.

### Affected Scripts

1. **Root `build`**: `npm run build:api && npm run build:web && npm run build:shared-types`
2. **Root `start`**: `cd apps/web && PORT=3000 npm run start & cd apps/api && SKIP_DB=true PORT=3001 npm run start:prod`
3. **`test:e2e`**: `npm run build:api && npm run build:web && npm run build:shared-types && playwright test`
4. **`ci:start:web`**: `cd apps/web && PORT=3000 npm run start`

### Dependency Chains

```bash
test:e2e → build:api → cd apps/api && npm run build → root build → build:api → INFINITE LOOP
playwright webServer → ci:start:web → cd apps/web && npm run start → root start → ci:start:web → INFINITE LOOP
```

## 🛠️ **Technical Solution**

### Approach 1: Direct Command Execution (Recommended)

Replace workspace script calls with direct command execution to avoid resolution conflicts.

**Before:**

```json
"build:api": "cd apps/api && npm run build"
```

**After:**

```json
"build:api": "cd apps/api && npx nest build"
```

### Approach 2: Explicit Script Names

Use explicit script names that don't conflict with root workspace scripts.

**Before:**

```json
"build:api": "cd apps/api && npm run build"
```

**After:**

```json
"build:api": "cd apps/api && npm run build:local"
```

### Approach 3: Workspace Isolation

Implement proper workspace isolation using npm workspace commands.

**Before:**

```json
"build:api": "cd apps/api && npm run build"
```

**After:**

```json
"build:api": "npm run build --workspace=apps/api"
```

## 📝 **Implementation Plan**

### Phase 1: Fix Critical Scripts (Immediate)

1. **Fix `build:api` script**
   - Replace `npm run build` with `npx nest build`
   - Test build completion

2. **Fix `ci:start:web` script**
   - Replace `npm run start` with `npx next start`
   - Test E2E startup

3. **Fix root `start` script**
   - Use direct commands instead of script references
   - Test production startup

### Phase 2: Fix E2E Testing (High Priority)

1. **Update `test:e2e` script**
   - Ensure proper build order
   - Add build verification

2. **Update Playwright config**
   - Fix webServer commands
   - Add proper error handling

### Phase 3: CI/CD Fixes (High Priority)

1. **Update GitHub Actions**
   - Ensure build steps work
   - Add build verification

2. **Add script validation**
   - Prevent future circular dependencies
   - Add automated testing

### Phase 4: Optimization (Medium Priority)

1. **Performance improvements**
   - Parallel builds where possible
   - Build caching

2. **Documentation**
   - Script dependency documentation
   - Troubleshooting guide

## 🧪 **Testing Strategy**

### Unit Testing

- [ ] Test individual script execution
- [ ] Verify no circular dependencies
- [ ] Check script isolation

### Integration Testing

- [ ] Test build process end-to-end
- [ ] Verify E2E test execution
- [ ] Check CI/CD pipeline

### Manual Testing

- [ ] Local development workflow
- [ ] Production build and start
- [ ] E2E test execution

## 📊 **Success Metrics**

### Primary Metrics

- [ ] **Build Success Rate**: 100% (currently 0%)
- [ ] **E2E Test Success Rate**: 100% (currently 0%)
- [ ] **CI Pipeline Success Rate**: 100% (currently 0%)

### Secondary Metrics

- [ ] **Build Time**: <60 seconds (currently infinite)
- [ ] **E2E Test Time**: <5 minutes (currently infinite)
- [ ] **Development Setup Time**: <2 minutes (currently working)

## 🚧 **Blockers & Dependencies**

### Current Blockers

- None (self-contained fix)

### Dependencies

- None (no external dependencies)

## 💰 **Effort Estimation**

### Story Points: 8 (High)

- **Analysis**: 1 point
- **Implementation**: 4 points
- **Testing**: 2 points
- **Documentation**: 1 point

### Time Estimate: 2-3 days

- **Day 1**: Fix critical scripts and test locally
- **Day 2**: Fix E2E testing and CI/CD
- **Day 3**: Optimization and documentation

## 🔗 **Related Stories**

- **Epic**: [Epic 1.2a - Docker Containerization Enhancement](../prd/06-epic-1-foundation.md)
- **Dependency**: This defect blocks E2E testing for all future stories
- **Impact**: Affects CI/CD pipeline for all branches

## 📚 **References**

- [Script Audit Report](./script-audit-report.md)
- [CI Workflow Configuration](../../.github/workflows/ci.yml)
- [Playwright Configuration](../../playwright.config.ts)
- [Root Package.json](../../package.json)

## 🏷️ **Labels**

- `defect`
- `critical`
- `scripts`
- `circular-dependency`
- `e2e-testing`
- `ci-cd`
- `build-system`

## 📝 **Notes**

### Investigation Findings

- Development scripts (`dev`, `dev:web`, `dev:api`) work correctly
- Individual workspace builds work when called directly
- Issue is specifically with workspace script resolution

### Risk Mitigation

- Keep development scripts unchanged (they work)
- Test each fix incrementally
- Maintain backward compatibility where possible

### Future Prevention

- Add script dependency validation
- Implement automated circular dependency detection
- Create script documentation standards
