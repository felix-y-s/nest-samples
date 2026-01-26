import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentGatewayMock {
  async paymentProcessing(): Promise<string> {
    if (Math.random() > 0.5) {
      // throw new Error('❌ 결재 처리 중 오류 시뮬레이션');
    }

    const random = Math.random().toFixed(5);
    return `tx-${Date.now()}-${random}`;
  }
}
