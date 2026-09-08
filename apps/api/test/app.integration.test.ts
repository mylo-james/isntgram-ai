import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';

describe('AppController (Integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /', () => {
    it('should return "Isntgram API"', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Isntgram API');
    });

    it('should have correct content-type', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Content-Type', /text\/html/);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent routes', () => {
      return request(app.getHttpServer())
        .get('/non-existent-route')
        .expect(404);
    });
  });
});
