export interface TimeEventContext {
  worldTime: number;
  ownerId: number;
}

export type TimeEventPayload = number[];
export type TimeEventHandler = (payload: TimeEventPayload, context: TimeEventContext) => void;

interface ScheduledEvent {
  id: number;
  ownerId: number;
  handlerName: string;
  payload: TimeEventPayload;
  timeoutHandle: ReturnType<typeof setTimeout>;
  repeat: boolean;
  interval: number;
}

export class TimeEventScheduler {
  private handlers = new Map<string, TimeEventHandler>();
  private events = new Map<number, ScheduledEvent>();
  private counter = 1;

  registerHandler(name: string, handler: TimeEventHandler): void {
    this.handlers.set(name, handler);
  }

  unregisterHandler(name: string): void {
    this.handlers.delete(name);
  }

  createEvent(ownerId: number, handlerName: string, intervalMs: number, payload: TimeEventPayload, repeat = false): number {
    const handler = this.handlers.get(handlerName);
    if (!handler) {
      throw new Error(`No handler registered for ${handlerName}`);
    }

    const id = this.counter++;
    const timeoutHandle = setTimeout(() => this.executeEvent(id), intervalMs);

    this.events.set(id, {
      id,
      ownerId,
      handlerName,
      payload,
      timeoutHandle,
      repeat,
      interval: intervalMs,
    });

    return id;
  }

  eraseEvent(eventId: number): boolean {
    const event = this.events.get(eventId);
    if (!event) {
      return false;
    }

    clearTimeout(event.timeoutHandle);
    this.events.delete(eventId);
    return true;
  }

  getEvent(eventId: number): ScheduledEvent | undefined {
    return this.events.get(eventId);
  }

  setEventInterval(eventId: number, intervalMs: number): boolean {
    const event = this.events.get(eventId);
    if (!event) {
      return false;
    }

    clearTimeout(event.timeoutHandle);
    event.interval = intervalMs;
    event.timeoutHandle = setTimeout(() => this.executeEvent(eventId), intervalMs);
    return true;
  }

  private executeEvent(eventId: number): void {
    const event = this.events.get(eventId);
    if (!event) {
      return;
    }

    const handler = this.handlers.get(event.handlerName);
    if (!handler) {
      console.warn(`Time event handler ${event.handlerName} disappeared.`);
      this.events.delete(eventId);
      return;
    }

    handler(event.payload, { ownerId: event.ownerId, worldTime: Date.now() });

    if (event.repeat) {
      event.timeoutHandle = setTimeout(() => this.executeEvent(eventId), event.interval);
    } else {
      this.events.delete(eventId);
    }
  }
}
