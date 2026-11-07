import './primitives.css';

/**
 * Dense data table. On phones each row becomes a stacked card, using `header` as the row label.
 * columns: [{ key, header, render?(row), align?: 'right', primary?: true }]  (mark one column primary: it leads the row)
 */
export default function Table({ columns, rows, rowKey = (r) => r.id, onRowClick, empty = null }) {
  if (!rows?.length) return empty;
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>{columns.map(c => <th key={c.key} className={c.align === 'right' ? 'is-num' : ''} scope="col">{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)} data-click={onRowClick ? '1' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}>
              {columns.map(c => (
                <td key={c.key} data-label={c.header} data-primary={c.primary ? '1' : undefined} className={c.align === 'right' ? 'is-num' : ''}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
