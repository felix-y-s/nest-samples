import { Test, TestingModule } from '@nestjs/testing';
import { EventStoreService } from './event-store.service';
import { EventBus, IEvent } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

// Mock Events
class MockEventA implements IEvent {
  constructor(public readonly orderId: string, public readonly amount: number) {}
}

class MockEventB implements IEvent {
  constructor(public readonly userId: string, public readonly name: string) {}
}

class MockEventNoId implements IEvent {
  constructor(public readonly data: string) {}
}

describe('EventStoreService', () => {
  let service: EventStoreService;
  let eventBus: EventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventStoreService,
        {
          provide: EventBus,
          useValue: {
            subscribe: jest.fn(),
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventStoreService>(EventStoreService);
    eventBus = module.get<EventBus>(EventBus);
    
    // Manually trigger onModuleInit to subscribe
    service.onModuleInit();
  });

  it('should subscribe to EventBus on init', () => {
    expect(eventBus.subscribe).toHaveBeenCalled();
  });

  it('should save event with orderId', () => {
    const event = new MockEventA('order-123', 100);
    // Simulate event bus callback
    const callback = (eventBus.subscribe as jest.Mock).mock.calls[0][0];
    callback(event);

    const savedEvents = service.getEvents('order-123');
    expect(savedEvents).toHaveLength(1);
    expect(savedEvents[0]).toBe(event);
  });

  it('should save event with userId', () => {
    const event = new MockEventB('user-456', 'Felix');
    const callback = (eventBus.subscribe as jest.Mock).mock.calls[0][0];
    callback(event);

    const savedEvents = service.getEvents('user-456');
    expect(savedEvents).toHaveLength(1);
    expect(savedEvents[0]).toBe(event);
  });

  it('should ignore events without identifiable ID', () => {
    const event = new MockEventNoId('some data');
    const callback = (eventBus.subscribe as jest.Mock).mock.calls[0][0];
    callback(event);

    // Should not throw and log warning (if logging enabled)
    // We can't easily check internal map state if it didn't save, 
    // but we can check checking accessors or spy on console if needed.
    // Here we just ensure it doesn't crash and getEvents returns empty for unknown IDs;
    const allIds = service.getAllAggregateIds();
    expect(allIds).toHaveLength(0);
  });

  it('should append multiple events to same aggregate', () => {
    const event1 = new MockEventA('order-123', 100);
    const event2 = new MockEventA('order-123', 200);

    const callback = (eventBus.subscribe as jest.Mock).mock.calls[0][0];
    callback(event1);
    callback(event2);

    const savedEvents = service.getEvents('order-123');
    expect(savedEvents).toHaveLength(2);
    expect(savedEvents).toEqual([event1, event2]);
  });
});
