import { Test, TestingModule } from '@nestjs/testing';
import { GlobalExceptionFilterController } from './global-exception-filter.controller';
import { GlobalExceptionFilterService } from './global-exception-filter.service';

describe('GlobalExceptionFilterController', () => {
  let globalExceptionFilterController: GlobalExceptionFilterController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [GlobalExceptionFilterController],
      providers: [GlobalExceptionFilterService],
    }).compile();

    globalExceptionFilterController = app.get<GlobalExceptionFilterController>(GlobalExceptionFilterController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(globalExceptionFilterController.getHello()).toBe('Hello World!');
    });
  });
});
