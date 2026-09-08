'use strict';

require('reflect-metadata');

const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const { DataSource } = require('typeorm');
const config = require('../scripts/v1/config.cjs');
const preflight = require('../scripts/v1/preflight.cjs');

const TEST_TIMEOUT_MS = 10_000;
const SCHEMA_PREFIX = 'v1_migration_';
const APPLICATION_TABLES = [
  'users',
  'posts',
  'follows',
  'likes',
  'comments',
  'comment_likes',
  'notifications',
  'media_uploads',
];
const PRE_TARGET_APPLICATION_TABLES = APPLICATION_TABLES.filter(
  (table) => table !== 'media_uploads',
);
const DIST_MIGRATIONS = path.join(__dirname, '../dist/migrations/*.js');
const TARGET_MIGRATION = require('../dist/migrations/1788829200000-AddV1MediaAndNotificationIdentity');
const { AddV1MediaAndNotificationIdentity1788829200000 } = TARGET_MIGRATION;

const PRE_TARGET_MIGRATION_FILES = [
  '1703123456789-CreateUsersTable',
  '1703123456790-CreatePostsAndFollows',
  '1703123456791-AddTokenVersionToUsers',
  '1766347800000-AddDemoUserFields',
  '1766348400000-AddLikesAndComments',
  '1766349000000-AddFollowCompositeIndexes',
  '1766350200000-AddNotifications',
  '1766350800000-AddCommentLikes',
  '1766351400000-UseTimestamptzForDates',
];

const PRE_TARGET_MIGRATIONS = PRE_TARGET_MIGRATION_FILES.flatMap((file) =>
  Object.values(require(`../dist/migrations/${file}`)),
).filter((candidate) => typeof candidate === 'function');

function assertProductionEnvironment() {
  assert.equal(
    process.env.NODE_ENV,
    'production',
    'v1 PostgreSQL migration tests require NODE_ENV=production',
  );
}

function newSchemaName() {
  const schema = `${SCHEMA_PREFIX}${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^v1_migration_[0-9a-f]{32}$/);
  return schema;
}

function quoteIdentifier(identifier) {
  assert.match(identifier, /^v1_migration_[0-9a-f]{32}$/);
  return `"${identifier}"`;
}

function migrationDataSource(c, schema, migrations) {
  assert.match(schema, /^v1_migration_[0-9a-f]{32}$/);
  const database = config.database(c, 'test');
  return new DataSource({
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.user,
    password: database.password,
    database: database.database,
    schema,
    synchronize: false,
    logging: false,
    migrations,
    extra: {
      options: `-c search_path=${schema},pg_catalog`,
      statement_timeout: 5000,
      lock_timeout: 5000,
    },
  });
}

async function createOwnedSchema(c, schema) {
  const client = await preflight.connect(c, 'test');
  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_namespace WHERE nspname = $1',
      [schema],
    );
    assert.equal(existing.rowCount, 0, 'fresh migration schema already exists');
    await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  } finally {
    await client.end();
  }
}

async function publicExtensionSnapshot(c) {
  const client = await preflight.connect(c, 'test');
  try {
    const extensions = await client.query(
      `SELECT extension.extname AS name,
              extension.extversion AS version,
              namespace.nspname AS namespace,
              pg_get_userbyid(extension.extowner) AS owner
       FROM pg_extension extension
       INNER JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
       WHERE extension.extname = 'pgcrypto'`,
    );
    assert.equal(
      extensions.rowCount,
      1,
      'pgcrypto must already exist before migration proof',
    );
    assert.equal(
      extensions.rows[0].namespace,
      'public',
      'pgcrypto must remain in the approved public extension namespace',
    );

    const publicSchema = await client.query(
      `SELECT namespace.nspname AS name,
              pg_get_userbyid(namespace.nspowner) AS owner,
              COALESCE(namespace.nspacl::text, '') AS acl
       FROM pg_namespace namespace
       WHERE namespace.nspname = 'public'`,
    );
    assert.equal(publicSchema.rowCount, 1, 'public schema is unavailable');

    const relations = await client.query(
      `SELECT class.relkind AS kind,
              class.relname AS name,
              pg_get_userbyid(class.relowner) AS owner
       FROM pg_class class
       INNER JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
       WHERE namespace.nspname = 'public'
         AND class.relkind IN ('r', 'v', 'm', 'S', 'f')
       ORDER BY class.relkind, class.relname`,
    );
    const functions = await client.query(
      `SELECT procedure.proname AS name,
              pg_get_function_identity_arguments(procedure.oid) AS identity,
              pg_get_userbyid(procedure.proowner) AS owner
       FROM pg_proc procedure
       INNER JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = 'public'
       ORDER BY procedure.proname, pg_get_function_identity_arguments(procedure.oid)`,
    );

    return {
      extension: extensions.rows[0],
      publicSchema: publicSchema.rows[0],
      relations: relations.rows,
      functions: functions.rows,
    };
  } finally {
    await client.end();
  }
}

async function withFreshSchema(callback) {
  assertProductionEnvironment();
  const c = config.load();
  const verified = await preflight.connect(c, 'test');
  await verified.end();
  const publicBefore = await publicExtensionSnapshot(c);
  const schema = newSchemaName();
  await createOwnedSchema(c, schema);
  try {
    return await callback(c, schema);
  } finally {
    const publicAfter = await publicExtensionSnapshot(c);
    assert.deepEqual(
      publicAfter,
      publicBefore,
      'migration proof changed public extension or schema state',
    );
  }
}

async function close(dataSource) {
  if (dataSource?.isInitialized) await dataSource.destroy();
}

async function columnNames(dataSource, schema, table) {
  return (
    await dataSource.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table],
    )
  ).map((row) => row.column_name);
}

function quoteTable(schema, table) {
  assert.match(schema, /^v1_migration_[0-9a-f]{32}$/);
  assert.match(table, /^[a-z_]+$/);
  return `"${schema}"."${table}"`;
}

async function verifySchemaConnection(dataSource, schema, expectedTables) {
  const [settings] = await dataSource.query(
    `SELECT current_schema() AS schema,
            current_setting('search_path') AS search_path,
            current_user AS current_user`,
  );
  assert.equal(settings.schema, schema);
  assert.deepEqual(
    settings.search_path.split(',').map((entry) => entry.trim()),
    [schema, 'pg_catalog'],
  );

  const tables = await dataSource.query(
    `SELECT schemaname, tablename, tableowner
     FROM pg_tables
     WHERE schemaname = $1 AND tablename = ANY($2)
     ORDER BY tablename`,
    [schema, APPLICATION_TABLES],
  );
  assert.deepEqual(
    tables.map((table) => table.schemaname),
    tables.map(() => schema),
  );
  assert.deepEqual(
    tables.map((table) => table.tableowner),
    tables.map(() => settings.current_user),
  );
  if (expectedTables) {
    assert.deepEqual(
      tables.map((table) => table.tablename),
      [...expectedTables].sort(),
    );
  }
}

async function assertApplicationRowsEmpty(dataSource, schema) {
  for (const table of APPLICATION_TABLES) {
    const exists = await dataSource.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, table],
    );
    if (exists.length === 0) continue;
    const [count] = await dataSource.query(
      `SELECT count(*)::int AS count FROM ${quoteTable(schema, table)}`,
    );
    assert.equal(count.count, 0, `${table} must be empty before down proof`);
  }
}

test(
  'up migrates a clean owned schema with media constraints and notification identity',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    await withFreshSchema(async (c, schema) => {
      const dataSource = migrationDataSource(c, schema, [DIST_MIGRATIONS]);
      try {
        await dataSource.initialize();
        await verifySchemaConnection(dataSource, schema);
        await dataSource.runMigrations();
        await verifySchemaConnection(dataSource, schema);

        assert.deepEqual(
          await columnNames(dataSource, schema, 'notifications'),
          [
            'id',
            'recipientId',
            'actorId',
            'type',
            'postId',
            'commentId',
            'readAt',
            'createdAt',
            'updatedAt',
            'sourceId',
          ],
        );
        assert.deepEqual(
          await columnNames(dataSource, schema, 'media_uploads'),
          [
            'id',
            'ownerId',
            'pendingKey',
            'expectedBytes',
            'expectedContentType',
            'createdAt',
            'expiresAt',
            'publishedKey',
            'publishedChecksum',
            'publishedContentType',
            'publishedBytes',
            'postId',
          ],
        );

        const constraints = await dataSource.query(
          `SELECT conname
           FROM pg_constraint
           WHERE connamespace = $1::regnamespace
             AND conname IN (
               'CHK_MEDIA_UPLOADS_EXPECTED_BYTES',
               'CHK_MEDIA_UPLOADS_PUBLISHED_BYTES'
             )
           ORDER BY conname`,
          [schema],
        );
        assert.deepEqual(
          constraints.map((row) => row.conname),
          [
            'CHK_MEDIA_UPLOADS_EXPECTED_BYTES',
            'CHK_MEDIA_UPLOADS_PUBLISHED_BYTES',
          ],
        );
      } finally {
        await close(dataSource);
      }
    });
  },
);

test(
  'up preserves prior notification rows and enforces new unique and foreign-key constraints',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    await withFreshSchema(async (c, schema) => {
      const prior = migrationDataSource(c, schema, PRE_TARGET_MIGRATIONS);
      const recipientId = randomUUID();
      const actorId = randomUUID();
      const sourceId = randomUUID();
      const notificationId = randomUUID();
      let sentinel;
      try {
        await prior.initialize();
        await verifySchemaConnection(prior, schema);
        await prior.runMigrations();
        await verifySchemaConnection(
          prior,
          schema,
          PRE_TARGET_APPLICATION_TABLES,
        );
        await prior.query(
          `INSERT INTO "users" ("id", "username", "fullName", "email", "hashedPassword")
           VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`,
          [
            recipientId,
            `v1_migration_recipient_${schema.slice(-8)}`,
            'Migration Recipient',
            `migration-recipient-${schema.slice(-8)}@example.invalid`,
            'test-only-hash',
            actorId,
            `v1_migration_actor_${schema.slice(-8)}`,
            'Migration Actor',
            `migration-actor-${schema.slice(-8)}@example.invalid`,
            'test-only-hash',
          ],
        );
        await prior.query(
          `INSERT INTO "notifications" ("id", "recipientId", "actorId", "type", "readAt")
           VALUES ($1, $2, $3, 'follow', CURRENT_TIMESTAMP)`,
          [notificationId, recipientId, actorId],
        );
        [sentinel] = await prior.query(
          `SELECT "id", "recipientId", "actorId", "type", "postId", "commentId", "readAt",
                  "createdAt", "updatedAt"
           FROM "notifications" WHERE "id" = $1`,
          [notificationId],
        );
      } finally {
        await close(prior);
      }

      const upgraded = migrationDataSource(c, schema, [DIST_MIGRATIONS]);
      try {
        await upgraded.initialize();
        await verifySchemaConnection(upgraded, schema);
        await upgraded.runMigrations();
        await verifySchemaConnection(upgraded, schema);
        const [preserved] = await upgraded.query(
          `SELECT "id", "recipientId", "actorId", "type", "postId", "commentId", "readAt",
                  "createdAt", "updatedAt", "sourceId"
           FROM "notifications" WHERE "id" = $1`,
          [notificationId],
        );
        assert.deepEqual(preserved, { ...sentinel, sourceId: null });

        await upgraded.query(
          `INSERT INTO "notifications" ("recipientId", "actorId", "type", "sourceId")
           VALUES ($1, $2, 'follow', $3)`,
          [recipientId, actorId, sourceId],
        );
        await assert.rejects(
          upgraded.query(
            `INSERT INTO "notifications" ("recipientId", "actorId", "type", "sourceId")
             VALUES ($1, $2, 'follow', $3)`,
            [recipientId, actorId, sourceId],
          ),
          { code: '23505' },
        );
        await assert.rejects(
          upgraded.query(
            `INSERT INTO "media_uploads" (
              "ownerId", "pendingKey", "expectedBytes", "expectedContentType", "expiresAt"
            ) VALUES ($1, $2, 1, 'image/jpeg', CURRENT_TIMESTAMP)`,
            [randomUUID(), `pending/${randomUUID()}`],
          ),
          { code: '23503' },
        );
        await assert.rejects(
          upgraded.query(
            `INSERT INTO "media_uploads" (
              "ownerId", "pendingKey", "expectedBytes", "expectedContentType", "expiresAt", "postId"
            ) VALUES ($1, $2, 1, 'image/jpeg', CURRENT_TIMESTAMP, $3)`,
            [recipientId, `pending/${randomUUID()}`, randomUUID()],
          ),
          { code: '23503' },
        );
        const postId = randomUUID();
        await upgraded.query(
          `INSERT INTO "posts" ("id", "authorId", "content") VALUES ($1, $2, 'migration post')`,
          [postId, recipientId],
        );
        const pendingKey = `pending/${randomUUID()}`;
        await upgraded.query(
          `INSERT INTO "media_uploads" (
            "ownerId", "pendingKey", "expectedBytes", "expectedContentType", "expiresAt", "postId"
          ) VALUES ($1, $2, 1, 'image/jpeg', CURRENT_TIMESTAMP, $3)`,
          [recipientId, pendingKey, postId],
        );
        await assert.rejects(
          upgraded.query(
            `INSERT INTO "media_uploads" (
              "ownerId", "pendingKey", "expectedBytes", "expectedContentType", "expiresAt"
            ) VALUES ($1, $2, 1, 'image/jpeg', CURRENT_TIMESTAMP)`,
            [recipientId, pendingKey],
          ),
          { code: '23505' },
        );
        await assert.rejects(
          upgraded.query(
            `INSERT INTO "media_uploads" (
              "ownerId", "pendingKey", "expectedBytes", "expectedContentType", "expiresAt", "postId"
            ) VALUES ($1, $2, 1, 'image/jpeg', CURRENT_TIMESTAMP, $3)`,
            [recipientId, `pending/${randomUUID()}`, postId],
          ),
          { code: '23505' },
        );
        for (const bytes of [0, 5_242_881]) {
          await assert.rejects(
            upgraded.query(
              `INSERT INTO "media_uploads" (
                "ownerId", "pendingKey", "expectedBytes", "expectedContentType", "expiresAt"
              ) VALUES ($1, $2, $3, 'image/jpeg', CURRENT_TIMESTAMP)`,
              [recipientId, `pending/${randomUUID()}`, bytes],
            ),
            { code: '23514' },
          );
        }
      } finally {
        await close(upgraded);
      }
    });
  },
);

test(
  'down runs only in a fresh empty owned schema and retains that schema afterward',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    await withFreshSchema(async (c, schema) => {
      const prior = migrationDataSource(c, schema, PRE_TARGET_MIGRATIONS);
      const target = new AddV1MediaAndNotificationIdentity1788829200000();
      let queryRunner;
      try {
        await prior.initialize();
        await verifySchemaConnection(prior, schema);
        await prior.runMigrations();
        await verifySchemaConnection(
          prior,
          schema,
          PRE_TARGET_APPLICATION_TABLES,
        );
        queryRunner = prior.createQueryRunner();
        await queryRunner.connect();
        await target.up(queryRunner);
        await verifySchemaConnection(prior, schema, APPLICATION_TABLES);
        await assertApplicationRowsEmpty(prior, schema);
        await target.down(queryRunner);

        assert.deepEqual(await columnNames(prior, schema, 'media_uploads'), []);
        const notificationColumns = await columnNames(
          prior,
          schema,
          'notifications',
        );
        assert.equal(notificationColumns.includes('sourceId'), false);
      } finally {
        await queryRunner?.release();
        await close(prior);
      }
    });
  },
);
