import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetHighValueOrderQuery } from '../get-high-value-order.query';
import { HighValueOrderRepository } from '../../repositories/high-value-order.repository';

@QueryHandler(GetHighValueOrderQuery)
export class GetHighValueOrderHandler implements IQueryHandler<GetHighValueOrderQuery> {
  constructor(private readonly repository: HighValueOrderRepository) {}

  async execute(query: GetHighValueOrderQuery) {
    return this.repository.findHighest();
  }
}
