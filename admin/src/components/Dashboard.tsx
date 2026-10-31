import { useEffect, useRef, useState, useTransition } from 'react'
import {
  ORDER_STATUSES,
  STATUS_META,
  type Order,
  type OrderStatusValue,
} from '../lib/orders'
import {
  subscribeOrders,
  fetchStatusCounts,
  DEFAULT_PAGE_SIZE,
} from '../lib/orderService'
import {
  filterOrders,
  sortOrders,
  PERIOD_OPTIONS,
  SORT_OPTIONS,
  type PeriodPreset,
  type OrderSort,
  type OrderStatusFilter,
} from '../lib/query'
import { formatCurrency, formatDateTime, formatPhone, shortOrderId } from '../lib/format'
import { useToast } from './Toast'
import { ErrorState } from './ErrorState'

export function Dashboard() {
  const { show: showToast } = useToast()

  // Estados de consulta e filtros
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('todos')
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('today')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortBy, setSortBy] = useState<OrderSort>('recent')
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  // Dados do Firestore
  const [orders, setOrders] = useState<Order[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<OrderStatusValue, number>>({
    pendente: 0,
    em_preparacao: 0,
    pronto: 0,
    entregue: 0,
    cancelado: 0,
    desconhecido: 0,
  })
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Referência para detectar novos pedidos (toast)
  const knownOrderIdsRef = useRef<Set<string>>(new Set())
  const isInitialLoadRef = useRef<boolean>(true)

  // Carrega contagens de status
  useEffect(() => {
    let active = true
    fetchStatusCounts()
      .then((counts) => {
        if (active) {
          setStatusCounts({
            ...counts,
            desconhecido: 0,
          })
        }
      })
      .catch(() => {
        // Falhas pontuais nas contagens não travam o dashboard
      })

    const interval = setInterval(() => {
      fetchStatusCounts()
        .then((counts) => {
          if (active) {
            setStatusCounts({
              ...counts,
              desconhecido: 0,
            })
          }
        })
        .catch(() => {})
    }, 30000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  // Sincroniza em tempo real com base no período e status selecionados
  useEffect(() => {
    setLoading(true)
    setError(null)

    // Calcula startAt/endAt se necessário para a query do Firestore
    let startAtDate: Date | null = null
    let endAtDate: Date | null = null

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayMs = 24 * 60 * 60 * 1000

    if (periodPreset === 'today') {
      startAtDate = todayStart
      endAtDate = new Date(todayStart.getTime() + dayMs - 1)
    } else if (periodPreset === '7d') {
      startAtDate = new Date(todayStart.getTime() - 6 * dayMs)
      endAtDate = new Date(todayStart.getTime() + dayMs - 1)
    } else if (periodPreset === '30d') {
      startAtDate = new Date(todayStart.getTime() - 29 * dayMs)
      endAtDate = new Date(todayStart.getTime() + dayMs - 1)
    } else if (periodPreset === 'custom') {
      if (customStart) startAtDate = new Date(`${customStart}T00:00:00`)
      if (customEnd) endAtDate = new Date(`${customEnd}T23:59:59`)
    }

    const unsubscribe = subscribeOrders(
      {
        status: statusFilter,
        startAt: startAtDate,
        endAt: endAtDate,
        pageSize,
      },
      (fetchedOrders) => {
        startTransition(() => {
          // Detecta novos pedidos para o Toast
          if (!isInitialLoadRef.current) {
            const newOrders = fetchedOrders.filter(
              (o) => !knownOrderIdsRef.current.has(o.id),
            )
            if (newOrders.length > 0) {
              const latest = newOrders[0]
              showToast({
                title: 'Novo pedido recebido! 🍕',
                message: `${latest.customerName} (${formatCurrency(latest.totalAmount)})`,
                type: 'success',
              })
            }
          }

          // Atualiza conjunto conhecido
          knownOrderIdsRef.current = new Set(fetchedOrders.map((o) => o.id))
          isInitialLoadRef.current = false

          setOrders(fetchedOrders)
          setLoading(false)
        })
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [statusFilter, periodPreset, customStart, customEnd, pageSize, showToast])

  // Filtra localmente por busca e ordena
  const filteredOrders = filterOrders(orders, {
    status: statusFilter,
    period: periodPreset,
    startDate: customStart,
    endDate: customEnd,
    search: searchTerm,
  })

  const sortedOrders = sortOrders(filteredOrders, sortBy)
  const totalGeneralCount = Object.values(statusCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="dashboard-page">
      <section className="page-head">
        <div>
          <p className="eyebrow">Gestão operacional</p>
          <h1 className="page-title">Painel de Pedidos</h1>
          <p className="page-subtitle">
            Acompanhe pedidos em tempo real, gerencie o fluxo de preparo e filtre por status ou período.
          </p>
        </div>
      </section>

      {/* Cards de Status (Indicadores) */}
      <div className="status-cards">
        <button
          className={`status-card ${statusFilter === 'todos' ? 'status-card--active' : ''}`}
          onClick={() => setStatusFilter('todos')}
        >
          <div className="status-card__header">
            <span className="status-card__label">Todos</span>
          </div>
          <div className="status-card__count">{totalGeneralCount}</div>
          <span className="status-card__desc">Geral no período</span>
        </button>

        {ORDER_STATUSES.map((status) => {
          const meta = STATUS_META[status]
          const count = statusCounts[status] ?? 0
          const isActive = statusFilter === status

          return (
            <button
              key={status}
              data-tone={status}
              className={`status-card ${isActive ? 'status-card--active' : ''}`}
              onClick={() => setStatusFilter(isActive ? 'todos' : status)}
            >
              <div className="status-card__header">
                <span className="status-card__label">{meta.label}</span>
              </div>
              <div className="status-card__count">{count}</div>
              <span className="status-card__desc">{meta.description}</span>
            </button>
          )
        })}
      </div>

      {/* Barra de Filtros, Busca e Ordenação */}
      <div className="orders-toolbar">
        <div className="orders-toolbar__row">
          <div className="orders-search">
            <span className="orders-search__icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="orders-search__input"
              placeholder="Buscar por cliente, telefone ou #ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar pedidos"
            />
          </div>

          <div className="orders-filter-group">
            <select
              className="orders-select"
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
              aria-label="Filtrar por período"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Período: {opt.label}
                </option>
              ))}
            </select>

            <select
              className="orders-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as OrderSort)}
              aria-label="Ordenar pedidos"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Ordenar: {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {periodPreset === 'custom' && (
          <div className="orders-toolbar__row orders-custom-date">
            <span>De:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              aria-label="Data inicial"
            />
            <span>Até:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              aria-label="Data final"
            />
          </div>
        )}
      </div>

      {/* Erro de conexão/permissão */}
      {error && (
        <ErrorState
          title="Erro ao carregar pedidos"
          message={error}
          hint="Verifique sua conexão ou se as regras do Firestore estão publicadas."
          onRetry={() => window.location.reload()}
        />
      )}

      {/* Conteúdo principal: Tabela (Desktop) e Cards (Mobile) */}
      {!error && (
        <>
          {loading && orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden="true">⏳</div>
              <h2 className="empty-state__title">Carregando pedidos...</h2>
              <p className="empty-state__text">Sincronizando com o Firestore em tempo real.</p>
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden="true">📭</div>
              <h2 className="empty-state__title">Nenhum pedido encontrado</h2>
              <p className="empty-state__text">
                {searchTerm || statusFilter !== 'todos'
                  ? 'Tente limpar a busca ou os filtros para ver mais resultados.'
                  : 'Nenhum pedido registrado no período selecionado.'}
              </p>
              {(searchTerm || statusFilter !== 'todos') && (
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('todos')
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Tabela Desktop */}
              <div className="orders-table-wrapper">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Horário</th>
                      <th>Cliente</th>
                      <th>Contato</th>
                      <th>Itens</th>
                      <th>Total</th>
                      <th>Pagamento</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((order) => {
                      const isPending = order.status === 'pendente'
                      const statusMeta = STATUS_META[order.status]

                      return (
                        <tr
                          key={order.id}
                          className={isPending ? 'order-row--pending' : ''}
                        >
                          <td className="order-id-cell">{shortOrderId(order.id)}</td>
                          <td>{formatDateTime(order.createdAt)}</td>
                          <td>
                            <strong>{order.customerName}</strong>
                          </td>
                          <td>{formatPhone(order.customerContact)}</td>
                          <td>{order.totalItems} it.</td>
                          <td>
                            <strong>{formatCurrency(order.totalAmount)}</strong>
                          </td>
                          <td>
                            <span className="badge badge--neutral">
                              {order.paymentMethod ? order.paymentMethod.toUpperCase() : '—'}
                            </span>
                          </td>
                          <td>
                            <span
                              className="status-badge"
                              data-status={order.status}
                            >
                              <span className="badge__dot" aria-hidden="true" />
                              {statusMeta.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cartões Mobile */}
              <div className="orders-cards-list">
                {sortedOrders.map((order) => {
                  const isPending = order.status === 'pendente'
                  const statusMeta = STATUS_META[order.status]

                  return (
                    <div
                      key={order.id}
                      className={`order-card ${isPending ? 'order-card--pending' : ''}`}
                    >
                      <div className="order-card__header">
                        <span className="order-id-cell">{shortOrderId(order.id)}</span>
                        <span className="status-badge" data-status={order.status}>
                          <span className="badge__dot" aria-hidden="true" />
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="order-card__body">
                        <div className="order-card__customer">{order.customerName}</div>
                        <div className="order-card__meta">
                          <span>📅 {formatDateTime(order.createdAt)}</span>
                          <span>📞 {formatPhone(order.customerContact)}</span>
                        </div>
                      </div>
                      <div className="order-card__footer">
                        <span>{order.totalItems} itens ({order.paymentMethod ? order.paymentMethod.toUpperCase() : '—'})</span>
                        <strong>{formatCurrency(order.totalAmount)}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Carregar Mais */}
              <div className="orders-load-more">
                <button
                  className="btn"
                  onClick={() => setPageSize((prev) => prev + 50)}
                >
                  Carregar mais pedidos (atual: {sortedOrders.length})
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}