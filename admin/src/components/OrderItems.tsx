/* ==================================================================
   ITENS E TOTAIS — snapshot imutável do pedido.
   Somente leitura: o painel nunca altera itens nem valores.
   ================================================================== */

import { formatCurrency } from '../lib/format'
import { paymentMethodLabel, type Order, type OrderItem } from '../lib/orders'

const CATEGORY_LABEL: Record<string, string> = {
  salgadas: 'Salgada',
  doces: 'Doce',
}

function categoryLabel(category: string | null): string | null {
  if (!category) return null
  return CATEGORY_LABEL[category] ?? null
}

export function OrderItems({ order }: { order: Order }) {
  return (
    <div className="order-items">
      {order.items.length === 0 ? (
        <p className="order-items__empty">
          Este pedido não tem itens registrados.
        </p>
      ) : (
        <>
          <div className="order-items__head" aria-hidden="true">
            <span>Item</span>
            <span>Qtd</span>
            <span>Unitário</span>
            <span>Subtotal</span>
          </div>

          <ul className="order-items__list">
            {order.items.map((item, index) => (
              <OrderItemRow
                key={`${item.id}-${index}`}
                item={item}
              />
            ))}
          </ul>
        </>
      )}

      <dl className="order-totals">
        <div className="order-totals__row">
          <dt>Quantidade de itens</dt>
          <dd>{order.totalItems}</dd>
        </div>
        <div className="order-totals__row">
          <dt>Forma de pagamento</dt>
          <dd>{paymentMethodLabel(order.paymentMethod)}</dd>
        </div>
        <div className="order-totals__row order-totals__row--total">
          <dt>Total</dt>
          <dd>{formatCurrency(order.totalAmount)}</dd>
        </div>
      </dl>
    </div>
  )
}

function OrderItemRow({ item }: { item: OrderItem }) {
  const category = categoryLabel(item.category)

  return (
    <li className="order-item">
      <span className="order-item__name">
        {item.name}
        {category && (
          <span className="order-item__category">{category}</span>
        )}
      </span>

      <span className="order-item__qty">
        <span className="sr-only">Quantidade: </span>
        {item.quantity}×
      </span>

      <span className="order-item__price">
        <span className="sr-only">Preço unitário: </span>
        {formatCurrency(item.unitPrice)}
      </span>

      <span className="order-item__subtotal">
        <span className="sr-only">Subtotal: </span>
        {formatCurrency(item.totalPrice)}
      </span>
    </li>
  )
}
