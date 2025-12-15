# Isntgram Fullstack Architecture Document - Coding Standards

## Coding Standards

Critical, non-negotiable standards are defined, focusing on TypeScript strictness, environment variable handling, error
handling, and immutability.

### TypeScript Standards

- **Strict Mode**: All TypeScript strict flags enabled
- **No contract drift**: Keep DTOs and API responses typed; avoid hand-maintained shared types that drift over time
- **No `any`**: Explicit typing required, no implicit any types
- **Interface over Type**: Prefer interfaces for object shapes
- **Generic Constraints**: Use generic constraints for type safety

### Code Organization

- **Feature-Sliced Architecture**: Organize code by feature rather than technical concerns
- **Co-location**: Tests, types, and utilities co-located with source code
- **Barrel Exports**: Use index files for clean imports
- **Consistent Naming**: Follow established naming conventions

### Error Handling

- **Global Exception Filter**: Backend uses global exception filter for consistent error responses
- **API Client Interceptor**: Frontend uses API client interceptor for error handling
- **User-Friendly Messages**: All errors must be user-friendly and actionable
- **Logging**: Proper error logging for debugging

### Environment Variables

- **Validation**: All environment variables must be validated at startup
- **Type Safety**: Environment variables must be typed
- **Documentation**: All environment variables must be documented
- **Defaults**: Sensible defaults for development

### Immutability

- **No Direct Mutations**: Avoid direct object/array mutations
- **Immutable Updates**: Use spread operators or immutable libraries
- **Functional Programming**: Prefer pure functions where possible

### Documentation

- **JSDoc**: All public APIs must have JSDoc comments
- **README Files**: Each package must have a README
- **Code Comments**: Complex logic must be commented
- **Architecture Decisions**: Document significant architectural decisions
