import { createContext, useContext, type ReactNode } from 'react';
import type { ApiClients } from './api.js';

const ClientsContext = createContext<ApiClients | null>(null);

/** Both HTTP clients, injectable: tests and the sandbox hand in ones with a fake `fetch`. */
export function ClientsProvider({
  clients,
  children,
}: {
  clients: ApiClients;
  children: ReactNode;
}) {
  return <ClientsContext.Provider value={clients}>{children}</ClientsContext.Provider>;
}

export function useClients(): ApiClients {
  const clients = useContext(ClientsContext);
  if (clients === null) throw new Error('useClients needs a <ClientsProvider> above it');
  return clients;
}
