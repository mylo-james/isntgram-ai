import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePostDto } from './create-post.dto';

describe('CreatePostDto validation', () => {
  it('accepts localhost media URLs (for local MinIO)', async () => {
    const dto = plainToInstance(CreatePostDto, {
      content: 'Hello world',
      mediaUrl: 'http://localhost:9000/isntgram-media/uploads/x/y.jpg',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects media URLs without a protocol', async () => {
    const dto = plainToInstance(CreatePostDto, {
      content: 'Hello world',
      mediaUrl: 'localhost:9000/isntgram-media/uploads/x/y.jpg',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('mediaUrl');
  });
});
