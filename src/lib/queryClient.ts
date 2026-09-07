import { QueryClient } from '@tanstack/react-query';
import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

/**
 * Creates an IndexedDB persister using idb-keyval
 * This allows React Query to save its cache to the browser's IndexedDB,
 * surviving browser restarts and page reloads effortlessly.
 */
export function createIDBPersister(idbValidKey: IDBValidKey = 'reactQuery') {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } as Persister;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // By default, cache for 24 hours so the data persists across reloads
      gcTime: 1000 * 60 * 60 * 24, 
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
      refetchOnWindowFocus: false, // Don't aggressively refetch just by switching tabs
    },
  },
});

export const idbPersister = createIDBPersister();
