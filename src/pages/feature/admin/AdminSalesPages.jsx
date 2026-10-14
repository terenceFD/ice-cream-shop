import { AdminPaymentsDashboard } from "./AdminPaymentsDashboard";
import { AdminOrdersBoard } from "./AdminOrdersBoard";
import { AdminDeliveredBoard } from "./AdminDeliveredBoard";

export function AdminOrdersPage() {
  return <AdminOrdersBoard />;
}

export function AdminDeliveredPage() {
  return <AdminDeliveredBoard />;
}

export function AdminPaymentsPage() {
  return <AdminPaymentsDashboard />;
}
