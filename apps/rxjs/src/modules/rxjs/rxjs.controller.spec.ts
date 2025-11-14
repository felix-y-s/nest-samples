import { Test, TestingModule } from '@nestjs/testing';
import { RxjsController } from './rxjs.controller';
import { RxjsService } from './rxjs.service';

describe('RxjsController', () => {
  let rxjsController: RxjsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [RxjsController],
      providers: [RxjsService],
    }).compile();

    rxjsController = app.get<RxjsController>(RxjsController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(rxjsController.getHello()).toBe('Hello World!');
    });
  });
});
