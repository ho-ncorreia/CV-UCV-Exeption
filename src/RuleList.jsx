import { useEffect, useState } from 'react';
import { api } from './api.js';

const fmt = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '');

export default function RuleList({ lookups, onCreate, onEdit, onCopy, onMessage }) {
  const [rules, setRules] = useState(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');

  const load = () =>
    api.get('/api/rules').then(setRules).catch((e) => onMessage({ type: 'error', text: e.message }));

  useEffect(() => {
    load();
  }, []);

  const nameOf = (table, code) => lookups[table].find((x) => x.code === code)?.name ?? '';

  const remove = async (rule) => {
    if (!window.confirm(`Delete rule ${rule.id}?`)) return;
    try {
      await api.del(`/api/rules/${rule.id}`);
      onMessage({ type: 'success', text: `Rule ${rule.id} has been deleted` });
      load();
    } catch (e) {
      onMessage({ type: 'error', text: e.message });
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = (rules ?? [])
    .filter((r) => status === 'All' || r.status === status)
    .filter(
      (r) =>
        !q ||
        [r.id, r.type, r.carrier, r.salesCreditBp, nameOf('businessPartners', r.salesCreditBp),
          r.contractNumber, r.polZone, r.podZone, r.destCountry, r.comments]
          .some((v) => String(v ?? '').toLowerCase().includes(q))
    );

  return (
    <section className="section">
      <div className="list-toolbar">
        <h2 className="list-title">Rules ({filtered.length})</h2>
        <input
          className="size-xl"
          placeholder="Search ID, BP, contract, zone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <button className="btn" onClick={load}>Refresh</button>
        <button className="btn" onClick={() => window.open('/?view=export', '_blank', 'noopener')}>
          Export Excel
        </button>
        <button className="btn primary" onClick={onCreate}>+ Create</button>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>ID</th><th>Status</th><th>Type</th><th>Carrier</th><th>Sales Credit BP</th>
            <th>Contract</th><th>POL</th><th>POD</th><th>Dest.</th>
            <th>Effective</th><th>Expire</th><th>Last update</th><th className="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} onClick={() => onEdit(r)}>
              <td className="link">{r.id}</td>
              <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
              <td>{r.type}</td>
              <td>{nameOf('carriers', r.carrier) || r.carrier}</td>
              <td>{r.salesCreditBp} <span className="desc">{nameOf('businessPartners', r.salesCreditBp)}</span></td>
              <td>{r.contractNumber}</td>
              <td>{r.polZone}</td>
              <td>{r.podZone}</td>
              <td>{r.destCountry}</td>
              <td>{fmt(r.effectiveDate)}</td>
              <td>{fmt(r.expireDate)}</td>
              <td>{fmt(r.lastUpdate)}</td>
              <td className="actions" onClick={(e) => e.stopPropagation()}>
                <button className="row-btn" onClick={() => onEdit(r)}>Edit</button>
                <button className="row-btn" onClick={() => onCopy(r)}>Copy</button>
                <button className="row-btn danger" onClick={() => remove(r)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rules && filtered.length === 0 && <p className="empty">No rules found</p>}
      {!rules && <p className="loading">Loading...</p>}
    </section>
  );
}
