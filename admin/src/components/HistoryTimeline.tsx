/* ==================================================================
   LINHA DO TEMPO — histórico append-only + evento inicial sintético.
   O evento "Pedido recebido pelo site" é derivado de `createdAt` e
   nunca é gravado no banco, mantendo compatibilidade com pedidos
   anteriores ao histórico.
   ================================================================== */

import { useMemo } from 'react'
import type { AppErrorInfo } from '../lib/errors'
import { formatDateTime, formatRelativeTime } from '../lib/format'
import { buildTimeline, type TimelineEntry } from '../lib/timeline'
import type { Order, OrderHistoryEntry } from '../lib/orders'

interface HistoryTimelineProps {
  order: Order
  entries: OrderHistoryEntry[]
  loading: boolean
  error: AppErrorInfo | null
  onRetry?: () => void
}

export function HistoryTimeline({
  order,
  entries,
  loading,
  error,
  onRetry,
}: HistoryTimelineProps) {
  const timeline = useMemo(
    () => buildTimeline(order, entries),
    [order, entries],
  )

  if (error) {
    return (
      <div className="notice notice--warning" role="alert">
        <div>
          <strong className="notice__title">Não foi possível carregar o histórico</strong>
          {error.message}
          {onRetry && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onRetry}
              style={{ marginTop: 'var(--space-2)' }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <ol className="timeline" aria-label="Histórico de alterações do pedido">
      {loading && entries.length === 0 ? (
        <li className="timeline__entry timeline__entry--last" aria-hidden="true">
          <span className="timeline__dot" />
          <div className="timeline__content">
            <span className="timeline__skeleton" />
            <span className="timeline__skeleton timeline__skeleton--short" />
          </div>
        </li>
      ) : (
        timeline.map((entry, index) => (
          <TimelineRow
            key={entry.id}
            entry={entry}
            isLast={index === timeline.length - 1}
          />
        ))
      )}
    </ol>
  )
}

function TimelineRow({
  entry,
  isLast,
}: {
  entry: TimelineEntry
  isLast: boolean
}) {
  return (
    <li
      className={`timeline__entry ${isLast ? 'timeline__entry--last' : ''}`}
      data-kind={entry.kind}
    >
      <span className="timeline__dot" aria-hidden="true" />

      <div className="timeline__content">
        <div className="timeline__heading">
          <span className="timeline__title">{entry.title}</span>
          {entry.synthetic && (
            <span className="timeline__tag">registro inicial</span>
          )}
        </div>

        {entry.detail && (
          <span className="timeline__detail">{entry.detail}</span>
        )}

        <span className="timeline__meta">
          <time dateTime={entry.timestamp?.toISOString()}>
            {entry.timestamp
              ? formatDateTime(entry.timestamp)
              : 'Data não registrada'}
          </time>
          {entry.timestamp && (
            <span className="timeline__relative">
              {formatRelativeTime(entry.timestamp)}
            </span>
          )}
          {entry.actor && (
            <span title={entry.actor.uid}>
              por {entry.actor.email || 'administrador'}
            </span>
          )}
          {entry.synthetic && <span>sem usuário responsável</span>}
        </span>

        {entry.reason && (
          <p className="timeline__reason">
            <span className="timeline__reason-label">Motivo:</span>{' '}
            {entry.reason}
          </p>
        )}
      </div>
    </li>
  )
}
