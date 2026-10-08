import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "../CartContext";
import { HomePage } from "./pages/HomePage";
import { FlavorsPage } from "./pages/FlavorsPage";
import { FlavorDetailPage } from "./pages/FlavorDetailPage";
import { CartPage } from "./pages/CartPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AuthPage } from "./pages/AuthPage";
import { AdminPage } from "./pages/AdminPage";
import { FlavorProvider } from "../flavor-context/FlavorContext";
import { AdminAuthProvider } from "./AdminAuthContext";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminRoute } from "../components/AdminRoute";
import { CheckoutPage } from "./pages/CheckoutPage";
import { PaymentPage } from "./pages/PaymentPage";
import { AdminManagementPage } from "./pages/AdminManagementPage";
import { AuthProvider } from "../authcontext/AuthContext";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { AdminLayout } from "../components/AdminLayout";
import { AdminNotificationsPage } from "./pages/AdminNotificationsPage";
import {
  AdminDeliveredPage,
  AdminOrdersPage,
  AdminPaymentsPage,
} from "./pages/AdminSalesPages";
import { LanguageProvider } from "../LanguageContext";
import { ScrollRevealObserver } from "../components/ScrollRevealObserver";
import "./index.css";

function App() {
  return (
    <LanguageProvider>
      <FlavorProvider>
        <CartProvider>
          <BrowserRouter>
            <ScrollRevealObserver />
            <AuthProvider>
              <AdminAuthProvider>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/flavors" element={<FlavorsPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/flavor/:id" element={<FlavorDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/payment" element={<PaymentPage />} />
                  <Route path="/login" element={<AuthPage mode="login" />} />
                  <Route path="/signup" element={<AuthPage mode="signup" />} />
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route
                    element={
                      <AdminRoute>
                        <AdminLayout />
                      </AdminRoute>
                    }
                  >
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/admin/orders" element={<AdminOrdersPage />} />
                    <Route
                      path="/admin/delivered"
                      element={<AdminDeliveredPage />}
                    />
                    <Route
                      path="/admin/payments"
                      element={<AdminPaymentsPage />}
                    />
                    <Route
                      path="/admin/notifications"
                      element={<AdminNotificationsPage />}
                    />
                    <Route
                      path="/admin/admins"
                      element={<AdminManagementPage />}
                    />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AdminAuthProvider>
            </AuthProvider>
          </BrowserRouter>
        </CartProvider>
      </FlavorProvider>
    </LanguageProvider>
  );
}

export default App;
