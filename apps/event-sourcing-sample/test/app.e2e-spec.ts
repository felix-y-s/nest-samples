import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('이벤트 소싱 E2E 테스트', () => {
  let app: INestApplication;
  let createdOrderId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('주문 생성 및 결제 성공 시나리오', () => {
    it('1. 주문을 생성해야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'USER-001',
          productId: 'PROD-001',
          productName: '노트북',
          quantity: 1,
          price: 1000000,
          discountRate: 10, // 10% 할인
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.orderId).toBeDefined();
      createdOrderId = response.body.orderId;
    });

    it('2. 주문 상태를 조회할 수 있어야 함', async () => {
      // 먼저 주문 생성
      const createResponse = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'USER-002',
          productId: 'PROD-002',
          productName: '키보드',
          quantity: 2,
          price: 100000,
          discountRate: 20,
        });
      const orderId = createResponse.body.orderId;

      // 상태 조회
      const response = await request(app.getHttpServer())
        .get(`/orders/${orderId}/status`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderId).toBe(orderId);
      expect(response.body.data.status).toBe('CREATED');
      expect(response.body.data.eventCount).toBe(1); // OrderCreatedEvent
    });

    it('3. 충분한 잔액으로 결제에 성공해야 함', async () => {
      // 주문 생성
      const createResponse = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'USER-003',
          productId: 'PROD-003',
          productName: '마우스',
          quantity: 1,
          price: 50000,
          discountRate: 10, // 할인 후: 45,000원
        });
      const orderId = createResponse.body.orderId;

      // 결제 처리 (잔액 충분)
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/payment`)
        .send({
          userBalance: 100000, // 충분한 잔액
        })
        .expect(201);

      // 상태 확인
      const statusResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}/status`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('COMPLETED');
    });

    it('4. 이벤트 히스토리를 조회할 수 있어야 함', async () => {
      // 주문 생성
      const createResponse = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'USER-004',
          productId: 'PROD-004',
          productName: '모니터',
          quantity: 1,
          price: 300000,
          discountRate: 5,
        });
      const orderId = createResponse.body.orderId;

      // 결제 처리
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/payment`)
        .send({
          userBalance: 500000,
        });

      // 이벤트 히스토리 조회
      const response = await request(app.getHttpServer())
        .get(`/orders/${orderId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(4);
      expect(response.body.data.events[0].eventType).toBe('OrderCreatedEvent');
      expect(response.body.data.events[1].eventType).toBe('PaymentAttemptedEvent');
      expect(response.body.data.events[2].eventType).toBe('PaymentSucceededEvent');
      expect(response.body.data.events[3].eventType).toBe('OrderCompletedEvent');
    });
  });

  describe('결제 실패 시나리오', () => {
    it('1. 잔액 부족으로 결제가 실패해야 함', async () => {
      // 주문 생성
      const createResponse = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'USER-005',
          productId: 'PROD-005',
          productName: '태블릿',
          quantity: 1,
          price: 500000,
          discountRate: 10, // 할인 후: 450,000원
        });
      const orderId = createResponse.body.orderId;

      // 결제 처리 (잔액 부족)
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/payment`)
        .send({
          userBalance: 300000, // 부족한 잔액
        })
        .expect(201);

      // 상태 확인
      const statusResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}/status`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('PAYMENT_FAILED');

      // 이벤트 히스토리 확인
      const historyResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}/history`)
        .expect(200);

      const failedEvent = historyResponse.body.data.events.find(
        (e) => e.eventType === 'PaymentFailedEvent',
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.data.reason).toBe('INSUFFICIENT_BALANCE');
    });

    it('2. 할인율 초과로 결제가 실패해야 함', async () => {
      // 주문 생성 (할인율 60% - 최대 50% 초과)
      const createResponse = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'USER-006',
          productId: 'PROD-006',
          productName: '헤드폰',
          quantity: 1,
          price: 200000,
          discountRate: 60, // 최대 허용치(50%) 초과
        });
      const orderId = createResponse.body.orderId;

      // 결제 처리
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/payment`)
        .send({
          userBalance: 1000000, // 충분한 잔액
        })
        .expect(201);

      // 상태 확인
      const statusResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}/status`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('PAYMENT_FAILED');

      // 이벤트 히스토리 확인
      const historyResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}/history`)
        .expect(200);

      const failedEvent = historyResponse.body.data.events.find(
        (e) => e.eventType === 'PaymentFailedEvent',
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.data.reason).toBe('INVALID_DISCOUNT_RATE');
      expect(failedEvent.data.additionalInfo.requestedDiscountRate).toBe(60);
      expect(failedEvent.data.additionalInfo.maxAllowedDiscountRate).toBe(50);
    });
  });

  describe('유효성 검증 테스트', () => {
    it('수량이 0 이하일 경우 주문 생성이 실패해야 함', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'USER-007',
          productId: 'PROD-007',
          productName: '잘못된 상품',
          quantity: 0, // 잘못된 수량
          price: 10000,
          discountRate: 10,
        })
        .expect(400);
    });

    it('할인율이 100을 초과할 경우 주문 생성이 실패해야 함', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'USER-008',
          productId: 'PROD-008',
          productName: '잘못된 상품',
          quantity: 1,
          price: 10000,
          discountRate: 150, // 잘못된 할인율
        })
        .expect(400);
    });
  });
});
