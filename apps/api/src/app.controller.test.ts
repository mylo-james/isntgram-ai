import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Isntgram API');
    });
  });

  describe('health', () => {
    it('should return ok status', () => {
      expect(appController.health()).toEqual({ status: 'ok' });
    });
  });

  describe('ready', () => {
    it('should return readiness status', async () => {
      const result = await appController.readiness();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('database');
    });
  });
});
