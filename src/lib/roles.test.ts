import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCreateStageRecord,
  canEditStageRecord,
  canPromoteStage,
  canSoftDeleteStageRecord,
  computeMdMonthlySummary,
} from './roles';
import type { ApqpRow, MdMonthlyRow } from '../types/database.types';

test('role permissions enforce strict stage write isolation', () => {
  assert.equal(canCreateStageRecord('TECHNICAL', 'quotations'), true);
  assert.equal(canCreateStageRecord('VIEWER', 'quotations'), false);
  assert.equal(canCreateStageRecord('TOOLING', 'quotations'), false);

  assert.equal(canEditStageRecord('TOOLING', 'tooling'), true);
  assert.equal(canEditStageRecord('TOOLING', 'quotations'), false);
  assert.equal(canEditStageRecord('CNC', 'cnc'), true);
  assert.equal(canEditStageRecord('CNC', 'tooling'), false);

  assert.equal(canSoftDeleteStageRecord('VIEWER'), false);
  assert.equal(canPromoteStage('TECHNICAL'), true);
  assert.equal(canPromoteStage('TOOLING'), false);
});

test('computeMdMonthlySummary aggregates APQP statuses by month and applies manual overrides', () => {
  const baseApqp: Omit<ApqpRow, 'id' | 'status' | 'first_run_done_date' | 'frrd_returned_date' | 'forwarded_to_md_date' | 'forwarded_to_ddcc_date'> = {
    approval_id: null,
    date_received_signed_approval: null,
    po_reference: null,
    rsqdf: 'RSQDF-1',
    customer: 'Cust',
    model_name: 'Model',
    technician_in_charge: null,
    meeting_date: null,
    item_code_requested_date: null,
    item_code_received_date: null,
    item_code: null,
    frrd_released_date: null,
    forwarded_to_ppqc_date: null,
    completed_date: null,
    date_commitment: null,
    remarks: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-10T00:00:00Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
  };

  const apqpRows: ApqpRow[] = [
    { ...baseApqp, id: '1', status: 'First Run Done', first_run_done_date: '2026-11-12', frrd_returned_date: null, forwarded_to_md_date: null, forwarded_to_ddcc_date: null },
    { ...baseApqp, id: '2', status: 'FRRD Returned', first_run_done_date: '2026-11-05', frrd_returned_date: '2026-11-09', forwarded_to_md_date: null, forwarded_to_ddcc_date: null },
    { ...baseApqp, id: '3', status: 'Forwarded to MD', first_run_done_date: '2026-11-04', frrd_returned_date: '2026-11-08', forwarded_to_md_date: '2026-11-11', forwarded_to_ddcc_date: null },
    { ...baseApqp, id: '4', status: 'Forwarded to DDCC', first_run_done_date: '2026-11-01', frrd_returned_date: '2026-11-03', forwarded_to_md_date: '2026-11-05', forwarded_to_ddcc_date: '2026-11-14' },
  ];

  const overrides: MdMonthlyRow[] = [
    {
      id: 'ov-1',
      month_key: '2026-11',
      for_retrieval_override: 5,
      for_final_md_override: null,
      forwarded_to_ddcc_override: null,
      with_special_case: 2,
      remarks: 'Manual retrieval count adjustment',
      created_at: '2026-11-15T00:00:00Z',
      updated_at: '2026-11-15T00:00:00Z',
      created_by: null,
      updated_by: null,
      deleted_at: null,
    },
  ];

  const summary = computeMdMonthlySummary(apqpRows, overrides);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].auto_for_retrieval, 1);
  assert.equal(summary[0].auto_for_final_md, 2);
  assert.equal(summary[0].auto_forwarded_to_ddcc, 1);
  assert.equal(summary[0].for_retrieval, 5); // overridden
  assert.equal(summary[0].for_final_md, 2);
  assert.equal(summary[0].forwarded_to_ddcc, 1);
  assert.equal(summary[0].total, 8);
  assert.equal(summary[0].with_special_case, 2);
});
