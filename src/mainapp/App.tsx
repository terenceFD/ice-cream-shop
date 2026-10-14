import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { CartProvider } from "../CartContext";
import { HomePage } from "../pages/feature/home page/HomePage";
import { FlavorsPage } from "../pages/feature/flavors/FlavorsPage";
import { FlavorDetailPage } from "../pages/feature/flavors/FlavorDetailPage";
import { CartPage } from "../pages/feature/cart/CartPage";
import { NotFoundPage } from "../pages/feature/notfound/NotFoundPage";
import { AuthPage } from "../pages/feature/authorization/AuthPage";
import { AdminPage } from "../pages/feature/admin/AdminPage";
import { AdminMenuPage } from "../pages/feature/admin/AdminMenuPage";
import { FlavorProvider } from "../flavor-context/FlavorContext";
import { AdminAuthProvider } from "../pages/feature/admin/AdminAuthContext";
import { AdminLoginPage } from "../pages/feature/admin/AdminLoginPage";
import { AdminRoute } from "../components/AdminRoute";
import { CheckoutPage } from "../pages/feature/checkout/CheckoutPage";
import { PaymentPage } from "../pages/feature/payment page/PaymentPage";
import { AdminManagementPage } from "../pages/feature/admin/AdminManagementPage";
import { AdminCustomersPage } from "../pages/feature/admin/AdminCustomersPage";
import { AuthProvider } from "../authcontext/AuthContext";
import { AboutPage } from "../pages/feature/about/AboutPage";
import { ContactPage } from "../pages/feature/contact/ContactPage";
import { LocationsPage } from "../pages/feature/locations/LocationsPage";
import { MenuPage } from "../pages/feature/menu/MenuPage";
import { CustomerOrdersPage } from "../pages/feature/account/CustomerOrdersPage";
import { AdminInventoryPage } from "../pages/feature/admin/AdminInventoryPage";
import { AdminCategoriesPage } from "../pages/feature/admin/AdminCategoriesPage";
import { AdminPromotionsPage } from "../pages/feature/admin/AdminPromotionsPage";
import { AdminReportsPage } from "../pages/feature/admin/AdminReportsPage";
import { AdminLayout } from "../components/AdminLayout";
import { AdminNotificationsPage } from "../pages/feature/admin/AdminNotificationsPage";
import { CustomCakeRequestPage } from "../pages/feature/cakes/CustomCakeRequestPage";
import { AdminStoreOverviewPage } from "../pages/feature/admin/AdminStoreOverviewPage";
import {
  AdminActivityPage,
  AdminCakeRequestsPage,
  AdminFulfillmentPage,
  AdminReviewsPage,
  AdminStockAlertsPage,
} from "../pages/feature/admin/AdminNewFeaturesPages";
import {
  AdminDeliveredPage,
  AdminOrdersPage,
  AdminPaymentsPage,
} from "../pages/feature/admin/AdminSalesPages";
import { LanguageProvider } from "../language/LanguageContext";
import { ScrollRevealObserver } from "../components/ScrollRevealObserver";
import { ScrollProgress } from "../components/ScrollProgress";
import { WebsiteLoader } from "../components/WebsiteLoader";
import { InstallAppPrompt } from "../components/InstallAppPrompt";
import { RouteMeta } from "../seo/RouteMeta";

function SkipToMainContent() {
  const location = useLocation();

  useEffect(() => {
    const main = document.querySelector("main");
    if (main) {
      main.id = "main-content";
      main.tabIndex = -1;
    }
  }, [location.pathname]);

  return (
    <a
      className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-white px-4 py-3 font-bold text-[#102c50] shadow focus:not-sr-only"
      href="#main-content"
    >
      Skip to main content
    </a>
  );
}

function App() {
  return (
    <LanguageProvider>
      <FlavorProvider>
        <CartProvider>
          <BrowserRouter>
            <ScrollRevealObserver />
            <ScrollProgress />
            <WebsiteLoader />
            <SkipToMainContent />
            <AuthProvider>
              <AdminAuthProvider>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/flavors" element={<FlavorsPage />} />
                  <Route path="/menu" element={<MenuPage />} />
                  <Route path="/custom-cake" element={<CustomCakeRequestPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/locations" element={<LocationsPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/flavor/:id" element={<FlavorDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/payment" element={<PaymentPage />} />
                  <Route path="/login" element={<AuthPage mode="login" />} />
                  <Route path="/signup" element={<AuthPage mode="signup" />} />
                  <Route path="/account/orders" element={<CustomerOrdersPage />} />
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route
                    element={
                      <AdminRoute>
                        <AdminLayout />
                      </AdminRoute>
                    }
                  >
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/admin/overview" element={<AdminStoreOverviewPage />} />
                    <Route path="/admin/menu" element={<AdminMenuPage />} />
                    <Route path="/admin/inventory" element={<AdminInventoryPage />} />
                    <Route path="/admin/categories" element={<AdminCategoriesPage />} />
                    <Route path="/admin/stock-alerts" element={<AdminStockAlertsPage />} />
                    <Route path="/admin/fulfillment" element={<AdminFulfillmentPage />} />
                    <Route path="/admin/activity" element={<AdminActivityPage />} />
                    <Route path="/admin/promotions" element={<AdminPromotionsPage />} />
                    <Route path="/admin/reports" element={<AdminReportsPage />} />
                    <Route path="/admin/reviews" element={<AdminReviewsPage />} />
                    <Route path="/admin/cake-requests" element={<AdminCakeRequestsPage />} />
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
                    <Route
                      path="/admin/customers"
                      element={<AdminCustomersPage />}
                    />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
                <InstallAppPrompt />
                <RouteMeta />
              </AdminAuthProvider>
            </AuthProvider>
          </BrowserRouter>
        </CartProvider>
      </FlavorProvider>
    </LanguageProvider>
  );
}

export default App;
