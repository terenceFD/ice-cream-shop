import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { CartProvider } from "../context/CartContext";
import { HomePage } from "../pages/home/HomePage";
import { NotFoundPage } from "../pages/notfound/NotFoundPage";
import { FlavorProvider } from "../context/FlavorContext";
import { AdminAuthProvider } from "../pages/admin/AdminAuthContext";
import { AdminRoute } from "../components/admin/AdminRoute";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../language/LanguageContext";
import { ScrollRevealObserver } from "../components/ScrollRevealObserver";
import { ScrollProgress } from "../components/ScrollProgress";
import { ScrollToTop } from "../components/ScrollToTop";
import { WebsiteLoader } from "../components/WebsiteLoader";
import { InstallAppPrompt } from "../components/InstallAppPrompt";
import { PromotionAlertsPrompt } from "../components/PromotionAlerts";
import { RouteMeta } from "../seo/RouteMeta";

// Each page below downloads only when a visitor opens it, so the first visit to the shop
// does not carry the admin dashboard, checkout and other pages' code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyPage<M extends Record<string, ComponentType<any>>>(load: () => Promise<M>, name: keyof M) {
  return lazy(async () => ({ default: (await load())[name] }));
}

const FlavorsPage = lazyPage(() => import("../pages/flavors/FlavorsPage"), "FlavorsPage");
const FlavorDetailPage = lazyPage(() => import("../pages/flavors/FlavorDetailPage"), "FlavorDetailPage");
const CartPage = lazyPage(() => import("../pages/cart/CartPage"), "CartPage");
const AuthPage = lazyPage(() => import("../pages/authorization/AuthPage"), "AuthPage");
const AdminPage = lazyPage(() => import("../pages/admin/AdminPage"), "AdminPage");
const AdminMenuPage = lazyPage(() => import("../pages/admin/AdminMenuPage"), "AdminMenuPage");
const AdminLoginPage = lazyPage(() => import("../pages/admin/AdminLoginPage"), "AdminLoginPage");
const CheckoutPage = lazyPage(() => import("../pages/checkout/CheckoutPage"), "CheckoutPage");
const PaymentPage = lazyPage(() => import("../pages/payment/PaymentPage"), "PaymentPage");
const AdminManagementPage = lazyPage(() => import("../pages/admin/AdminManagementPage"), "AdminManagementPage");
const AdminCustomersPage = lazyPage(() => import("../pages/admin/AdminCustomersPage"), "AdminCustomersPage");
const AboutPage = lazyPage(() => import("../pages/about/AboutPage"), "AboutPage");
const ContactPage = lazyPage(() => import("../pages/contact/ContactPage"), "ContactPage");
const LocationsPage = lazyPage(() => import("../pages/locations/LocationsPage"), "LocationsPage");
const MenuPage = lazyPage(() => import("../pages/menu/MenuPage"), "MenuPage");
const AllMenuPage = lazyPage(() => import("../pages/menu/AllMenuPage"), "AllMenuPage");
const CustomerOrdersPage = lazyPage(() => import("../pages/account/CustomerOrdersPage"), "CustomerOrdersPage");
const AdminInventoryPage = lazyPage(() => import("../pages/admin/AdminInventoryPage"), "AdminInventoryPage");
const AdminCategoriesPage = lazyPage(() => import("../pages/admin/AdminCategoriesPage"), "AdminCategoriesPage");
const AdminPromotionsPage = lazyPage(() => import("../pages/admin/AdminPromotionsPage"), "AdminPromotionsPage");
const AdminReportsPage = lazyPage(() => import("../pages/admin/AdminReportsPage"), "AdminReportsPage");
const AdminNotificationsPage = lazyPage(() => import("../pages/admin/AdminNotificationsPage"), "AdminNotificationsPage");
const CustomCakeRequestPage = lazyPage(() => import("../pages/cakes/CustomCakeRequestPage"), "CustomCakeRequestPage");
const AdminStoreOverviewPage = lazyPage(() => import("../pages/admin/AdminStoreOverviewPage"), "AdminStoreOverviewPage");
const AdminStoresPage = lazyPage(() => import("../pages/admin/AdminStoresPage"), "AdminStoresPage");
const AdminActivityPage = lazyPage(() => import("../pages/admin/AdminNewFeaturesPages"), "AdminActivityPage");
const AdminCakeRequestsPage = lazyPage(() => import("../pages/admin/AdminNewFeaturesPages"), "AdminCakeRequestsPage");
const AdminFulfillmentPage = lazyPage(() => import("../pages/admin/AdminNewFeaturesPages"), "AdminFulfillmentPage");
const AdminReviewsPage = lazyPage(() => import("../pages/admin/AdminNewFeaturesPages"), "AdminReviewsPage");
const AdminStockAlertsPage = lazyPage(() => import("../pages/admin/AdminNewFeaturesPages"), "AdminStockAlertsPage");
const AdminDeliveredPage = lazyPage(() => import("../pages/admin/AdminSalesPages"), "AdminDeliveredPage");
const AdminOrdersPage = lazyPage(() => import("../pages/admin/AdminSalesPages"), "AdminOrdersPage");
const AdminPaymentsPage = lazyPage(() => import("../pages/admin/AdminSalesPages"), "AdminPaymentsPage");
const AdminLayout = lazyPage(() => import("../components/admin/AdminLayout"), "AdminLayout");
const EventOrdersPage = lazyPage(() => import("../pages/events/EventOrdersPage"), "EventOrdersPage");
const AdminEventOrdersPage = lazyPage(() => import("../pages/admin/AdminEventOrdersPage"), "AdminEventOrdersPage");

function PageLoading() {
  return <div aria-busy="true" className="min-h-[60vh]" role="status" />;
}

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
            <ScrollToTop />
            <ScrollRevealObserver />
            <ScrollProgress />
            <WebsiteLoader />
            <SkipToMainContent />
            <AuthProvider>
              <AdminAuthProvider>
                <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/flavors" element={<FlavorsPage />} />
                  <Route path="/menu" element={<MenuPage />} />
                  <Route path="/menu/all" element={<AllMenuPage />} />
                  <Route path="/custom-cake" element={<CustomCakeRequestPage />} />
                  <Route path="/events" element={<EventOrdersPage />} />
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
                    <Route path="/admin/stores" element={<AdminStoresPage />} />
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
                    <Route path="/admin/events" element={<AdminEventOrdersPage />} />
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
                </Suspense>
                <InstallAppPrompt />
                <PromotionAlertsPrompt />
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
