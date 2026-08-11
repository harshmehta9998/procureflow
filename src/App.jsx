import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import { RoleProvider } from '@/lib/RoleContext';
import Home from '@/pages/Home';
import PurchaseOrders from '@/pages/PurchaseOrders';
import CreatePO from '@/pages/CreatePO';
import PODetail from '@/pages/PODetail';
import Vendors from '@/pages/Vendors';
import Institutes from '@/pages/Institutes';
import Finance from '@/pages/Finance';
import Reports from '@/pages/Reports';
import AuditLogPage from '@/pages/AuditLog';
import UserManagement from '@/pages/UserManagement';
import PaymentRequests from '@/pages/PaymentRequests';
import RecurringPayments from '@/pages/RecurringPayments';
import DeliveryVerification from '@/pages/DeliveryVerification';
import PaymentInitiatives from '@/pages/PaymentInitiatives';
import Approvals from '@/pages/Approvals';
import CentreHeads from '@/pages/CentreHeads';
import RefundsCredits from '@/pages/RefundsCredits';
import PaymentHistory from '@/pages/PaymentHistory';
import POAmendments from '@/pages/POAmendments';
import InstitutionFinance from '@/pages/InstitutionFinance';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/create-po" element={<CreatePO />} />
        <Route path="/po/:id" element={<PODetail />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/institutes" element={<Institutes />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/payment-requests" element={<PaymentRequests />} />
        <Route path="/recurring-payments" element={<RecurringPayments />} />
        <Route path="/delivery-verification" element={<DeliveryVerification />} />
        <Route path="/payment-initiatives" element={<PaymentInitiatives />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/centre-heads" element={<CentreHeads />} />
        <Route path="/refunds-credits" element={<RefundsCredits />} />
        <Route path="/payment-history" element={<PaymentHistory />} />
        <Route path="/po-amendments" element={<POAmendments />} />
        <Route path="/institutions" element={<InstitutionFinance />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <RoleProvider>
            <AuthenticatedApp />
          </RoleProvider>
        </Router>
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App