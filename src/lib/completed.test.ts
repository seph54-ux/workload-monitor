import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompletedStatusPatch,
  collectCompletedItems,
  countCompletedByCategory,
  isRowCompleted,
  type CompletedSources,
} from './completed';
import type { ApqpRow, CncRow, SampleRow, ToolingRow, TrfLogRow } from '../types/database.types';

const common = {
  remarks: null,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-10T00:00:00Z',
  created_by: null,
  updated_by: null,
  deleted_at: null,
};

test('isRowCompleted identifies done rows accurately across all stage types', () => {
  const sampleDone: SampleRow = {
    ...common,
    id: 's1',
    rsqdf: 'RSQDF-1',
    customer: 'Nidec',
    model_name: 'Stator',
    record_type: 'Sample',
    reference_number: 'SMP-1',
    technician_in_charge: null,
    date_requested: '2026-11-01',
    date_commitment: '2026-11-05',
    date_finished: '2026-11-04',
  };
  const sampleOpen: SampleRow = { ...sampleDone, id: 's2', date_finished: null };
  const sampleDeleted: SampleRow = { ...sampleDone, id: 's3', deleted_at: '2026-11-11T00:00:00Z' };

  assert.equal(isRowCompleted('samples', sampleDone), true);
  assert.equal(isRowCompleted('samples', sampleOpen), false);
  assert.equal(isRowCompleted('samples', sampleDeleted), false);

  const apqpByStatus: ApqpRow = {
    ...common,
    id: 'a1',
    approval_id: null,
    date_received_signed_approval: '2026-11-02',
    po_reference: 'PO-1',
    rsqdf: 'RSQDF-1',
    customer: 'Nidec',
    model_name: 'Stator',
    technician_in_charge: null,
    status: 'Completed',
    meeting_date: null,
    item_code_requested_date: null,
    item_code_received_date: null,
    item_code: 'IC-10',
    frrd_released_date: null,
    forwarded_to_ppqc_date: null,
    first_run_done_date: null,
    frrd_returned_date: null,
    forwarded_to_md_date: null,
    forwarded_to_ddcc_date: null,
    completed_date: null,
    date_commitment: null,
  };
  assert.equal(isRowCompleted('apqp', apqpByStatus), true);
  assert.equal(
    isRowCompleted('apqp', { ...apqpByStatus, status: 'Forwarded to MD' }),
    false
  );
});

test('collectCompletedItems categorizes and counts completed items newest-first', () => {
  const sources: CompletedSources = {
    samples: [
      {
        ...common,
        id: 's1',
        rsqdf: 'RSQDF-101',
        customer: 'Nidec',
        model_name: 'Insulator',
        record_type: 'Sample',
        reference_number: 'SMP-10',
        technician_in_charge: 'tech-1',
        date_requested: '2026-11-01',
        date_commitment: '2026-11-05',
        date_finished: '2026-11-05',
      },
    ],
    quotations: [
      {
        ...common,
        id: 'q1',
        rsqdf: 'RSQDF-102',
        customer: 'Brother',
        model_name: 'Roller',
        record_type: 'Quotation',
        reference_number: 'QT-22',
        technician_in_charge: 'tech-2',
        date_requested: '2026-11-01',
        date_commitment: '2026-11-12',
        date_finished: '2026-11-12',
      },
    ],
    approvals: [],
    apqp: [],
    tooling: [
      {
        ...common,
        id: 't1',
        source_type: 'First Run',
        apqp_id: null,
        trf_id: null,
        trf_reference: null,
        date_received: '2026-11-03',
        rsqdf: 'RSQDF-101',
        customer: 'Nidec',
        model_name: 'Insulator',
        technician_in_charge: 'tech-1',
        tooling_type: 'Die Cut',
        execution_mode: 'In House',
        commitment_date: '2026-11-09',
        date_forwarded_to_ppqc: '2026-11-09',
      },
    ],
    cnc: [],
    trf_logs: [
      {
        ...common,
        id: 'trf1',
        trf_number: 'TRF-2026-01',
        rsqdf: 'RSQDF-101',
        customer: 'Nidec',
        model_name: 'Insulator',
        technician_in_charge: 'tech-1',
        date_filed: '2026-11-08',
        reason_for_revision: 'Hole tolerance update',
        requires_tooling: false,
        tooling_type: null,
        requires_md_revision: true,
        status: 'Completed',
        date_completed: '2026-11-15',
      },
    ],
  };

  const items = collectCompletedItems(sources);
  assert.equal(items.length, 4);
  assert.equal(items[0].category, 'trf_logs');
  assert.equal(items[1].category, 'quotations');
  assert.equal(items[2].category, 'tooling');
  assert.equal(items[3].category, 'samples');

  const counts = countCompletedByCategory(items);
  assert.equal(counts.ALL, 4);
  assert.equal(counts.samples, 1);
  assert.equal(counts.quotations, 1);
  assert.equal(counts.tooling, 1);
  assert.equal(counts.trf_logs, 1);
  assert.equal(counts.apqp, 0);
});

test('buildCompletedStatusPatch handles reopening, status edits, and TOOLING/CNC field guards', () => {
  const sources: CompletedSources = {
    samples: [],
    quotations: [],
    approvals: [],
    apqp: [
      {
        ...common,
        id: 'ap1',
        approval_id: null,
        date_received_signed_approval: '2026-11-02',
        po_reference: 'PO-1',
        rsqdf: 'RSQDF-201',
        customer: 'Brother',
        model_name: 'Bracket',
        technician_in_charge: 'tech-1',
        status: 'Completed',
        meeting_date: null,
        item_code_requested_date: null,
        item_code_received_date: null,
        item_code: 'IC-99',
        frrd_released_date: null,
        forwarded_to_ppqc_date: null,
        first_run_done_date: null,
        frrd_returned_date: null,
        forwarded_to_md_date: null,
        forwarded_to_ddcc_date: null,
        completed_date: '2026-11-16',
        date_commitment: '2026-11-18',
      } as ApqpRow,
    ],
    tooling: [
      {
        ...common,
        id: 'tl1',
        source_type: 'First Run',
        apqp_id: null,
        trf_id: null,
        trf_reference: null,
        date_received: '2026-11-01',
        rsqdf: 'RSQDF-201',
        customer: 'Brother',
        model_name: 'Bracket',
        technician_in_charge: 'tech-1',
        tooling_type: 'Jig',
        execution_mode: 'In House',
        commitment_date: '2026-11-10',
        date_forwarded_to_ppqc: '2026-11-09',
      } as ToolingRow,
    ],
    cnc: [
      {
        ...common,
        id: 'cnc1',
        apqp_id: null,
        date_received: '2026-11-01',
        rsqdf_jo: 'RSQDF-201 / JO-1',
        rsqdf: 'RSQDF-201',
        customer: 'Brother',
        model_name: 'Bracket',
        technician_in_charge: 'tech-1',
        qty_commitment: 2,
        delivery_schedule: '2026-11-10',
        date_finished: '2026-11-09',
      } as CncRow,
    ],
    trf_logs: [
      {
        ...common,
        id: 'trf1',
        trf_number: 'TRF-2026-88',
        rsqdf: 'RSQDF-201',
        customer: 'Brother',
        model_name: 'Bracket',
        technician_in_charge: 'tech-1',
        date_filed: '2026-11-12',
        reason_for_revision: 'Slot width adjustment',
        requires_tooling: false,
        tooling_type: null,
        requires_md_revision: true,
        status: 'Completed',
        date_completed: '2026-11-14',
      } as TrfLogRow,
    ],
  };

  const items = collectCompletedItems(sources);
  const apqpItem = items.find((i) => i.category === 'apqp')!;
  const toolingItem = items.find((i) => i.category === 'tooling')!;
  const cncItem = items.find((i) => i.category === 'cnc')!;
  const trfItem = items.find((i) => i.category === 'trf_logs')!;

  const apqpReopen = buildCompletedStatusPatch(
    apqpItem,
    {
      actionMode: 'reopen',
      completedDate: '2026-11-16',
      commitmentDate: '2026-11-25',
      technicianId: 'tech-1',
      remarks: 'Reopened for Rev B',
      apqpStatus: 'FRRD Returned',
    },
    'TECHNICAL',
    '2026-11-19'
  );
  assert.equal(apqpReopen.status, 'FRRD Returned');
  assert.equal(apqpReopen.completed_date, null);
  assert.equal(apqpReopen.date_commitment, '2026-11-25');
  assert.equal(apqpReopen.remarks, 'Reopened for Rev B');

  const trfReopen = buildCompletedStatusPatch(
    trfItem,
    {
      actionMode: 'reopen',
      completedDate: null,
      commitmentDate: null,
      technicianId: 'tech-1',
      remarks: 'Sent back to MD',
      trfStatus: 'In MD',
    },
    'ADMIN',
    '2026-11-19'
  );
  assert.equal(trfReopen.status, 'In MD');
  assert.equal(trfReopen.date_completed, null);

  // TOOLING role may only update execution_mode, date_forwarded_to_ppqc, remarks
  const toolingPatch = buildCompletedStatusPatch(
    toolingItem,
    {
      actionMode: 'reopen',
      completedDate: '2026-11-09',
      commitmentDate: '2026-11-22',
      technicianId: 'tech-2',
      remarks: 'Die clearance rework',
      toolingExecutionMode: 'Job Out',
    },
    'TOOLING',
    '2026-11-19'
  );
  assert.deepEqual(Object.keys(toolingPatch).sort(), [
    'date_forwarded_to_ppqc',
    'execution_mode',
    'remarks',
  ]);
  assert.equal(toolingPatch.date_forwarded_to_ppqc, null);
  assert.equal(toolingPatch.execution_mode, 'Job Out');

  // CNC role may only update date_finished, remarks
  const cncPatch = buildCompletedStatusPatch(
    cncItem,
    {
      actionMode: 'reopen',
      completedDate: '2026-11-09',
      commitmentDate: '2026-11-22',
      technicianId: 'tech-2',
      remarks: 'Re-machining',
    },
    'CNC',
    '2026-11-19'
  );
  assert.deepEqual(Object.keys(cncPatch).sort(), ['date_finished', 'remarks']);
  assert.equal(cncPatch.date_finished, null);
});
