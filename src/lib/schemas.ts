import { z } from 'zod';
import {
  APQP_STATUSES,
  TOOLING_CATEGORIES,
  TRF_STATUSES,
} from '../types/database.types';

const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null));

const optionalString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null));

export const sampleSchema = z.object({
  rsqdf: z.string().trim().min(1, 'RSQDF is required'),
  customer: z.string().trim().min(1, 'Customer is required'),
  model_name: z.string().trim().min(1, 'Model Name is required'),
  record_type: z.enum(['Sample', 'P.O.']),
  reference_number: optionalString,
  technician_in_charge: optionalString,
  date_requested: optionalDate,
  date_commitment: optionalDate,
  date_finished: optionalDate,
  remarks: optionalString,
});

export const quotationSchema = z.object({
  rsqdf: z.string().trim().min(1, 'RSQDF is required'),
  customer: z.string().trim().min(1, 'Customer is required'),
  model_name: z.string().trim().min(1, 'Model Name is required'),
  record_type: z.enum(['Sample', 'Quotation']),
  reference_number: optionalString,
  technician_in_charge: optionalString,
  date_requested: optionalDate,
  date_commitment: optionalDate,
  date_finished: optionalDate,
  remarks: optionalString,
});

export const approvalSchema = z.object({
  po_mode: z.enum(['With P.O.', 'Without P.O.']),
  rsqdf: z.string().trim().min(1, 'RSQDF is required'),
  po_number: optionalString,
  customer: z.string().trim().min(1, 'Customer is required'),
  model_name: z.string().trim().min(1, 'Model Name is required'),
  technician_in_charge: optionalString,
  po_received_date: optionalDate,
  date_commitment: optionalDate,
  date_sent_to_customer: optionalDate,
  date_received_signed_approval: optionalDate,
  remarks: optionalString,
});

export const apqpToolingCommitmentInputSchema = z.object({
  tooling_type: z.enum(TOOLING_CATEGORIES),
  needed: z.boolean(),
  commitment_date: optionalDate,
  remarks: optionalString,
});

export const apqpSchema = z.object({
  rsqdf: z.string().trim().min(1, 'RSQDF is required'),
  customer: z.string().trim().min(1, 'Customer is required'),
  model_name: z.string().trim().min(1, 'Model Name is required'),
  po_reference: optionalString,
  date_received_signed_approval: optionalDate,
  technician_in_charge: optionalString,
  status: z.enum(APQP_STATUSES),
  meeting_date: optionalDate,
  item_code_requested_date: optionalDate,
  item_code_received_date: optionalDate,
  item_code: optionalString,
  frrd_released_date: optionalDate,
  forwarded_to_ppqc_date: optionalDate,
  first_run_done_date: optionalDate,
  frrd_returned_date: optionalDate,
  forwarded_to_md_date: optionalDate,
  forwarded_to_ddcc_date: optionalDate,
  completed_date: optionalDate,
  date_commitment: optionalDate,
  remarks: optionalString,
  tooling_commitments: z.array(apqpToolingCommitmentInputSchema).optional(),
});

export const toolingSchema = z.object({
  source_type: z.enum(['First Run', 'TRF']),
  trf_reference: optionalString,
  date_received: optionalDate,
  rsqdf: z.string().trim().min(1, 'RSQDF is required'),
  customer: z.string().trim().min(1, 'Customer is required'),
  model_name: z.string().trim().min(1, 'Model Name is required'),
  technician_in_charge: optionalString,
  tooling_type: z.enum(TOOLING_CATEGORIES),
  execution_mode: z.enum(['Job Out', 'In House']),
  commitment_date: optionalDate,
  date_forwarded_to_ppqc: optionalDate,
  remarks: optionalString,
});

export const cncSchema = z.object({
  date_received: optionalDate,
  rsqdf_jo: z.string().trim().min(1, 'RSQDF / J.O. is required'),
  rsqdf: z.string().trim().min(1, 'RSQDF is required'),
  customer: z.string().trim().min(1, 'Customer is required'),
  model_name: z.string().trim().min(1, 'Model Name is required'),
  technician_in_charge: optionalString,
  qty_commitment: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }),
  delivery_schedule: optionalDate,
  date_finished: optionalDate,
  remarks: optionalString,
});

export const mdMonthlySchema = z.object({
  month_key: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
  for_retrieval_override: z.number().int().min(0).nullable(),
  for_final_md_override: z.number().int().min(0).nullable(),
  forwarded_to_ddcc_override: z.number().int().min(0).nullable(),
  with_special_case: z.number().int().min(0),
  remarks: optionalString,
});

export const trfSchema = z.object({
  trf_number: z.string().trim().min(1, 'TRF # is required'),
  rsqdf: z.string().trim().min(1, 'RSQDF is required'),
  customer: z.string().trim().min(1, 'Customer is required'),
  model_name: z.string().trim().min(1, 'Model Name is required'),
  technician_in_charge: optionalString,
  date_filed: z.string().trim().min(1, 'Date Filed is required'),
  reason_for_revision: z.string().trim().min(3, 'Reason for revision is required'),
  requires_tooling: z.boolean(),
  tooling_type: z.enum(TOOLING_CATEGORIES).nullable().optional(),
  tooling_commitment_date: optionalDate,
  execution_mode: z.enum(['Job Out', 'In House']).optional(),
  requires_md_revision: z.boolean(),
  status: z.enum(TRF_STATUSES),
  date_completed: optionalDate,
  remarks: optionalString,
});

export const obSchema = z.object({
  customer: z.string().trim().min(1, 'Customer is required'),
  ob_date: z.string().trim().min(1, 'Date is required'),
  ob_time: optionalString,
  technician_in_charge: optionalString,
  sales_in_charge: optionalString,
  purpose: z.string().trim().min(1, 'Purpose / Design Development is required'),
  remarks: optionalString,
});

export const technicianSchema = z.object({
  name: z.string().trim().min(1, 'Technician name is required'),
  is_active: z.boolean().default(true),
});
