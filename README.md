# Isntgram-ai

AI-powered social media platform

## Development Workflow

This repository uses a CODEOWNERS file to enable self-review workflow. The repository owner (@mylo-james) is configured as a code owner for all files, allowing them to approve their own pull requests.

### Branch Protection Rules

- Requires 1 approving review
- Requires review from code owners
- Dismisses stale reviews when new commits are pushed
- Prevents direct pushes to main branch

## Project Structure

```
/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   └── shared-types/ # Shared TypeScript types
└── docs/             # Documentation
```
