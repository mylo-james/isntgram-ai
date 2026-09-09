import { DataSource, Table } from 'typeorm';
import { AddProfilePictureMediaBinding1788910000000 } from '../migrations/1788910000000-AddProfilePictureMediaBinding';

describe('profile picture media binding migration', () => {
  it('reverses its index, foreign key, and column in SQLite', async () => {
    const database = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
    }).initialize();
    const runner = database.createQueryRunner();
    try {
      await runner.createTable(
        new Table({
          name: 'users',
          columns: [{ name: 'id', type: 'uuid', isPrimary: true }],
        }),
      );
      await runner.createTable(
        new Table({
          name: 'media_uploads',
          columns: [{ name: 'id', type: 'uuid', isPrimary: true }],
        }),
      );

      const migration = new AddProfilePictureMediaBinding1788910000000();
      await migration.up(runner);
      expect((await runner.getTable('media_uploads'))?.foreignKeys).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ columnNames: ['profilePictureUserId'] }),
        ]),
      );

      await migration.down(runner);
      expect(
        await runner.hasColumn('media_uploads', 'profilePictureUserId'),
      ).toBe(false);
      expect(
        (await runner.getTable('media_uploads'))?.foreignKeys,
      ).toHaveLength(0);
    } finally {
      await runner.release();
      await database.destroy();
    }
  });
});
