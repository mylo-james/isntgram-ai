# Security Vulnerabilities

This document tracks known security vulnerabilities in the project and their mitigation strategies.

## CVE-2024-21538 - cross-spawn Regular Expression Denial of Service

**Status**: Mitigated  
**Severity**: HIGH  
**Affected Package**: cross-spawn  
**Vulnerable Version**: 7.0.3  
**Fixed Version**: 7.0.5, 6.0.6

### Description

A regular expression denial of service vulnerability in the cross-spawn package.

### Impact

- **Development Only**: This vulnerability is only present in development dependencies
- **No Production Impact**: The vulnerable package is not used in production code
- **Limited Exposure**: Only affects Jest test runner during development

### Affected Dependencies

- `jest-changed-files` (Jest 30.0.5)
  - Depends on `execa@5.1.1`
  - Which depends on `cross-spawn@^7.0.3`

### Mitigation Strategy

1. **Package Overrides**: Attempted to force resolution to secure version via npm overrides
2. **Security Scan Exclusion**: Added CVE-2024-21538 to `.trivyignore`
3. **Production Image Scanning**: Updated CI to scan production-optimized Docker image instead of development image
4. **Documentation**: This issue is documented and tracked

### Resolution Plan

- Monitor Jest releases for updates to `jest-changed-files`
- Update Jest when a version with fixed `jest-changed-files` is available
- Consider alternative testing frameworks if the issue persists

### Notes

- This is a known limitation with Jest 30.0.5
- The Jest team is likely working on updating `jest-changed-files`
- The vulnerability is in a nested development dependency and doesn't affect production security
- **Production Security**: The CI pipeline scans a production-optimized Docker image that excludes development dependencies
