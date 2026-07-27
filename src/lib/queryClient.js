// src/lib/queryClient.js
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 60s
      // User navigates back within 1 min = instant, no spinner
      staleTime: 1000 * 60,

      // Keep unused data in cache for 5 mins
      // Prevents stale flash on route change
      gcTime: 1000 * 60 * 5,

      // Retry failed requests twice with exponential backoff
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),

      // Silently refresh when user comes back to tab
      refetchOnWindowFocus: true,

      // Don't refetch just because component remounted
      // This is the #1 cause of flash/flicker on navigation
      refetchOnMount: false,

      // Refetch if connection was lost and restored
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});