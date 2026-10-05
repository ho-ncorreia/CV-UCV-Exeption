import express from 'express';
import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookups, rules, nextId } from './db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_DIR = path.join(ROOT, 'exports');
const EXPORT_SCRIPT = path.join(ROOT, 'scripts', 'export_to_excel.py');
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3');
const EXPORT_FILE_RE = /^sales_credit_rules_\d{8}_\d{6}\.xlsx$/;

const app = express();
app.use(express.json({ limit: '100kb' }));

const EDITABLE_FIELDS = [
  'status', 'type', 'blSpecific', 'carrier', 'effectiveDate', 'expireDate',
  'requestorId', 'requestorName', 'requestorBranch', 'comments',
  'salesCreditBp', 'contractHolder', 'contractNumber',
  'bookingOffice', 'polZone', 'originCountry', 'originPoint',
  'podZone', 'destCountry', 'destPoint',
  'shipperBp', 'forwarderBp', 'consigneeBp', 'notifyBp', 'blNumber',
];

const REQUIRED = {
  type: 'Type',
  blSpecific: 'BL Specific',
  carrier: 'Carrier',
  effectiveDate: 'Effective date',
  expireDate: 'Expire date',
  requestorBranch: 'Requestor Sales Branch Code',
  salesCreditBp: 'Sales Credit BP',
  polZone: 'Trigram POL Zone',
  podZone: 'Trigram POD Zone',
  destCountry: 'Destination Country',
};

const REFERENCES = {
  type: 'types',
  carrier: 'carriers',
  requestorBranch: 'branches',
  salesCreditBp: 'businessPartners',
  contractHolder: 'businessPartners',
  contractNumber: 'contracts',
  bookingOffice: 'offices',
  polZone: 'zones',
  originCountry: 'countries',
  originPoint: 'points',
  podZone: 'zones',
  destCountry: 'countries',
  destPoint: 'points',
  shipperBp: 'businessPartners',
  forwarderBp: 'businessPartners',
  consigneeBp: 'businessPartners',
  notifyBp: 'businessPartners',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitize(body) {
  const rule = {};
  for (const f of EDITABLE_FIELDS) {
    const v = body?.[f];
    rule[f] = typeof v === 'string' ? v.trim().slice(0, f === 'comments' ? 1000 : 100) : '';
  }
  return rule;
}

function validate(rule) {
  const errors = {};
  for (const [f, label] of Object.entries(REQUIRED)) {
    if (!rule[f]) errors[f] = `${label} is required`;
  }
  for (const [f, table] of Object.entries(REFERENCES)) {
    if (rule[f] && !lookups[table].some((x) => x.code === rule[f])) {
      errors[f] = `Value "${rule[f]}" does not exist`;
    }
  }
  if (!['Active', 'Inactive'].includes(rule.status)) errors.status = 'Invalid status';
  if (!['Yes', 'No'].includes(rule.blSpecific)) errors.blSpecific = 'Invalid value';
  if (rule.blSpecific === 'Yes' && !rule.blNumber) errors.blNumber = 'BL Number is required when BL Specific = Yes';
  for (const f of ['effectiveDate', 'expireDate']) {
    if (rule[f] && !DATE_RE.test(rule[f])) errors[f] = 'Invalid date';
  }
  if (!errors.effectiveDate && !errors.expireDate && rule.effectiveDate > rule.expireDate) {
    errors.expireDate = 'Expire date must be after effective date';
  }
  const point = (code) => lookups.points.find((p) => p.code === code);
  if (rule.originPoint && rule.originCountry && point(rule.originPoint)?.country !== rule.originCountry) {
    errors.originPoint = 'Origin point is not in origin country';
  }
  if (rule.destPoint && rule.destCountry && point(rule.destPoint)?.country !== rule.destCountry) {
    errors.destPoint = 'Destination point is not in destination country';
  }
  return errors;
}

app.get('/api/lookups', (_req, res) => res.json(lookups));

app.get('/api/rules', (_req, res) => res.json(rules));

app.get('/api/rules/:id', (req, res) => {
  const rule = rules.find((r) => r.id === req.params.id);
  if (!rule) return res.status(404).json({ message: `Rule ${req.params.id} not found` });
  res.json(rule);
});

app.post('/api/rules', (req, res) => {
  const rule = sanitize(req.body);
  const errors = validate(rule);
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the highlighted fields', errors });
  const now = new Date().toISOString();
  const created = { id: nextId(), ...rule, createDate: now, lastUpdate: now };
  rules.push(created);
  res.status(201).json(created);
});

app.put('/api/rules/:id', (req, res) => {
  const index = rules.findIndex((r) => r.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: `Rule ${req.params.id} not found` });
  const rule = sanitize(req.body);
  const errors = validate(rule);
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the highlighted fields', errors });
  const existing = rules[index];
  rules[index] = {
    ...existing,
    ...rule,
    requestorId: existing.requestorId,
    requestorName: existing.requestorName,
    lastUpdate: new Date().toISOString(),
  };
  res.json(rules[index]);
});

app.delete('/api/rules/:id', (req, res) => {
  const index = rules.findIndex((r) => r.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: `Rule ${req.params.id} not found` });
  rules.splice(index, 1);
  res.status(204).end();
});

app.post('/api/export', (_req, res) => {
  mkdirSync(EXPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  const file = `sales_credit_rules_${stamp}.xlsx`;
  const args = [EXPORT_SCRIPT, '--url', `http://localhost:${PORT}`, '--output', path.join(EXPORT_DIR, file)];
  const start = Date.now();
  execFile(PYTHON, args, { timeout: 60_000, cwd: ROOT }, (err, stdout, stderr) => {
    const log = [`> ${PYTHON} scripts/export_to_excel.py`, stdout, stderr].filter(Boolean).join('\n').trim();
    const durationMs = Date.now() - start;
    if (err) return res.status(500).json({ message: 'Export failed', log: `${log}\n${err.message}`, durationMs });
    res.json({ file, log, durationMs });
  });
});

app.get('/api/export/:file', (req, res) => {
  if (!EXPORT_FILE_RE.test(req.params.file)) return res.status(400).json({ message: 'Invalid file name' });
  res.download(path.join(EXPORT_DIR, req.params.file), (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '127.0.0.1', () => console.log(`API listening on http://localhost:${PORT}`));
