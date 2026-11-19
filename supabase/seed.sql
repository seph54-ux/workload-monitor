-- Seed Data: 12 Technicians + Realistic Cross-Stage Sample Records

-- 1. Seed the 12 Technical Department Engineers
INSERT INTO public.technicians (id, name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Clark'),
  ('10000000-0000-0000-0000-000000000002', 'TJ'),
  ('10000000-0000-0000-0000-000000000003', 'Titus'),
  ('10000000-0000-0000-0000-000000000004', 'Jai'),
  ('10000000-0000-0000-0000-000000000005', 'Shai'),
  ('10000000-0000-0000-0000-000000000006', 'Mei'),
  ('10000000-0000-0000-0000-000000000007', 'Daisy'),
  ('10000000-0000-0000-0000-000000000008', 'Lenard'),
  ('10000000-0000-0000-0000-000000000009', 'Aldrian'),
  ('10000000-0000-0000-0000-000000000010', 'Jhun'),
  ('10000000-0000-0000-0000-000000000011', 'Facs'),
  ('10000000-0000-0000-0000-000000000012', 'Mhel')
ON CONFLICT (name) DO NOTHING;

-- 2. Quotations
INSERT INTO public.quotations (id, rsqdf, customer, model_name, record_type, reference_number, technician_in_charge, date_requested, date_commitment, date_finished, remarks) VALUES
  ('20000000-0000-0000-0000-000000000001', 'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', 'Quotation', 'QT-26-0412', '10000000-0000-0000-0000-000000000001', '2026-11-04', '2026-11-10', '2026-11-09', 'BOM & die-cut nesting costed'),
  ('20000000-0000-0000-0000-000000000002', 'RSQDF-26-108', 'Epson Precision', 'EPS-L3210 Ink Pad Gasket', 'Sample', 'SMP-26-089', '10000000-0000-0000-0000-000000000002', '2026-11-10', '2026-11-15', NULL, 'Awaiting adhesive spec from supplier'),
  ('20000000-0000-0000-0000-000000000003', 'RSQDF-26-112', 'Brother Industries', 'BRT-HL2350 Foam Seal', 'Quotation', 'QT-26-0445', '10000000-0000-0000-0000-000000000005', '2026-11-14', '2026-11-20', NULL, 'In progress — material yield check'),
  ('20000000-0000-0000-0000-000000000004', 'RSQDF-26-115', 'Murata Manufacturing', 'MRT-HV Shield Spacer', 'Quotation', NULL, '10000000-0000-0000-0000-000000000008', '2026-11-16', '2026-11-24', NULL, 'Initial drawing review started');

-- 3. Samples
INSERT INTO public.samples (id, rsqdf, customer, model_name, record_type, reference_number, technician_in_charge, date_requested, date_commitment, date_finished, remarks) VALUES
  ('30000000-0000-0000-0000-000000000001', 'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', 'Sample', 'SMP-26-072', '10000000-0000-0000-0000-000000000001', '2026-11-10', '2026-11-14', '2026-11-13', '10 pcs submitted to QA'),
  ('30000000-0000-0000-0000-000000000002', 'RSQDF-26-104', 'Canon Business Machines', 'CN-MF455 Thermal Pad', 'P.O.', 'PO-992104', '10000000-0000-0000-0000-000000000003', '2026-11-08', '2026-11-14', NULL, 'Delayed by silicone sheet arrival'),
  ('30000000-0000-0000-0000-000000000003', 'RSQDF-26-110', 'Yazaki-Torres', 'YZK-EV Harness Boot', 'Sample', 'SMP-26-094', '10000000-0000-0000-0000-000000000006', '2026-11-15', '2026-11-20', NULL, 'Prototype molding scheduled');

-- 4. Approvals
INSERT INTO public.approvals (id, po_mode, rsqdf, po_number, customer, model_name, technician_in_charge, po_received_date, date_commitment, date_sent_to_customer, date_received_signed_approval, remarks) VALUES
  ('40000000-0000-0000-0000-000000000001', 'With P.O.', 'RSQDF-26-101', 'PO-88412', 'Nidec Philippines', 'NDP-48V Stator Insulator', '10000000-0000-0000-0000-000000000001', '2026-11-14', '2026-11-18', '2026-11-15', '2026-11-17', 'Customer QA signed rev A'),
  ('40000000-0000-0000-0000-000000000002', 'With P.O.', 'RSQDF-26-105', 'PO-88490', 'Fujitsu Ten', 'FJT-Display Bezel Tape', '10000000-0000-0000-0000-000000000004', '2026-11-07', '2026-11-13', '2026-11-09', NULL, 'Follow up sales for customer sign-off'),
  ('40000000-0000-0000-0000-000000000003', 'Without P.O.', 'RSQDF-26-109', NULL, 'Shimano Laguna', 'SHM-Cassette Spacer', '10000000-0000-0000-0000-000000000007', '2026-11-14', '2026-11-19', '2026-11-16', NULL, 'Early approval requested before P.O.');

-- 5. APQP (First Run) + Tooling Commitments
INSERT INTO public.apqp (
  id, approval_id, date_received_signed_approval, po_reference, rsqdf, customer, model_name,
  technician_in_charge, status, meeting_date, item_code_requested_date, item_code_received_date,
  item_code, frrd_released_date, forwarded_to_ppqc_date, first_run_done_date,
  frrd_returned_date, forwarded_to_md_date, forwarded_to_ddcc_date, date_commitment, remarks
) VALUES
  (
    '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2026-11-17', 'PO-88412',
    'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', '10000000-0000-0000-0000-000000000001',
    'FRRD Released', '2026-11-17', '2026-11-17', '2026-11-18', 'IC-48021', '2026-11-18',
    NULL, NULL, NULL, NULL, NULL, '2026-11-22', 'Ready to forward to PPQC'
  ),
  (
    '50000000-0000-0000-0000-000000000002', NULL, '2026-11-01', 'PO-87901',
    'RSQDF-26-092', 'Toshiba Storage', 'TSH-HDD Damper Film', '10000000-0000-0000-0000-000000000009',
    'First Run Done', '2026-11-02', '2026-11-03', '2026-11-04', 'IC-33910', '2026-11-05',
    '2026-11-06', '2026-11-12', NULL, NULL, NULL, '2026-11-16', 'FRRD awaiting retrieval from prod'
  ),
  (
    '50000000-0000-0000-0000-000000000003', NULL, '2026-10-25', 'PO-87550',
    'RSQDF-26-085', 'Denso Philippines', 'DNS-ECU Vent Membrane', '10000000-0000-0000-0000-000000000010',
    'Forwarded to MD', '2026-10-26', '2026-10-27', '2026-10-28', 'IC-21044', '2026-10-29',
    '2026-10-30', '2026-11-05', '2026-11-08', '2026-11-10', NULL, '2026-11-20', 'MD revising tolerance callout'
  ),
  (
    '50000000-0000-0000-0000-000000000004', NULL, '2026-10-20', 'PO-87300',
    'RSQDF-26-079', 'Panasonic Manufacturing', 'PNS-AC Control Overlay', '10000000-0000-0000-0000-000000000011',
    'Forwarded to DDCC', '2026-10-21', '2026-10-22', '2026-10-23', 'IC-19881', '2026-10-24',
    '2026-10-25', '2026-11-01', '2026-11-04', '2026-11-06', '2026-11-14', '2026-11-21', 'DDCC final stamp pending'
  );

INSERT INTO public.apqp_tooling_commitments (apqp_id, tooling_type, needed, commitment_date, remarks) VALUES
  ('50000000-0000-0000-0000-000000000001', 'Die Cut', true, '2026-11-20', '2-cavity steel rule die'),
  ('50000000-0000-0000-0000-000000000001', 'Rubber', false, NULL, NULL),
  ('50000000-0000-0000-0000-000000000001', 'Silkscreen', false, NULL, NULL),
  ('50000000-0000-0000-0000-000000000001', 'Pattern', true, '2026-11-19', 'Inspection overlay'),
  ('50000000-0000-0000-0000-000000000001', 'Jig', true, '2026-11-21', 'Pin alignment jig');

-- 6. TRF Logs
INSERT INTO public.trf_logs (id, trf_number, rsqdf, customer, model_name, technician_in_charge, date_filed, reason_for_revision, requires_tooling, tooling_type, requires_md_revision, status, remarks) VALUES
  ('60000000-0000-0000-0000-000000000001', 'TRF-2026-031', 'RSQDF-26-085', 'Denso Philippines', 'DNS-ECU Vent Membrane', '10000000-0000-0000-0000-000000000010', '2026-11-09', 'Adjust outer flange ID +0.15mm per first-run fit check', true, 'Die Cut', true, 'In Tooling', 'Die rework + MD rev B'),
  ('60000000-0000-0000-0000-000000000002', 'TRF-2026-032', 'RSQDF-26-079', 'Panasonic Manufacturing', 'PNS-AC Control Overlay', '10000000-0000-0000-0000-000000000011', '2026-11-11', 'Update silkscreen Pantone callout on MD', false, NULL, true, 'In MD', 'Forwarded to MD for official change');

-- 7. Tooling
INSERT INTO public.tooling (id, source_type, apqp_id, trf_id, trf_reference, date_received, rsqdf, customer, model_name, technician_in_charge, tooling_type, execution_mode, commitment_date, date_forwarded_to_ppqc, remarks) VALUES
  ('70000000-0000-0000-0000-000000000001', 'First Run', '50000000-0000-0000-0000-000000000001', NULL, NULL, '2026-11-18', 'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', '10000000-0000-0000-0000-000000000001', 'Die Cut', 'Job Out', '2026-11-20', NULL, 'PO sent to die maker'),
  ('70000000-0000-0000-0000-000000000002', 'TRF', NULL, '60000000-0000-0000-0000-000000000001', 'TRF-2026-031', '2026-11-09', 'RSQDF-26-085', 'Denso Philippines', 'DNS-ECU Vent Membrane', '10000000-0000-0000-0000-000000000010', 'Die Cut', 'In House', '2026-11-14', NULL, 'Overdue internal blade modification'),
  ('70000000-0000-0000-0000-000000000003', 'First Run', '50000000-0000-0000-0000-000000000004', NULL, NULL, '2026-10-24', 'RSQDF-26-079', 'Panasonic Manufacturing', 'PNS-AC Control Overlay', '10000000-0000-0000-0000-000000000011', 'Silkscreen', 'In House', '2026-10-28', '2026-10-27', 'Mesh 200 screen delivered to PPQC');

-- 8. CNC
INSERT INTO public.cnc (id, apqp_id, date_received, rsqdf_jo, rsqdf, customer, model_name, technician_in_charge, qty_commitment, delivery_schedule, date_finished, remarks) VALUES
  ('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-11-18', 'RSQDF-26-101 / JO-411', 'RSQDF-26-101', 'Nidec Philippines', 'NDP-48V Stator Insulator', '10000000-0000-0000-0000-000000000001', 2, '2026-11-20', NULL, 'Delrin alignment block milling'),
  ('80000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '2026-11-04', 'RSQDF-26-092 / JO-398', 'RSQDF-26-092', 'Toshiba Storage', 'TSH-HDD Damper Film', '10000000-0000-0000-0000-000000000009', 1, '2026-11-08', '2026-11-07', 'Aluminum fixture base finished');

-- 9. MD Monthly Overrides
INSERT INTO public.md_monthly (month_key, for_retrieval_override, for_final_md_override, forwarded_to_ddcc_override, with_special_case, remarks) VALUES
  ('2026-11', NULL, NULL, NULL, 1, 'Auto-computed from APQP; 1 special case tolerances on DNS-ECU');

-- 10. Official Business (O.B.)
INSERT INTO public.official_business (id, customer, ob_date, ob_time, technician_in_charge, sales_in_charge, purpose, remarks) VALUES
  ('90000000-0000-0000-0000-000000000001', 'Nidec Philippines', '2026-11-19', '09:30:00', '10000000-0000-0000-0000-000000000001', 'Ms. Carla Reyes', 'First run line trial & dimensional audit', 'Bring calipers & sample jig'),
  ('90000000-0000-0000-0000-000000000002', 'Canon Business Machines', '2026-11-21', '14:00:00', '10000000-0000-0000-0000-000000000003', 'Mr. Paolo Cruz', 'Thermal pad material qualification meeting', 'Design development'),
  ('90000000-0000-0000-0000-000000000003', 'Epson Precision', '2026-11-24', '10:00:00', '10000000-0000-0000-0000-000000000012', 'Ms. Ana Lim', 'Quotation technical clarification', 'Confirm adhesive peel spec');
