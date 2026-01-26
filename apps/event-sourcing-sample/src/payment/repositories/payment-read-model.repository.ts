import { Injectable } from '@nestjs/common';

export interface PaymentReadModel {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  status: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PaymentReadModelRepository {
  private payments: Map<string, PaymentReadModel> = new Map();

  async findById(paymentId: string): Promise<PaymentReadModel | null> {
    return this.payments.get(paymentId) || null;
  }

  async findByOrderId(orderId: string): Promise<PaymentReadModel | null> {
    const payments = Array.from(this.payments.values());
    return payments.find(p => p.orderId === orderId) || null;
  }

  /**
   * 이벤트 핸들러가 호출하여 Read Model 동기화
   */
  async async(payment: Partial<PaymentReadModel>): Promise<void> {
    const existing = this.payments.get(payment.paymentId!);
    if (existing) {
      this.payments.set(payment.paymentId!, {
        ...existing,
        ...payment,
        updatedAt: new Date(),
      });
    } else {
      this.payments.set(payment.paymentId!, payment as PaymentReadModel);
    }
  }
}