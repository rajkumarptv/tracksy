import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Short staleTime: cached data still paints instantly (no spinner), but a
      // background refresh starts right away so edits/deletes appear immediately.
      staleTime: 15_000,
      gcTime: 24 * 60 * 60_000,   // keep cache 24h for offline-first paint
      // Re-sync when the user returns to the tab / regains connectivity —
      // cheap (only stale queries refetch) and keeps screens truthful.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Always revalidate on navigation; cached data shows first, so it's
      // still instant — just never wrong.
      refetchOnMount: 'always',
    },
  },
});

export default queryClient;
