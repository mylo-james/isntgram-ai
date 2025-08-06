# Isntgram Fullstack Architecture Document - Database Schema

## Database Schema

The DDL for PostgreSQL has been defined, including tables for users, posts, comments, likes, and follows. The schema is optimized with denormalized columns for `posts_count`, `follower_count`, `following_count`, `likes_count`, and `comments_count` to ensure high-performance reads. Indexes are specified on all foreign keys and frequently queried columns.

### Key Schema Features

- **Denormalized Counts**: For performance optimization, we store computed counts directly in the parent tables
- **Optimized Indexes**: Strategic indexing on foreign keys and frequently queried columns
- **Referential Integrity**: Proper foreign key constraints to maintain data consistency
- **Audit Fields**: Standard `created_at` and `updated_at` timestamps on all tables
- **Soft Deletes**: Where appropriate, soft delete patterns for data preservation

### Table Structure

The database includes the following core tables:

1. **users** - User accounts and profiles
2. **posts** - Image posts with captions
3. **comments** - User comments on posts
4. **likes** - Polymorphic likes on posts and comments
5. **follows** - Many-to-many user following relationships

### Performance Optimizations

- Denormalized count columns to avoid expensive JOIN operations
- Composite indexes for common query patterns
- Partitioning strategy for high-volume tables (future consideration)
- Connection pooling for efficient database connections
