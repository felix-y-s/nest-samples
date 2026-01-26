import { Module } from '@nestjs/common';
import { PaymentGatewayMock } from './payment-processing.mock';
import { UserRepositoryMock } from './user.repository.mock';

@Module({
  providers: [PaymentGatewayMock, UserRepositoryMock],
  exports: [PaymentGatewayMock, UserRepositoryMock]
})
export class MockModule {}