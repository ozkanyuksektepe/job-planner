import { QueryClient } from '@tanstack/react-query'

/** The app's single query client; also used outside React (e.g. by delayed deletes in lib/undo.ts). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 },
  },
})
