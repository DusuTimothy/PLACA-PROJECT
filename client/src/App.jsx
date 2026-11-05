import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute, {
  AdminRoute,
  PlacaRoute,
  ProgrammeRoute,
  RedirectIfAuthenticated,
  UserManagementRoute,
} from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import TotpSetupPage from './pages/TotpSetupPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import AssistantPage from './pages/AssistantPage';
import OrganizationsPage from './pages/OrganizationsPage';
import WorkplansPage from './pages/WorkplansPage';
import WorkplanPage from './pages/WorkplanPage';
import ReportsPage from './pages/ReportsPage';
import ReportPage from './pages/ReportPage';
import AuditLogPage from './pages/AuditLogPage';
import HelpPage from './pages/HelpPage';
import GuideEditorPage from './pages/GuideEditorPage';
import DocumentsPage from './pages/DocumentsPage';
import SupportRequestsPage from './pages/SupportRequestsPage';
import ProgrammesPage from './pages/ProgrammesPage';
import FundingPage from './pages/FundingPage';
import EquipmentPage from './pages/EquipmentPage';
import NotificationsPage from './pages/NotificationsPage';
import UsersPage from './pages/UsersPage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * Foundation routes. Programme modules are added phase by phase inside the
 * protected part of this tree.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/totp-setup" element={<TotpSetupPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowPasswordChange>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/assistant"
        element={
          <ProtectedRoute>
            <AssistantPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/organizations"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <OrganizationsPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/workplans"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <WorkplansPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workplans/:id"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <WorkplanPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <ReportsPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/:id"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <ReportPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AuditLogPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <DocumentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guide-editor"
        element={
          <ProtectedRoute>
            <PlacaRoute>
              <GuideEditorPage />
            </PlacaRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UserManagementRoute>
              <UsersPage />
            </UserManagementRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <SupportRequestsPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/programmes"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <ProgrammesPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/funding"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <FundingPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipment"
        element={
          <ProtectedRoute>
            <ProgrammeRoute>
              <EquipmentPage />
            </ProgrammeRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
