# CI Testing Guide

This guide covers how to test your CI/CD pipeline locally using industry-standard tools, ensuring your GitHub Actions
workflow is robust before pushing to production.

## Why Test CI Locally?

- **Catch Issues Early**: Find problems before they reach GitHub
- **Faster Feedback**: No need to wait for GitHub Actions to run
- **Cost Effective**: Avoid wasting GitHub Actions minutes on broken workflows
- **Professional Practice**: Industry standard for robust CI/CD

## Available Testing Tools

### 1. **Act** - Run GitHub Actions Locally ⭐

The most important tool for testing GitHub Actions workflows locally.

```bash
# Install
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# List available jobs
act --list

# Run a specific job
act -j quality
act -j integration
act -j e2e

# Dry run (see what would happen)
act -j quality --dryrun

# Run with specific event
act push
act pull_request
```

**Benefits:**

- Runs your actual workflow in Docker containers
- Tests the complete pipeline locally
- Identifies environment and dependency issues

### 2. **Actionlint** - GitHub Actions Linter

Static analysis tool for GitHub Actions workflows.

```bash
# Install
go install github.com/rhysd/actionlint/cmd/actionlint@latest

# Lint your workflow
actionlint .github/workflows/ci.yml

# Lint all workflows
actionlint .github/workflows/
```

**Benefits:**

- Catches syntax errors
- Validates action versions
- Checks for security issues
- Identifies best practices violations

### 3. **Yamllint** - YAML Syntax Validation

Validates YAML syntax and formatting.

```bash
# Install
pip install yamllint

# Validate workflow
yamllint .github/workflows/ci.yml

# Validate with custom rules
yamllint -c .yamllint .github/workflows/ci.yml
```

**Benefits:**

- Ensures valid YAML syntax
- Enforces consistent formatting
- Catches indentation errors

## Our CI Testing Scripts

### Basic Validation (`npm run test:ci`)

Our custom validation script that checks:

- Workflow structure
- Job dependencies
- NPM script existence
- Coverage path consistency
- Docker command validation
- Environment variable validation

### Professional Testing (`npm run test:ci:pro`)

Industry-standard testing using professional tools:

- YAML syntax validation (yamllint)
- GitHub Actions linting (actionlint)
- Workflow execution testing (act)
- Coverage workflow simulation

## Installation Guide

### Quick Setup (macOS)

```bash
# Install all tools
brew install act
go install github.com/rhysd/actionlint/cmd/actionlint@latest
pip install yamllint

# Verify installation
act --version
actionlint --version
yamllint --version
```

### Manual Installation

```bash
# Act (GitHub Actions local runner)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Actionlint (GitHub Actions linter)
go install github.com/rhysd/actionlint/cmd/actionlint@latest

# Yamllint (YAML validator)
pip install yamllint
```

## Usage Examples

### 1. Test Your Workflow Locally

```bash
# See what jobs are available
act --list

# Test the quality job
act -j quality

# Test integration with database
act -j integration

# Dry run to see what would happen
act -j e2e --dryrun
```

### 2. Validate Workflow Syntax

```bash
# Lint your workflow
actionlint .github/workflows/ci.yml

# Validate YAML syntax
yamllint .github/workflows/ci.yml
```

### 3. Run Our Testing Scripts

```bash
# Basic validation
npm run test:ci

# Professional testing (with industry tools)
npm run test:ci:pro
```

## Common Issues and Solutions

### Issue: Act can't find Docker

```bash
# Make sure Docker is running
docker --version
docker ps

# If Docker isn't installed
brew install --cask docker
```

### Issue: Actionlint not found

```bash
# Add Go bin to PATH
export PATH=$PATH:$(go env GOPATH)/bin

# Or install globally
sudo go install github.com/rhysd/actionlint/cmd/actionlint@latest
```

### Issue: Yamllint not found

```bash
# Install with pip3
pip3 install yamllint

# Or use system package manager
brew install yamllint  # macOS
```

## Best Practices

### 1. Test Before Every Push

```bash
# Quick validation
npm run test:ci

# Full testing (if tools are installed)
npm run test:ci:pro
```

### 2. Use Act for Complex Workflows

```bash
# Test jobs that depend on services
act -j integration

# Test with specific environment variables
act -j quality --env-file .env.test
```

### 3. Validate Syntax Regularly

```bash
# Add to your pre-commit hooks
actionlint .github/workflows/
yamllint .github/workflows/
```

### 4. Test Coverage Workflow

```bash
# Our script automatically tests this
npm run test:ci

# Or test manually
mkdir -p coverage apps/web/coverage apps/api/coverage packages/shared-types/coverage
tar -czf coverage-artifacts.tgz coverage/ apps/web/coverage apps/api/coverage packages/shared-types/coverage
```

## Integration with Development Workflow

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run test:ci
```

### CI Validation in CI

Add to your workflow to validate itself:

```yaml
- name: Validate CI Workflow
  run: |
    npm run test:ci
    if command -v actionlint >/dev/null 2>&1; then
      actionlint .github/workflows/ci.yml
    fi
```

## Troubleshooting

### Act Issues

```bash
# Check Docker
docker ps

# Use specific image
act -j quality --container-architecture linux/amd64

# Verbose output
act -j quality -v
```

### Actionlint Issues

```bash
# Check Go installation
go version

# Reinstall actionlint
go clean -i github.com/rhysd/actionlint/cmd/actionlint
go install github.com/rhysd/actionlint/cmd/actionlint@latest
```

### Yamllint Issues

```bash
# Check Python installation
python3 --version

# Reinstall yamllint
pip3 uninstall yamllint
pip3 install yamllint
```

## Resources

- [Act Documentation](https://github.com/nektos/act)
- [Actionlint Documentation](https://github.com/rhysd/actionlint)
- [Yamllint Documentation](https://yamllint.readthedocs.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Summary

By using these industry-standard tools, you can:

- ✅ Test your CI workflow locally
- ✅ Catch syntax and logic errors early
- ✅ Validate best practices
- ✅ Ensure robust CI/CD pipelines
- ✅ Save time and resources

This approach is used by companies like Google, Microsoft, Netflix, and many others to ensure their CI/CD pipelines are
reliable and efficient.
