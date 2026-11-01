import { formatCurrency, formatTime, shortOrderId } from '../lib/format';
import type { Order } from '../lib/orders';
import { StatusBadge } from './StatusBadge';

interface OrderCardProps {
  order: Order;
  onSelect: (order: Order) => void;
}

export function OrderCard({ order, onSelect }: OrderCardProps) {
  const time = order.createdAt ? formatTime(order.createdAt) : '--:--';

  return (
    <article className="order-card">
      <button
        type="button"
        className={`order-card__button ${
          order.status === 'pendente' ? 'order-card__button--pending' : ''
        }`}
        onClick={() => onSelect(order)}
        aria-label={`Abrir pedido ${shortOrderId(order.id)} de ${order.customerName}`}
      >
        <span className="order-card__header">
          <span className="order-id-cell">{shortOrderId(order.id)}</span>
          <StatusBadge status={order.status} />
        </span>

        <span className="order-card__body">
          <span className="order-card__customer">{order.customerName}</span>
          <span className="order-card__meta">
            <span>{time}</span>
            <span>
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </span>
          </span>
        </span>

        <span className="order-card__footer">
          <span className="order-card__footer-label">Total</span>
          <span className="order-card__footer-value">
            {formatCurrency(order.totalAmount)}
          </span>
        </span>
      </button>
    </article>
  );
}
