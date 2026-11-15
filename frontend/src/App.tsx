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

const emailPages = () => import('@/pages/auth/EmailLinkPages');

const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: PATHS.login, element: <LoginPage /> },

      // Public account pages. Email links from the backend land here.
      { path: PATHS.signup, ...page(() => import('@/pages/auth/SignupPage').then((m) => ({ Component: m.SignupPage }))) },
      { path: PATHS.verifyEmail, ...page(() => emailPages().then((m) => ({ Component: m.VerifyEmailPage }))) },
      { path: PATHS.forgotPassword, ...page(() => emailPages().then((m) => ({ Component: m.ForgotPasswordPage }))) },
      { path: PATHS.resetPassword, ...page(() => emailPages().then((m) => ({ Component: m.ResetPasswordPage }))) },
      { path: PATHS.acceptInvitation, ...page(() => emailPages().then((m) => ({ Component: m.AcceptInvitationPage }))) },

      {
        element: <RequireAuth roles={['victim']} />,
        children: [
          {
            path: PATHS.portal,
            ...page(() => import('@/pages/portal/PortalHomePage').then((m) => ({ Component: m.PortalHomePage }))),
          },
          {
            path: PATHS.portalReport,
            ...page(() => import('@/pages/portal/ReportCasePage').then((m) => ({ Component: m.ReportCasePage }))),
          },
          {
            path: `${PATHS.portal}/cases/:caseId`,
            ...page(() => import('@/pages/portal/PortalCasePage').then((m) => ({ Component: m.PortalCasePage }))),
          },
          { path: PATHS.claimCase, ...page(() => emailPages().then((m) => ({ Component: m.ClaimCasePage }))) },
        ],
      },

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
        element: <RequireAuth roles={['supervisor']} />,
        children: [
          {
            path: PATHS.adminUsers,
            ...page(() => import('@/pages/AdminUsersPage').then((m) => ({ Component: m.AdminUsersPage }))),
          },
        ],
      },
      {
        // Every staff role reads the bluebooks; only supervisors upload, publish and archive (contract §6.8).
        element: <RequireAuth roles={['operator', 'supervisor', 'bank_viewer']} />,
        children: [
          {
            path: PATHS.knowledge,
            ...page(() => import('@/pages/KnowledgeBasePage').then((m) => ({ Component: m.KnowledgeBasePage }))),
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
