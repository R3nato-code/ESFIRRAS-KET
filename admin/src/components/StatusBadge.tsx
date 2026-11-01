import { OrderStatusValue, statusLabel } from '../lib/orders';

export function StatusBadge({ status }: { status: OrderStatusValue }) {
  return (
    <span
      className="status-badge"
      data-status={status}
      aria-label={statusLabel(status)}
    >
      {statusLabel(status).toUpperCase()}
    </span>
  );
}
