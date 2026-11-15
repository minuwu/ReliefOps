import { RouterProvider, createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { HomeRedirect, RequireAuth } from '@/routes/RequireAuth';
import { CASE_WORKERS, INSIGHT_ROLES, PATHS, STAFF_ROLES } from '@/routes/paths';
import { LoginPage } from '@/pages/auth/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Each page loads as its own chunk the first time its URL is visited. */
const page = (load: () => Promise<{ Component: React.ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: load,
});

const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: PATHS.login, element: <LoginPage /> },

      {
        element: <RequireAuth roles={INSIGHT_ROLES} />,
        children: [
          {
            path: PATHS.dashboard,
            ...page(() => import('@/pages/DashboardPage').then((m) => ({ Component: m.DashboardPage }))),
          },
          {
            path: PATHS.audit,
            ...page(() => import('@/pages/AuditLogsPage').then((m) => ({ Component: m.AuditLogsPage }))),
          },
        ],
      },
      {
        element: <RequireAuth roles={CASE_WORKERS} />,
        children: [
          {
            path: `${PATHS.review}/:extractionId?`,
            ...page(() => import('@/pages/ReviewQueuePage').then((m) => ({ Component: m.ReviewQueuePage }))),
          },
        ],
      },
      {
        element: <RequireAuth roles={STAFF_ROLES} />,
        children: [
          {
            path: `${PATHS.cases}/:caseId?`,
            ...page(() => import('@/pages/CasesPage').then((m) => ({ Component: m.CasesPage }))),
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}

export default App;
