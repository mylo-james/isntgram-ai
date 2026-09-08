import { createHash } from 'crypto';
import { readFileSync, realpathSync } from 'fs';
import { join, resolve } from 'path';

export const CORPUS_VERSION = 'isntgram-v1-curated-1';
export const CORPUS_SHA256 =
  '59389b8b58f46294e3d7f49fed17216fde2fb9e8fc61419bd0982214a131aa09';

export type FixtureActor = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  isDemoUser: boolean;
  isDemoSeed?: boolean;
  bio?: string;
};
export type CorpusPhoto = {
  id: string;
  postId: string;
  uploadId: string;
  caption: string;
  altText: string;
  original: { fileName: string; bytes: number; sha256: string; mime: string };
  validated: {
    sha256: string;
    bytes: number;
    contentType: string;
    width: number;
    height: number;
    frames: number;
  };
};
export type Corpus = {
  version: string;
  actors: FixtureActor[];
  photos: CorpusPhoto[];
  textPost: { id: string; content: string };
  demoSeeds: Array<
    FixtureActor & {
      posts: Array<{ id: string; photoId: string; uploadId: string }>;
    }
  >;
};
export type FixturePost = {
  id: string;
  authorId: string;
  content: string;
  uploadId?: string;
  photo?: CorpusPhoto;
};

export function corpusDirectory(): string {
  return resolve(__dirname, '../../../../fixtures/v1');
}

export function loadCuratedCorpus(): Corpus {
  const file = join(corpusDirectory(), 'content.json');
  if (realpathSync(file) !== file) throw new Error('Indirect corpus refused');
  const bytes = readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !== CORPUS_SHA256)
    throw new Error('Curated corpus differs from the reviewed version');
  // The source hash binds the complete reviewed shape, identities and attribution.
  return JSON.parse(bytes.toString('utf8')) as Corpus;
}

export function readCorpusPhoto(photo: CorpusPhoto): Buffer {
  if (!/^\d{5}\.jpg$/.test(photo.original.fileName))
    throw new Error('Invalid corpus image name');
  const file = join(corpusDirectory(), 'images', photo.original.fileName);
  if (realpathSync(file) !== file) throw new Error('Indirect image refused');
  const bytes = readFileSync(file);
  if (
    bytes.length !== photo.original.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== photo.original.sha256
  )
    throw new Error('Corpus image bytes differ');
  return bytes;
}

export function fixturePosts(corpus: Corpus): FixturePost[] {
  const authorId = corpus.actors[1].id;
  return [
    ...corpus.photos.map((photo) => ({
      id: photo.postId,
      authorId,
      content: photo.caption,
      uploadId: photo.uploadId,
      photo,
    })),
    { ...corpus.textPost, authorId },
    ...corpus.demoSeeds.flatMap((actor) =>
      actor.posts.map((post) => {
        const photo = corpus.photos.find((item) => item.id === post.photoId);
        if (!photo) throw new Error('Missing demo photo definition');
        return {
          id: post.id,
          authorId: actor.id,
          content: photo.caption,
          uploadId: post.uploadId,
          photo,
        };
      }),
    ),
  ];
}
