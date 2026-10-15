import '@fontsource-variable/inter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import BoardPage from './pages/BoardPage'
import './index.css'
import InboxPage from './pages/InboxPage'
import NotePage from './pages/NotePage'
import NotesPage from './pages/NotesPage'
import ProjectPage from './pages/ProjectPage'
import TagPage from './pages/TagPage'
import TodayPage from './pages/TodayPage'
import WeekPage from './pages/WeekPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayPage /> },
      { path: 'inbox', element: <InboxPage /> },
      { path: 'week', element: <WeekPage /> },
      { path: 'boards/:boardId', element: <BoardPage /> },
      { path: 'tags/:tagId', element: <TagPage /> },
      { path: 'projects/:projectId', element: <ProjectPage tab="tasks" /> },
      { path: 'projects/:projectId/notes', element: <ProjectPage tab="notes" /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'notes/:noteId', element: <NotePage /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
