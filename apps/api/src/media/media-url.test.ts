import { projectMediaUrl } from './media-url';

const canonical = 'http://127.0.0.1:48333/isntgram-v1-media';
const display = 'https://phone.example:9444/isntgram-v1-media';
const owner = '550e8400-e29b-41d4-a716-446655440000';
const object = '660e8400-e29b-41d4-a716-846655440000';
const published = `${canonical}/published/${owner}/${object}`;

describe('projectMediaUrl', () => {
  it('projects only a complete canonical published UUID key', () => {
    expect(projectMediaUrl(published, canonical, display)).toBe(
      `${display}/published/${owner}/${object}`,
    );
  });
  it.each([
    `${canonical}/pending/${owner}/${object}`,
    `${canonical}/published/${owner}/${object}/extra`,
    `${canonical}/published/${owner}/not-a-uuid`,
    `${canonical}/published/${owner}/${object}?token=x`,
    `${canonical}/published/${owner}/${object}%2Fextra`,
    `https://other.example/isntgram-v1-media/published/${owner}/${object}`,
    `${canonical}/./published/${owner}/${object}`,
    ` ${published}`,
  ])('leaves a non-displayable URL unchanged: %s', (value) => {
    expect(projectMediaUrl(value, canonical, display)).toBe(value);
  });

  it.each([
    {
      canonicalBase: 'http://localhost:48333/isntgram-v1-media',
      value: `http://LOCALHOST:48333/isntgram-v1-media/published/${owner}/${object}`,
    },
    {
      canonicalBase: 'http://localhost/isntgram-v1-media',
      value: `http://localhost:80/isntgram-v1-media/published/${owner}/${object}`,
    },
  ])(
    'does not normalize alternate raw host or default-port spellings',
    ({ canonicalBase, value }) => {
      expect(projectMediaUrl(value, canonicalBase, display)).toBe(value);
    },
  );
});
