import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoSuggestColumnMapping,
  buildDryRunPreview,
  chunkArray,
} from './excel';
import { quotationSchema } from './schemas';

test('autoSuggestColumnMapping matches headers regardless of casing or symbols', () => {
  const headers = ['RSQDF #', 'Customer Name', 'Model', 'Type', 'Tech In Charge', 'Commitment Date'];
  const mapping = autoSuggestColumnMapping(headers, [
    { key: 'rsqdf', label: 'RSQDF', required: true },
    { key: 'customer', label: 'Customer', required: true },
    { key: 'model_name', label: 'Model Name', required: true },
    { key: 'record_type', label: 'Type' },
    { key: 'technician_in_charge', label: 'Tech In Charge' },
    { key: 'date_commitment', label: 'Date Commitment' },
  ]);

  assert.equal(mapping.rsqdf, 'RSQDF #');
  assert.equal(mapping.customer, 'Customer Name');
  assert.equal(mapping.technician_in_charge, 'Tech In Charge');
});

test('buildDryRunPreview validates rows, resolves technician names, and separates errors', () => {
  const techMap = new Map([['clark', 'tech-1']]);
  const rawRows = [
    {
      RSQDF: 'RSQDF-26-200',
      Customer: 'Nidec',
      Model: 'Rotor Cover',
      Type: 'Quotation',
      Tech: 'Clark',
      Due: '2026-11-28',
    },
    {
      RSQDF: '',
      Customer: 'Epson',
      Model: 'Foam Pad',
      Type: 'Quotation',
      Tech: 'Clark',
      Due: '2026-11-28',
    },
  ];

  const summary = buildDryRunPreview(
    rawRows,
    {
      rsqdf: 'RSQDF',
      customer: 'Customer',
      model_name: 'Model',
      record_type: 'Type',
      technician_in_charge: 'Tech',
      date_commitment: 'Due',
    },
    quotationSchema,
    techMap
  );

  assert.equal(summary.totalRows, 2);
  assert.equal(summary.validRows.length, 1);
  assert.equal(summary.validRows[0].parsed?.technician_in_charge, 'tech-1');
  assert.equal(summary.invalidRows.length, 1);
});

test('chunkArray splits batches evenly', () => {
  assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
