import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ORDER_STATUSES,
  STATUS_META,
  type Order,
  type OrderStatusValue,
} from '../lib/orders';
import { fetchStatusCounts, subscribeOrders } from '../lib/orderService';
import { orderMatchesSearch, resolvePeriodRange } from '../lib/query';
import { OrderList } from './OrdersTable';
import { OrderCard } from './OrderCard';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { ErrorState } from './ErrorState';

const INITIAL_PAGE_SIZE = 50;
const PAGE_INCREMENT = 50;

export function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<OrderStatusValue, number>>(
    () =>
      ({
        ...Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])),
        desconhecido: 0,
      }) as Record<OrderStatusValue, number>,
  );

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatusValue | 'todos'>('todos');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageSize, setPageSize] = useState(INITIAL_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);

  // Bordas do período em horário de Brasília (evita deslocamento de um
  // dia ao interpretar `input[type=date]` como UTC).
  const period = useMemo(
    () => resolvePeriodRange('custom', { startDate, endDate }),
    [startDate, endDate],
  );

  // Lista em tempo real. Filtros de status/período rodam no servidor.
  useEffect(() => {
    return subscribeOrders(
      {
        status: statusFilter,
        startAt: period.start,
        endAt: period.end,
        pageSize,
      },
      (nextOrders) => {
        setOrders(nextOrders);
        setError(null);
      },
      (err) => setError(err.message || 'Erro ao carregar pedidos'),
    );
  }, [statusFilter, period.start, period.end, pageSize]);

  // Contagens são totais gerais por status. Recarregam quando a lista
  // muda (novo pedido ou status alterado) com debounce para não disparar
  // cinco consultas a cada evento.
  const ordersSignature = orders
    .map((order) => `${order.id}:${order.status}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      fetchStatusCounts()
        .then((nextCounts) => {
          if (cancelled) return;
          setCounts((previous) => ({
            ...previous,
            ...nextCounts,
            desconhecido: previous.desconhecido,
          }));
        })
        .catch(() => {
          // Contagens são complementares: a lista continua funcionando.
        });
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ordersSignature]);

  const filteredOrders = orders.filter((order) =>
    orderMatchesSearch(order, search),
  );

  const handleLoadMore = useCallback(() => {
    setPageSize((previous) => previous + PAGE_INCREMENT);
  }, []);

  const handleSelect = useCallback((order: Order) => {
    setSelectedOrder(order);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter('todos');
    setSearch('');
    setStartDate('');
    setEndDate('');
  }, []);

  const hasActiveFilters =
    statusFilter !== 'todos' ||
    search.trim() !== '' ||
    startDate !== '' ||
    endDate !== '';

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <div className="eyebrow">Foxy Esfirras · Pedidos</div>
          <h1 className="page-title">Gestão de pedidos</h1>
          <p className="page-subtitle">
            Acompanhe, filtre e altere o status dos pedidos em tempo real.
          </p>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Não foi possível carregar os pedidos"
          message={error}
          hint="Verifique se as regras do Firestore foram publicadas e se você está autenticado como admin."
          onRetry={() => window.location.reload()}
          retryLabel="Recarregar página"
        />
      )}

      <div className="status-cards">
        {ORDER_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const count = counts[status] ?? 0;
          const isActive = statusFilter === status;

          return (
            <button
              key={status}
              type="button"
              className={`status-card ${isActive ? 'status-card--active' : ''}`}
              data-tone={status}
              aria-pressed={isActive}
              onClick={() =>
                setStatusFilter(isActive ? 'todos' : status)
              }
            >
              <span className="status-card__header">
                <span className="status-card__label">{meta.label}</span>
              </span>
              <span className="status-card__count">{count}</span>
              <span className="status-card__desc">
                {isActive ? 'Clique para ver todos' : meta.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="orders-toolbar">
        <div className="orders-toolbar__row">
          <div className="orders-search">
            <span className="orders-search__icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              className="orders-search__input"
              placeholder="Buscar por nome, contato ou ID…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar pedidos por nome, contato ou ID"
            />
          </div>

          <div className="orders-filter-group">
            <select
              className="orders-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as OrderStatusValue | 'todos')
              }
              aria-label="Filtrar por status"
            >
              <option value="todos">Todos os status</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </select>

            <div className="orders-custom-date">
              <label>
                De
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  aria-label="Data inicial"
                />
              </label>
              <label>
                até
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  aria-label="Data final"
                />
              </label>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={clearFilters}
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="orders-empty">
          <div className="orders-empty__icon" aria-hidden="true">
            📭
          </div>
          <h2 className="orders-empty__title">Nenhum pedido encontrado</h2>
          <p className="orders-empty__text">
            {hasActiveFilters
              ? 'Tente ajustar os filtros de busca, status ou período.'
              : 'Ainda não há pedidos registrados.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={clearFilters}
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <OrderList orders={filteredOrders} onSelectOrder={handleSelect} />

          <div className="orders-cards-list">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onSelect={handleSelect}
              />
            ))}
          </div>

          <div className="orders-load-more">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleLoadMore}
            >
              Carregar mais ({pageSize} → {pageSize + PAGE_INCREMENT})
            </button>
          </div>
        </>
      )}

      {selectedOrder && (
        <OrderDetailDrawer
          key={selectedOrder.id}
          order={selectedOrder}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
