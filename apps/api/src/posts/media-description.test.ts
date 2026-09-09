import { DataSource, Table } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddPostMediaAltText1788900000000 } from '../migrations/1788900000000-AddPostMediaAltText';
import { CreatePostDto } from './dto/create-post.dto';

describe('photo description storage and input', () => {
  it('adds and reverses the nullable column without changing legacy posts', async () => {
    const database = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
    }).initialize();
    const runner = database.createQueryRunner();
    try {
      await runner.createTable(
        new Table({
          name: 'posts',
          columns: [
            { name: 'id', type: 'varchar', isPrimary: true },
            { name: 'content', type: 'varchar' },
          ],
        }),
      );
      await runner.query('INSERT INTO posts (id, content) VALUES (?, ?)', [
        'old',
        'A caption',
      ]);
      const migration = new AddPostMediaAltText1788900000000();
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM posts')).toEqual([
        { id: 'old', content: 'A caption', mediaAltText: null },
      ]);
      await runner.query('UPDATE posts SET mediaAltText = ? WHERE id = ?', [
        'A red boat on a lake',
        'old',
      ]);
      expect(
        (await runner.query('SELECT mediaAltText FROM posts'))[0].mediaAltText,
      ).toBe('A red boat on a lake');
      await migration.down(runner);
      expect(await runner.query('SELECT * FROM posts')).toEqual([
        { id: 'old', content: 'A caption' },
      ]);
      expect(await runner.hasColumn('posts', 'mediaAltText')).toBe(false);
    } finally {
      await runner.release();
      await database.destroy();
    }
  });

  it.each([42, {}, [], 'x'.repeat(1001)])(
    'rejects an invalid description %#',
    async (mediaAltText) => {
      const errors = await validate(
        plainToInstance(CreatePostDto, { content: 'Caption', mediaAltText }),
      );
      expect(errors.map((error) => error.property)).toContain('mediaAltText');
    },
  );
  it('accepts bounded author text and remains compatible with clients omitting it', async () => {
    for (const mediaAltText of [undefined, 'A red boat', 'x'.repeat(1000)]) {
      expect(
        await validate(
          plainToInstance(CreatePostDto, { content: 'Caption', mediaAltText }),
        ),
      ).toEqual([]);
    }
  });
});
