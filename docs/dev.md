# Development Workflow Guide

## Git Branching Strategy

### Main Branches

- `main` - Production-ready code
- `develop` - Integration branch for features

### Feature Development

1. **Create Feature Branch**: Always branch from `develop`

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Naming Convention**:
   - `feature/` - New features
   - `bugfix/` - Bug fixes
   - `hotfix/` - Critical production fixes
   - `chore/` - Maintenance tasks

3. **Commit Messages**:

   ```
   type(scope): description

   - feat: New feature
   - fix: Bug fix
   - docs: Documentation changes
   - style: Code style changes
   - refactor: Code refactoring
   - test: Adding tests
   - chore: Maintenance tasks
   ```

## Pull Request Process

### Before Creating PR

1. **Update Documentation**: If your changes affect architecture, update relevant docs
2. **Write Tests**: Ensure all new code has corresponding tests
3. **Self-Review**: Review your own code before submitting
4. **Update Status**: Update project status in `PROJECT_STATUS.md`

### Creating PR

1. **Title Format**: `type: brief description`
2. **Description Template**:

   ```markdown
   ## Changes

   - [ ] Feature A
   - [ ] Bug fix B
   - [ ] Documentation update C

   ## Testing

   - [ ] Unit tests added
   - [ ] Integration tests added
   - [ ] Manual testing completed

   ## Documentation

   - [ ] Code comments added
   - [ ] README updated (if needed)
   - [ ] Architecture docs updated (if needed)

   ## Related Issues

   Closes #123
   ```

### PR Review Process

1. **Code Review**: At least one approval required
2. **CI/CD**: All tests must pass
3. **Documentation**: Ensure docs are updated
4. **Merge**: Squash and merge to `develop`

## Project Status Navigation

### Quick Start for New Developers

1. **Read**: `PROJECT_STATUS.md` - Current state and next steps
2. **Review**: `docs/architecture/README.md` - Technical overview
3. **Check**: `docs/prd/README.md` - Product requirements
4. **Follow**: This workflow guide

### Finding Current Progress

- **Status Dashboard**: `PROJECT_STATUS.md` - Real-time progress
- **Epic Progress**: `docs/prd/10-epic-list.md` - High-level overview
- **Story Status**: Individual story files in `docs/stories/`

### Documentation Navigation

```
docs/
├── PROJECT_STATUS.md          # 🚀 START HERE - Current state
├── DEVELOPMENT_WORKFLOW.md    # This file - Process guide
├── architecture/              # Technical specifications
│   ├── README.md             # Architecture overview
│   └── [specific docs]       # Detailed technical docs
├── prd/                      # Product requirements
│   ├── README.md             # PRD overview
│   └── [specific docs]       # Detailed requirements
└── stories/                  # Individual user stories
    └── [story files]         # Implementation details
```

## Development Environment Setup

### Prerequisites

- Node.js 18+
- Docker
- Git

### Quick Setup

```bash
# Clone repository
git clone <repository-url>
cd Isntgram-ai

# Install dependencies
npm install

# Start development environment
npm run dev

# Run tests
npm test
```

## Quality Assurance

### Before Submitting PR

- [ ] Code follows TypeScript standards
- [ ] All tests pass
- [ ] No linting errors
- [ ] Documentation updated
- [ ] Self-review completed

### Code Review Checklist

- [ ] Code is readable and well-commented
- [ ] Error handling is appropriate
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Tests cover new functionality

## Communication

### Daily Standup

- What you worked on yesterday
- What you're working on today
- Any blockers or questions

### Weekly Review

- Review project status
- Plan next sprint
- Address any architectural decisions

## Emergency Procedures

### Hotfix Process

1. Create hotfix branch from `main`
2. Make minimal required changes
3. Test thoroughly
4. Create PR to `main`
5. After merge, cherry-pick to `develop`

### Rollback Process

1. Identify the problematic commit
2. Create rollback branch
3. Revert changes
4. Test thoroughly
5. Deploy rollback

## Resources

- **Architecture**: `docs/architecture/README.md`
- **Requirements**: `docs/prd/README.md`
- **Status**: `PROJECT_STATUS.md`
- **Stories**: `docs/stories/`

---

**Remember**: Always branch from `develop`, create descriptive PRs, and keep documentation updated!
