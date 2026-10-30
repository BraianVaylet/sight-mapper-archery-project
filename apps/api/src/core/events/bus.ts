/**
 * Events between modules (DOMINIO §5). Modules never import each other: they publish here and
 * the composition root wires who listens (ADR-002). Payloads carry ids, never entities.
 */
export type EventMap = {
  UserRegistered: { readonly userId: string };
  SetupDeleted: { readonly userId: string; readonly setupId: string };
  SetupRestored: { readonly userId: string; readonly setupId: string };
  SightScaleChanged: { readonly userId: string; readonly sightId: string };
  AccountDeletionRequested: { readonly userId: string };
  AccountPurged: { readonly userId: string };
};

export type EventHandler<Payload> = (payload: Payload) => void | Promise<void>;

export type EventBus<Events extends Record<string, unknown> = EventMap> = {
  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void;
  publish<K extends keyof Events>(type: K, payload: Events[K]): Promise<void>;
};

/**
 * In-process bus. `publish` awaits the handlers one by one, in registration order, so a
 * synchronous reaction (like recalculating marks) can share the publisher's transaction. A
 * handler that throws stops the chain and the error reaches the publisher.
 */
export function createEventBus<
  Events extends Record<string, unknown> = EventMap,
>(): EventBus<Events> {
  const handlers = new Map<keyof Events, EventHandler<never>[]>();

  return {
    on(type, handler) {
      const list = handlers.get(type) ?? [];
      list.push(handler as EventHandler<never>);
      handlers.set(type, list);
    },
    async publish(type, payload) {
      for (const handler of handlers.get(type) ?? []) {
        await (handler as EventHandler<typeof payload>)(payload);
      }
    },
  };
}
