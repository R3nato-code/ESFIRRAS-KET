import { formatCurrency, formatDateTime, shortOrderId } from '../lib/format';
import type { Order } from '../lib/orders';
import { StatusBadge } from './StatusBadge';

export function OrderList({
  orders,
  onSelectOrder,
}: {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <div
      className="orders-table-wrapper"
      role="region"
      aria-label="Lista de pedidos"
    >
      <table className="orders-table">
        <caption className="sr-only">
          Pedidos carregados. Use o botão de cada linha para abrir os detalhes.
        </caption>
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col">Cliente</th>
            <th scope="col">Status</th>
            <th scope="col">Data / hora</th>
            <th scope="col" className="orders-table__amount">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className={order.status === 'pendente' ? 'order-row--pending' : undefined}
            >
              <td>
                <button
                  type="button"
                  className="orders-table__select"
                  onClick={() => onSelectOrder(order)}
                  aria-label={`Abrir pedido ${shortOrderId(order.id)} de ${order.customerName}`}
                >
                  {shortOrderId(order.id)}
                </button>
              </td>
              <td>
                <span className="order-card__customer">{order.customerName}</span>
              </td>
              <td>
                <StatusBadge status={order.status} />
              </td>
              <td>
                <span className="orders-table__date">
                  {order.createdAt ? formatDateTime(order.createdAt) : 'Processando data'}
                </span>
              </td>
              <td className="orders-table__amount">
                {formatCurrency(order.totalAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
