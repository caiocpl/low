import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortKey?: string;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
}

/**
 * Tabela de dados acessível com cabeçalho fixo e ordenação. Em telas estreitas,
 * a página deve fornecer `mobileRender` para exibir cartões em vez de colunas.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSort,
  caption,
  mobileRender,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sort?: string;
  onSort?: (key: string) => void;
  caption: string;
  mobileRender?: (row: T) => ReactNode;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <>
      <div className="table-wrap desktop-table">
        <table className="table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: c.align }} aria-sort={c.sortKey && sort === c.sortKey ? 'descending' : undefined} scope="col">
                  {c.sortKey && onSort ? (
                    <button type="button" onClick={() => onSort(c.sortKey as string)}>
                      {c.header}
                      <Icon name={sort === c.sortKey ? 'chevronDown' : 'chevronRight'} size={12} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                className={onRowClick ? 'clickable' : undefined}
                onClick={onRowClick ? (e) => {
                  if ((e.target as HTMLElement).closest('a,button')) return;
                  onRowClick(r);
                } : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobileRender ? <div className="mobile-cards">{rows.map((r) => <div key={rowKey(r)}>{mobileRender(r)}</div>)}</div> : null}
    </>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pagination">
      <span aria-live="polite">
        {total === 0 ? 'Nenhum registro' : `${from}–${to} de ${total} registro(s)`}
      </span>
      <div className="row">
        <Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </Button>
        <span className="subtle">
          Página {page} de {pages}
        </span>
        <Button size="sm" iconRight="chevronRight" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Próxima
        </Button>
      </div>
    </div>
  );
}
