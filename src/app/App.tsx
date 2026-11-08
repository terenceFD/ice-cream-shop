import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { CartProvider } from "../context/CartContext";
import { NotFoundPage } from "../pages/notfound/NotFoundPage";
import { FlavorProvider } from "../context/FlavorContext";
import { AdminAuthProvider } from "../pages/admin/AdminAuthContext";
import { AdminRoute } from "../components/admin/AdminRoute";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../language/LanguageContext";
import { CurrencyProvider } from "../context/CurrencyContext";
import { ScrollProgress } from "../components/ScrollProgress";
import { CurrencySwitcher } from "../components/Layout";
import { ScrollToTop } from "../components/ScrollToTop";
import { WebsiteLoader } from "../components/WebsiteLoader";
import { RouteMeta } from "../seo/RouteMeta";
import { useLanguage } from "../language/useLanguage";
import { useTrackFloatingWidgets } from "../lib/floatingWidgets";

// Each page below downloads only when a visitor opens it, so the first visit to the shop
// does not carry the admin dashboard, checkout and other pages' code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyPage<M extends Record<string, ComponentType<any>>>(
  load: () => Promise<M>,
  name: keyof M,
) {
  return lazy(async () => ({ default: (await load())[name] }));
}

const FlavorsPage = lazyPage(
  () => import("../pages/flavors/FlavorsPage"),
  "FlavorsPage",
);
const FlavorDetailPage = lazyPage(
  () => import("../pages/flavors/FlavorDetailPage"),
  "FlavorDetailPage",
);
const CartPage = lazyPage(() => import("../pages/cart/CartPage"), "CartPage");
const AuthPage = lazyPage(
  () => import("../pages/authorization/AuthPage"),
  "AuthPage",
);
const AdminPage = lazyPage(
  () => import("../pages/admin/AdminPage"),
  "AdminPage",
);
const AdminMenuPage = lazyPage(
  () => import("../pages/admin/AdminMenuPage"),
  "AdminMenuPage",
);
const AdminLoginPage = lazyPage(
  () => import("../pages/admin/AdminLoginPage"),
  "AdminLoginPage",
);
const CheckoutPage = lazyPage(
  () => import("../pages/checkout/CheckoutPage"),
  "CheckoutPage",
);
const PaymentPage = lazyPage(
  () => import("../pages/payment/PaymentPage"),
  "PaymentPage",
);
const AdminManagementPage = lazyPage(
  () => import("../pages/admin/AdminManagementPage"),
  "AdminManagementPage",
);
const AdminCustomersPage = lazyPage(
  () => import("../pages/admin/AdminCustomersPage"),
  "AdminCustomersPage",
);
const AboutPage = lazyPage(
  () => import("../pages/about/AboutPage"),
  "AboutPage",
);
const ContactPage = lazyPage(
  () => import("../pages/contact/ContactPage"),
  "ContactPage",
);
const LocationsPage = lazyPage(
  () => import("../pages/locations/LocationsPage"),
  "LocationsPage",
);
const PrivacyPolicyPage = lazyPage(
  () => import("../pages/legal/PrivacyPolicyPage"),
  "PrivacyPolicyPage",
);
const TermsPage = lazyPage(
  () => import("../pages/legal/TermsPage"),
  "TermsPage",
);
const RefundPolicyPage = lazyPage(
  () => import("../pages/legal/RefundPolicyPage"),
  "RefundPolicyPage",
);
const CookiePolicyPage = lazyPage(
  () => import("../pages/legal/CookiePolicyPage"),
  "CookiePolicyPage",
);
const FaqPage = lazyPage(() => import("../pages/legal/FaqPage"), "FaqPage");
const MenuPage = lazyPage(() => import("../pages/menu/MenuPage"), "MenuPage");
const AllMenuPage = lazyPage(
  () => import("../pages/menu/AllMenuPage"),
  "AllMenuPage",
);
const CustomerOrdersPage = lazyPage(
  () => import("../pages/account/CustomerOrdersPage"),
  "CustomerOrdersPage",
);
const ReorderPage = lazyPage(
  () => import("../pages/account/ReorderPage"),
  "ReorderPage",
);
const TrackOrderPage = lazyPage(
  () => import("../pages/account/TrackOrderPage"),
  "TrackOrderPage",
);
const AdminInventoryPage = lazyPage(
  () => import("../pages/admin/AdminInventoryPage"),
  "AdminInventoryPage",
);
const AdminCategoriesPage = lazyPage(
  () => import("../pages/admin/AdminCategoriesPage"),
  "AdminCategoriesPage",
);
const AdminPromotionsPage = lazyPage(
  () => import("../pages/admin/AdminPromotionsPage"),
  "AdminPromotionsPage",
);
const AdminReportsPage = lazyPage(
  () => import("../pages/admin/AdminReportsPage"),
  "AdminReportsPage",
);
const AdminNotificationsPage = lazyPage(
  () => import("../pages/admin/AdminNotificationsPage"),
  "AdminNotificationsPage",
);
const CustomCakeRequestPage = lazyPage(
  () => import("../pages/cakes/CustomCakeRequestPage"),
  "CustomCakeRequestPage",
);
const AdminStoreOverviewPage = lazyPage(
  () => import("../pages/admin/AdminStoreOverviewPage"),
  "AdminStoreOverviewPage",
);
const AdminStoresPage = lazyPage(
  () => import("../pages/admin/AdminStoresPage"),
  "AdminStoresPage",
);
const AdminActivityPage = lazyPage(
  () => import("../pages/admin/AdminNewFeaturesPages"),
  "AdminActivityPage",
);
const AdminCakeRequestsPage = lazyPage(
  () => import("../pages/admin/AdminNewFeaturesPages"),
  "AdminCakeRequestsPage",
);
const AdminFulfillmentPage = lazyPage(
  () => import("../pages/admin/AdminNewFeaturesPages"),
  "AdminFulfillmentPage",
);
const AdminReviewsPage = lazyPage(
  () => import("../pages/admin/AdminNewFeaturesPages"),
  "AdminReviewsPage",
);
const AdminStockAlertsPage = lazyPage(
  () => import("../pages/admin/AdminNewFeaturesPages"),
  "AdminStockAlertsPage",
);
const AdminDeliveredPage = lazyPage(
  () => import("../pages/admin/AdminSalesPages"),
  "AdminDeliveredPage",
);
const AdminOrdersPage = lazyPage(
  () => import("../pages/admin/AdminSalesPages"),
  "AdminOrdersPage",
);
const AdminPaymentsPage = lazyPage(
  () => import("../pages/admin/AdminSalesPages"),
  "AdminPaymentsPage",
);
const AdminLayout = lazyPage(
  () => import("../components/admin/AdminLayout"),
  "AdminLayout",
);
const EventOrdersPage = lazyPage(
  () => import("../pages/events/EventOrdersPage"),
  "EventOrdersPage",
);
const AdminEventOrdersPage = lazyPage(
  () => import("../pages/admin/AdminEventOrdersPage"),
  "AdminEventOrdersPage",
);
const AdminChatPage = lazyPage(
  () => import("../pages/admin/AdminChatPage"),
  "AdminChatPage",
);
const AdminNewsletterPage = lazyPage(
  () => import("../pages/admin/AdminNewsletterPage"),
  "AdminNewsletterPage",
);
const UnsubscribePage = lazyPage(
  () => import("../pages/newsletter/UnsubscribePage"),
  "UnsubscribePage",
);
const AdminSubscriptionsPage = lazyPage(
  () => import("../pages/admin/AdminSubscriptionsPage"),
  "AdminSubscriptionsPage",
);
// Prompts are not needed for the first paint, so they load after the main bundle.
const InstallAppPrompt = lazyPage(
  () => import("../components/InstallAppPrompt"),
  "InstallAppPrompt",
);
const BackToTop = lazyPage(
  () => import("../components/BackToTop"),
  "BackToTop",
);
const PromotionAlertsPrompt = lazyPage(
  () => import("../components/PromotionAlerts"),
  "PromotionAlertsPrompt",
);
const CookieConsentBanner = lazyPage(
  () => import("../components/CookieConsentBanner"),
  "CookieConsentBanner",
);
const LiveChatWidget = lazyPage(
  () => import("../components/LiveChatWidget"),
  "LiveChatWidget",
);
const HomePage = lazyPage(() => import("../pages/home/HomePage"), "HomePage");

function PageLoading() {
  return <div aria-busy="true" className="min-h-[60vh]" role="status" />;
}

function AccountCreatedNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [notice, setNotice] = useState("");
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const state =
      location.state && typeof location.state === "object"
        ? (location.state as Record<string, unknown>)
        : null;
    if (!state?.accountCreated) return;

    setNotice(t("Your account was created successfully."));
    setIsLeaving(false);
    const remainingState = { ...state };
    delete remainingState.accountCreated;
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: Object.keys(remainingState).length ? remainingState : null,
    });
  }, [location, navigate, t]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setIsLeaving(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isLeaving) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 220);
    return () => window.clearTimeout(timeout);
  }, [isLeaving]);

  if (!notice) return null;
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={`fixed inset-x-3 top-3 z-[100] sm:inset-x-auto sm:right-6 sm:top-6 sm:w-[24rem] ${isLeaving ? "account-created-leave" : "account-created-enter"}`}
      role="status"
    >
      <div className="relative overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_-20px_rgba(71,42,59,0.45),0_2px_8px_rgba(71,42,59,0.08)] ring-1 ring-[#e6dfe3]">
        <div
          aria-hidden="true"
          className="h-1 bg-gradient-to-r from-brand-yellow via-brand-gold-light to-brand-yellow"
        />
        <button
          aria-label={t("Dismiss")}
          className="absolute right-2.5 top-3.5 grid size-8 place-items-center rounded-full text-[#8b95a2] transition hover:bg-[#f4f6f8] hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep"
          onClick={() => setIsLeaving(true)}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        </button>
        <div className="flex items-start gap-3.5 p-4 pr-12 sm:p-5 sm:pr-12">
          <span
            aria-hidden="true"
            className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eef7f0] text-[#2f7d4f] ring-1 ring-[#d5ebdc]"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24">
              <path
                d="m5 12.5 4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
            </svg>
            <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-brand-yellow text-brand-navy ring-2 ring-white">
              <svg className="size-3" fill="none" viewBox="0 0 24 24">
                <path
                  d="M12 3.5 14.2 9l5.8.5-4.4 3.8 1.3 5.7L12 16l-4.9 3 1.3-5.7L4 9.5 9.8 9 12 3.5Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-yellow-deep">
              {t("Welcome")}
            </p>
            <p className="mt-0.5 font-display text-[17px] font-extrabold leading-snug text-brand-navy">
              {notice}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[#65748a]">
              {t(
                "Your orders, saved addresses and rewards are now in one place.",
              )}
            </p>
          </div>
        </div>
        <div aria-hidden="true" className="h-0.5 bg-[#f1ecef]">
          <div
            className={`h-full bg-brand-yellow ${isLeaving ? "account-created-timer-leave" : "account-created-timer"}`}
          />
        </div>
      </div>
    </div>
  );
}

// The admin desk and the payment flow have their own layout and their own navigation back,
// so the floating button and consent banner would only get in the way there.
function CustomerBackToTop() {
  const { pathname } = useLocation();
  const hidden = pathname.startsWith("/admin") || pathname === "/payment";
  return hidden ? null : <BackToTop />;
}

function CustomerCookieConsent() {
  const { pathname } = useLocation();
  const hidden = pathname.startsWith("/admin") || pathname === "/payment";
  return hidden ? null : <CookieConsentBanner />;
}

// The currency switcher floats over the page content. It appears on every page except
// the admin desk (its own fixed actions live in that corner) and the sign-in and
// sign-up pages, which keep the form as the only thing on screen.
function CustomerCurrencySwitcher() {
  const { pathname } = useLocation();
  const hidden =
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/signup";
  return hidden ? null : <CurrencySwitcher />;
}

// The chat launcher appears on every page except the admin desk, where staff already
// answer from the admin inbox instead of the storefront bubble.
function CustomerLiveChat() {
  const { pathname } = useLocation();
  const hidden = pathname.startsWith("/admin");
  return hidden ? null : <LiveChatWidget />;
}

// Keeps the floating widgets' visibility in step with the hero and the footer. It sits
// here, once, rather than in each widget, so there is one scroll listener for the page.
function FloatingWidgetTracker() {
  useTrackFloatingWidgets();
  return null;
}

// French search addresses live under /fr. The router keeps every existing link and
// only adds that prefix when the visitor opened a French address.
const routerBasename =
  typeof window !== "undefined" &&
  (window.location.pathname === "/fr" || window.location.pathname.startsWith("/fr/"))
    ? "/fr"
    : undefined;

function App() {
  return (
    <LanguageProvider>
      <CurrencyProvider>
        <FlavorProvider>
          <CartProvider>
            <BrowserRouter basename={routerBasename}>
              <AccountCreatedNotice />
              <ScrollToTop />
              <ScrollProgress />
              <WebsiteLoader />
              <FloatingWidgetTracker />
              <AuthProvider>
                <AdminAuthProvider>
                  <Suspense fallback={<PageLoading />}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/flavors" element={<FlavorsPage />} />
                      <Route path="/menu" element={<MenuPage />} />
                      <Route path="/menu/all" element={<AllMenuPage />} />
                      <Route path="/treat/:categorySlug/:itemSlug" element={<MenuPage />} />
                      <Route
                        path="/custom-cake"
                        element={<CustomCakeRequestPage />}
                      />
                      <Route path="/events" element={<EventOrdersPage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/locations" element={<LocationsPage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/privacy" element={<PrivacyPolicyPage />} />
                      <Route path="/terms" element={<TermsPage />} />
                      <Route path="/refunds" element={<RefundPolicyPage />} />
                      <Route path="/faq" element={<FaqPage />} />
                      <Route path="/cookies" element={<CookiePolicyPage />} />
                      <Route path="/unsubscribe" element={<UnsubscribePage />} />
                      <Route
                        path="/flavor/:id"
                        element={<FlavorDetailPage />}
                      />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/checkout" element={<CheckoutPage />} />
                      <Route path="/payment" element={<PaymentPage />} />
                      <Route
                        path="/login"
                        element={<AuthPage mode="login" />}
                      />
                      <Route
                        path="/signup"
                        element={<AuthPage mode="signup" />}
                      />
                      <Route
                        path="/account/orders"
                        element={<CustomerOrdersPage />}
                      />
                      <Route path="/track-order" element={<TrackOrderPage />} />
                      <Route path="/reorder" element={<ReorderPage />} />
                      <Route path="/admin/login" element={<AdminLoginPage />} />
                      <Route
                        element={
                          <AdminRoute>
                            <AdminLayout />
                          </AdminRoute>
                        }
                      >
                        <Route path="/admin" element={<AdminPage />} />
                        <Route
                          path="/admin/overview"
                          element={<AdminStoreOverviewPage />}
                        />
                        <Route
                          path="/admin/stores"
                          element={<AdminStoresPage />}
                        />
                        <Route path="/admin/menu" element={<AdminMenuPage />} />
                        <Route
                          path="/admin/inventory"
                          element={<AdminInventoryPage />}
                        />
                        <Route
                          path="/admin/categories"
                          element={<AdminCategoriesPage />}
                        />
                        <Route
                          path="/admin/stock-alerts"
                          element={<AdminStockAlertsPage />}
                        />
                        <Route
                          path="/admin/fulfillment"
                          element={<AdminFulfillmentPage />}
                        />
                        <Route
                          path="/admin/activity"
                          element={<AdminActivityPage />}
                        />
                        <Route
                          path="/admin/promotions"
                          element={<AdminPromotionsPage />}
                        />
                        <Route
                          path="/admin/newsletter"
                          element={<AdminNewsletterPage />}
                        />
                        <Route
                          path="/admin/reports"
                          element={<AdminReportsPage />}
                        />
                        <Route
                          path="/admin/reviews"
                          element={<AdminReviewsPage />}
                        />
                        <Route
                          path="/admin/cake-requests"
                          element={<AdminCakeRequestsPage />}
                        />
                        <Route
                          path="/admin/events"
                          element={<AdminEventOrdersPage />}
                        />
                        <Route
                          path="/admin/orders"
                          element={<AdminOrdersPage />}
                        />
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
                        <Route path="/admin/chat" element={<AdminChatPage />} />
                        <Route
                          path="/admin/subscriptions"
                          element={<AdminSubscriptionsPage />}
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
                  <CustomerCurrencySwitcher />
                  <CustomerLiveChat />
                  <CustomerCookieConsent />
                  <CustomerBackToTop />
                  <RouteMeta />
                </AdminAuthProvider>
              </AuthProvider>
            </BrowserRouter>
          </CartProvider>
        </FlavorProvider>
      </CurrencyProvider>
    </LanguageProvider>
  );
}

export default App;
