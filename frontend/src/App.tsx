import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Properties from "./pages/Properties";
import PropertyDetails from "./pages/PropertyDetails";
import Login from "./pages/Login";
import MyBookings from "./pages/MyBookings";
import { AdminLayout } from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProperties from "./pages/admin/Properties";
import PropertyForm from "./pages/admin/PropertyForm";
import AdminBookings from "./pages/admin/Bookings";
import CalendarView from "./pages/admin/CalendarView";
import Analytics from "./pages/admin/Analytics";
import TestWhatsAppMessage from "./pages/admin/TestWhatsAppMessage";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import PaymentPage from "./pages/Payment";
import TokenPaymentPage from "./pages/TokenPayment";
import UploadIdProof from "./pages/UploadIdProof";
import UserAgreement from "./pages/UserAgreement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/properties/:id" element={<PropertyDetails />} />
            <Route path="/login" element={<Login />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/payments/:bookingId" element={<PaymentPage />} />
            <Route path="/bookings/:bookingId/agreement" element={<UserAgreement />} />
            <Route path="/bookings/:bookingId/token-payment" element={<TokenPaymentPage />} />
            <Route path="/bookings/:bookingId/id-proof" element={<UploadIdProof />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="properties" element={<AdminProperties />} />
              <Route path="properties/new" element={<PropertyForm />} />
              <Route path="properties/edit/:id" element={<PropertyForm />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="calendar" element={<CalendarView />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="test-whatsapp" element={<TestWhatsAppMessage />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
