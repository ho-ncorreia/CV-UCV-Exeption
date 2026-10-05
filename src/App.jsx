import { useEffect, useState } from 'react';
import { api } from './api.js';
import ValueHelpDialog from './ValueHelpDialog.jsx';
import RuleList from './RuleList.jsx';
import ExportTask from './ExportTask.jsx';

// Mock logged-in user (no authentication in this local demo)
const CURRENT_USER = { id: 'S00000001', name: 'Demo User' };

const EMPTY = {
  id: '', status: 'Active', type: 'DSC_BB', blSpecific: 'No', carrier: '00000000',
  effectiveDate: '', expireDate: '', requestorBranch: '', comments: '',
  salesCreditBp: '', contractHolder: '', contractNumber: '',
  bookingOffice: '', polZone: '', originCountry: '', originPoint: '',
  podZone: '', destCountry: '', destPoint: '',
  shipperBp: '', forwarderBp: '', consigneeBp: '', notifyBp: '', blNumber: '',
  requestorId: '', requestorName: '', createDate: '', lastUpdate: '',
};

const newRule = () => ({
  ...EMPTY,
  requestorId: CURRENT_USER.id,
  requestorName: CURRENT_USER.name,
  createDate: new Date().toISOString(),
});

const HELP = {
  types: { title: 'Type', columns: [{ key: 'code', label: 'Type' }, { key: 'name', label: 'Description' }, { key: 'activity', label: 'Activity' }] },
  carriers: { title: 'Carrier', columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }] },
  branches: { title: 'Sales Branch', columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }] },
  businessPartners: { title: 'Business Partner', columns: [{ key: 'code', label: 'BP' }, { key: 'name', label: 'Name' }, { key: 'territory', label: 'Territory' }] },
  contracts: { title: 'Contract', columns: [{ key: 'code', label: 'Contract' }, { key: 'name', label: 'Description' }, { key: 'holder', label: 'Holder' }] },
  offices: { title: 'Booking Office', columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }] },
  zones: { title: 'Trigram Zone', columns: [{ key: 'code', label: 'Trigram' }, { key: 'name', label: 'Zone' }] },
  countries: { title: 'Country', columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Country' }] },
  points: { title: 'Point', columns: [{ key: 'code', label: 'UN/LOCODE' }, { key: 'name', label: 'Name' }, { key: 'country', label: 'Country' }] },
};

const fmtDate = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '');

function Field({ label, required, error, children, muted }) {
  return (
    <div className="field">
      <label className={`${required ? 'req' : ''} ${muted ? 'muted' : ''} ${error ? 'has-error' : ''}`}>
        {label}
      </label>
      <div className="control" title={error || ''}>
        {children}
        {error && <div className="error-text">{error}</div>}
      </div>
    </div>
  );
}

function LookupInput({ value, onChange, onHelp, error, size = 'm' }) {
  return (
    <div className={`lookup size-${size} ${error ? 'error' : ''}`}>
      <input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <button type="button" className="vh-btn" onClick={onHelp} aria-label="Value help">
        <svg viewBox="0 0 16 16" width="13" height="13"><path d="M6 2H2v12h12v-4M9 2h5v5M14 2 7 9" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
    </div>
  );
}

function ReadOnly({ value, size = 'm', placeholder }) {
  return <input className={`ro size-${size}`} readOnly value={value} placeholder={placeholder} tabIndex={-1} />;
}

export default function App() {
  const [lookups, setLookups] = useState(null);
  const [form, setForm] = useState(newRule);
  const [searchId, setSearchId] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [help, setHelp] = useState(null);
  const [view, setView] = useState(() =>
    new URLSearchParams(window.location.search).get('view') === 'export' ? 'export' : 'list'
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/lookups').then(setLookups).catch((e) => setMessage({ type: 'error', text: `Cannot reach API: ${e.message}` }));
  }, []);

  const find = (table, code) => lookups?.[table]?.find((x) => x.code === code);
  const nameOf = (table, code) => find(table, code)?.name ?? '';

  const set = (field) => (value) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'contractNumber' && !f.contractHolder) {
        const contract = lookups?.contracts.find((c) => c.code === value);
        if (contract) next.contractHolder = contract.holder;
      }
      if (field === 'blSpecific' && value === 'No') next.blNumber = '';
      return next;
    });
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const lookup = (field, table, size, extra = {}) => (
    <LookupInput
      value={form[field]}
      onChange={set(field)}
      error={errors[field]}
      size={size}
      onHelp={() => setHelp({ field, table, ...extra })}
    />
  );

  const loadRule = (rule) => {
    setForm({ ...EMPTY, ...rule });
    setSearchId(rule.id);
    setErrors({});
    setMessage(null);
    setView('form');
  };

  const copyRule = (rule) => {
    loadRule({ ...newRule(), ...rule, id: '', requestorId: CURRENT_USER.id, requestorName: CURRENT_USER.name, createDate: new Date().toISOString(), lastUpdate: '' });
    setSearchId('');
    setMessage({ type: 'info', text: `Copy of rule ${rule.id} - save to create a new rule` });
  };

  const backToList = () => {
    setErrors({});
    setMessage(null);
    setView('list');
  };

  const openById = async () => {
    if (!searchId.trim()) return;
    try {
      loadRule(await api.get(`/api/rules/${encodeURIComponent(searchId.trim())}`));
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const createNew = () => {
    setForm(newRule());
    setSearchId('');
    setErrors({});
    setMessage(null);
    setView('form');
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const saved = form.id
        ? await api.put(`/api/rules/${form.id}`, form)
        : await api.post('/api/rules', form);
      loadRule(saved);
      setMessage({ type: 'success', text: `Rule ${saved.id} has been saved` });
    } catch (e) {
      setErrors(e.errors || {});
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id || !window.confirm(`Delete rule ${form.id}?`)) return;
    try {
      await api.del(`/api/rules/${form.id}`);
      const id = form.id;
      backToList();
      setMessage({ type: 'success', text: `Rule ${id} has been deleted` });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const scBp = find('businessPartners', form.salesCreditBp);
  const contract = find('contracts', form.contractNumber);
  const activity = find('types', form.type)?.activity ?? '';

  const helpItems = help
    ? lookups[help.table].filter((it) => !help.country || it.country === help.country)
    : [];

  return (
    <div className="app">
      <header className="shellbar">
        <div className="brand">
          <span className="logo">CMA&nbsp;CGM</span>
        </div>
        <div className="title">Sales Credit Rules</div>
        <div className="user">{CURRENT_USER.name}</div>
      </header>

      <nav className="tabs">
        <span className={`tab ${view === 'list' ? 'active' : ''}`} onClick={backToList}>SCR - Rules</span>
        {view === 'form' && (
          <span className="tab active">{form.id ? `Rule ${form.id}` : 'New rule'}</span>
        )}
        {view === 'export' && <span className="tab active">Excel export</span>}
      </nav>

      <main className="page">
        {view === 'form' && (
          <div className="toolbar">
            <button className="link-btn" onClick={backToList}>‹ Back to list</button>
            <button className="btn primary" onClick={save} disabled={saving || !lookups}>
              <svg viewBox="0 0 16 16" width="13" height="13"><path d="M2 2h9l3 3v9H2zM5 2v4h6V2M5 14V9h6v5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn" onClick={createNew}>New</button>
            {form.id && <button className="btn" onClick={() => copyRule(form)}>Copy</button>}
            {form.id && <button className="btn danger" onClick={remove}>Delete</button>}
            <span className="mode">{form.id ? `Editing rule ${form.id}` : 'Creating a new rule'}</span>
          </div>
        )}

        {message && (
          <div className={`msg ${message.type}`}>
            {message.text}
            <button className="icon-btn" onClick={() => setMessage(null)} aria-label="Close">×</button>
          </div>
        )}

        {view === 'export' ? (
          <ExportTask />
        ) : !lookups ? (
          <p className="loading">Loading...</p>
        ) : view === 'list' ? (
          <RuleList lookups={lookups} onCreate={createNew} onEdit={loadRule} onCopy={copyRule} onMessage={setMessage} />
        ) : (
          <>
            {/* Creation Process */}
            <section className="section">
              <h2>Creation Process</h2>
              <div className="cols cols-creation">
                <div className="col">
                  <Field label="ID:" muted>
                    <div className="lookup size-m">
                      <input
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && openById()}
                      />
                      <button type="button" className="vh-btn" onClick={openById} aria-label="Open rule">
                        <svg viewBox="0 0 16 16" width="13" height="13"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" /></svg>
                      </button>
                    </div>
                  </Field>
                  <Field label="Type" required error={errors.type}>
                    <select className="size-m" value={form.type} onChange={(e) => set('type')(e.target.value)}>
                      {lookups.types.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}
                    </select>
                  </Field>
                  <Field label="BL Specific" required error={errors.blSpecific}>
                    <div className="radios">
                      {['Yes', 'No'].map((v) => (
                        <label key={v}>
                          <input type="radio" name="blSpecific" checked={form.blSpecific === v} onChange={() => set('blSpecific')(v)} /> {v}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Carrier" required error={errors.carrier}>
                    {lookup('carrier', 'carriers', 'm')}
                    <span className="desc">{nameOf('carriers', form.carrier)}</span>
                  </Field>
                </div>

                <div className="col">
                  <Field label="Status:" muted>
                    <div className="radios">
                      {['Active', 'Inactive'].map((v) => (
                        <label key={v}>
                          <input type="radio" name="status" checked={form.status === v} onChange={() => set('status')(v)} /> {v}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Effective date" required error={errors.effectiveDate}>
                    <input type="date" className={`size-m ${errors.effectiveDate ? 'error' : ''}`} value={form.effectiveDate} onChange={(e) => set('effectiveDate')(e.target.value)} />
                  </Field>
                  <Field label="Requestor ID" muted>
                    <ReadOnly value={form.requestorId} />
                    <span className="desc">{form.requestorName}</span>
                  </Field>
                  <Field label="Create date:" muted>
                    <ReadOnly value={fmtDate(form.createDate)} size="s" />
                  </Field>
                </div>

                <div className="col">
                  <div className="field spacer" />
                  <Field label="Expire date" required error={errors.expireDate}>
                    <input type="date" className={`size-m ${errors.expireDate ? 'error' : ''}`} value={form.expireDate} onChange={(e) => set('expireDate')(e.target.value)} />
                  </Field>
                  <Field label="Requestor Sales Branch Code" required error={errors.requestorBranch}>
                    {lookup('requestorBranch', 'branches', 's')}
                    <span className="desc">{nameOf('branches', form.requestorBranch)}</span>
                  </Field>
                  <Field label="Last update:" muted>
                    <ReadOnly value={fmtDate(form.lastUpdate)} size="s" />
                  </Field>
                </div>

                <div className="col comments">
                  <label className="muted">Comments:</label>
                  <textarea maxLength={1000} value={form.comments} onChange={(e) => set('comments')(e.target.value)} />
                </div>
              </div>
            </section>

            {/* Sales */}
            <section className="section">
              <h2>Sales</h2>
              <div className="cols cols-3">
                <div className="col">
                  <Field label="Activity"><span className="value">{activity}</span></Field>
                  <Field label="Sales Credit BP" required error={errors.salesCreditBp}>
                    {lookup('salesCreditBp', 'businessPartners', 'm')}
                  </Field>
                  <Field label="Contract Holder" error={errors.contractHolder}>
                    {lookup('contractHolder', 'businessPartners', 'm')}
                  </Field>
                  <Field label="Contract Number" error={errors.contractNumber}>
                    {lookup('contractNumber', 'contracts', 'l')}
                  </Field>
                </div>
                <div className="col">
                  <div className="field spacer" />
                  <Field label="Sales Credit BP Name:" muted><ReadOnly value={scBp?.name ?? ''} size="xl" /></Field>
                  <Field label="Contract Holder Name:" muted><ReadOnly value={nameOf('businessPartners', form.contractHolder)} size="xl" /></Field>
                  <Field label="Contract DCD BP:" muted><ReadOnly value={contract?.dcdBp ?? ''} size="l" /></Field>
                </div>
                <div className="col">
                  <Field label="Sales Credit Owner Name:" muted><ReadOnly value={scBp?.owner ?? ''} size="xl" /></Field>
                  <Field label="Sales Credit Owner Territory:" muted>
                    <ReadOnly value={scBp?.territory ?? ''} size="xl" placeholder="No Territory Found" />
                  </Field>
                  <div className="field spacer" />
                  <Field label="Contract DCD BP Name:" muted><ReadOnly value={nameOf('businessPartners', contract?.dcdBp)} size="l" /></Field>
                </div>
              </div>
            </section>

            {/* Origin / Destination */}
            <div className="split">
              <section className="section">
                <h2>Origin</h2>
                <Field label="Booking Office:" muted error={errors.bookingOffice}>
                  {lookup('bookingOffice', 'offices', 's')}
                  <span className="desc">{nameOf('offices', form.bookingOffice)}</span>
                </Field>
                <Field label="Trigram POL Zone" required error={errors.polZone}>
                  {lookup('polZone', 'zones', 'm')}
                  <span className="desc">{nameOf('zones', form.polZone)}</span>
                </Field>
                <Field label="Origin Country:" muted error={errors.originCountry}>
                  {lookup('originCountry', 'countries', 's')}
                  <span className="desc">{nameOf('countries', form.originCountry)}</span>
                </Field>
                <Field label="Origin Point:" muted error={errors.originPoint}>
                  {lookup('originPoint', 'points', 'l', { country: form.originCountry })}
                  <span className="desc">{nameOf('points', form.originPoint)}</span>
                </Field>
              </section>
              <section className="section">
                <h2>Destination</h2>
                <div className="field spacer" />
                <Field label="Trigram POD Zone" required error={errors.podZone}>
                  {lookup('podZone', 'zones', 'm')}
                  <span className="desc">{nameOf('zones', form.podZone)}</span>
                </Field>
                <Field label="Destination Country" required error={errors.destCountry}>
                  {lookup('destCountry', 'countries', 's')}
                  <span className="desc">{nameOf('countries', form.destCountry)}</span>
                </Field>
                <Field label="Destination Point:" muted error={errors.destPoint}>
                  {lookup('destPoint', 'points', 'l', { country: form.destCountry })}
                  <span className="desc">{nameOf('points', form.destPoint)}</span>
                </Field>
              </section>
            </div>

            {/* Actors */}
            <section className="section">
              <h2>Actors</h2>
              {[
                ['shipperBp', 'Shipper BP Cd', 'Shipper Name:'],
                ['forwarderBp', 'Forwarder BP Cd', 'Forwarder Name:'],
                ['consigneeBp', 'Consignee BP Cd', 'Consignee Name:'],
                ['notifyBp', 'Notify Party BP Cd', 'Notify Party Name:'],
              ].map(([field, label, nameLabel]) => (
                <div className="actor-row" key={field}>
                  <Field label={label} error={errors[field]}>{lookup(field, 'businessPartners', 'm')}</Field>
                  <Field label={nameLabel} muted><ReadOnly value={nameOf('businessPartners', form[field])} size="xxl" /></Field>
                </div>
              ))}
            </section>

            {/* Additional conditions */}
            <section className="section">
              <h2>Additional conditions</h2>
              <Field label="BL Number:" muted={form.blSpecific !== 'Yes'} required={form.blSpecific === 'Yes'} error={errors.blNumber}>
                <input
                  className={`size-l ${errors.blNumber ? 'error' : ''}`}
                  value={form.blNumber}
                  disabled={form.blSpecific !== 'Yes'}
                  onChange={(e) => set('blNumber')(e.target.value.toUpperCase())}
                />
              </Field>
            </section>
          </>
        )}
      </main>

      {help && (
        <ValueHelpDialog
          title={HELP[help.table].title}
          columns={HELP[help.table].columns}
          items={helpItems}
          onClose={() => setHelp(null)}
          onSelect={(code) => {
            set(help.field)(code);
            setHelp(null);
          }}
        />
      )}
    </div>
  );
}
