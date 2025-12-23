import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentLikes1766350800000 implements MigrationInterface {
  name = 'AddCommentLikes1766350800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "comments" ADD "likeCount" integer NOT NULL DEFAULT 0',
    );

    await queryRunner.query(`
      CREATE TABLE "comment_likes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "commentId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_comment_likes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_comment_likes_comment_user" UNIQUE ("commentId", "userId")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_COMMENT_LIKES_COMMENT_CREATED" ON "comment_likes" ("commentId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_COMMENT_LIKES_USER_CREATED" ON "comment_likes" ("userId", "createdAt")',
    );

    await queryRunner.query(`
      ALTER TABLE "comment_likes"
      ADD CONSTRAINT "FK_comment_likes_comment"
      FOREIGN KEY ("commentId") REFERENCES "comments"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "comment_likes"
      ADD CONSTRAINT "FK_comment_likes_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "comment_likes" DROP CONSTRAINT "FK_comment_likes_user"',
    );
    await queryRunner.query(
      'ALTER TABLE "comment_likes" DROP CONSTRAINT "FK_comment_likes_comment"',
    );
    await queryRunner.query('DROP INDEX "IDX_COMMENT_LIKES_USER_CREATED"');
    await queryRunner.query('DROP INDEX "IDX_COMMENT_LIKES_COMMENT_CREATED"');
    await queryRunner.query('DROP TABLE "comment_likes"');
    await queryRunner.query('ALTER TABLE "comments" DROP COLUMN "likeCount"');
  }
}
