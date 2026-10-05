import { useState } from 'react';

export default function ValueHelpDialog({ title, items, columns, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const q = query.toLowerCase();
  const filtered = items.filter((it) =>
    columns.some((c) => String(it[c.key] ?? '').toLowerCase().includes(q))
  );

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <header className="dialog-header">
          <span>Select: {title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="dialog-body">
          <input
            className="search"
            autoFocus
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <table className="grid">
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.code} onClick={() => onSelect(it.code)}>
                  {columns.map((c) => <td key={c.key}>{it[c.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="empty">No data found</p>}
        </div>
      </div>
    </div>
  );
}
