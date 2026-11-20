# TechFlow WMS — Technical Department Workload Monitoring System

**TechFlow WMS** is an internal web application for tracking the Technical / Engineering Department's day-to-day workload. It follows every customer request from initial quotation or sample creation through customer approval, First Run (APQP), Tooling and CNC fabrication, Manufacturing Drawing (MD) finalization, Document Control (DDCC), internal revisions (TRF), and Official Business (O.B.) field trips.

Everything is linked by the **RSQDF** reference number so engineers, coordinators, and managers can always see **who is handling what**, **what is due soon**, and **what is overdue** across the entire process.

---

## Key Terms Used in the System

- **RSQDF**: The main reference number that links a customer request across all stages.
- **APQP (First Run)**: Preparation and tracking of the first production run for an approved item.
- **FRRD**: First Run Drawing — the drawing prepared and released for the first run, then handed to PPQC and Production.
- **PPQC**: Production Planning & Quality Control — the planners who receive the FRRD and tooling for the first run and pass them to Production.
- **MD (Manufacturing Drawing)**: Internal drawing finalization team/process that reviews, corrects, and finalizes drawings after the first run (or after a TRF revision).
- **DDCC**: Document Control — performs the final check on documents and issues them officially for production monitors.
- **TRF (Technical Request Form)**: Internal revision request required whenever an existing drawing or tooling needs changes. MD and Tooling revise items only after a TRF is filed.
- **O.B. (Official Business)**: Customer site visits, line trials, and engineering field trips.

---

## End-to-End System Flow

A customer request moves through the system in stages. Requests do not always start at the exact same place (some start with a Quotation, others start with a Sample), and the app supports promoting a record directly to the next stage without re-typing details.

```text
Quotation  ⇄  Samples  →  Approval (With or Without P.O.)  →  APQP (First Run)
                                                                 │
                                        ┌────────────────────────┴────────────────────────┐
                                        ▼                                                 ▼
                                 Tooling & CNC                                   MD → DDCC (Official)
                               (Die Cut, Rubber,                                        ▲
                              Silkscreen, Pattern, Jig)                                 │
                                        └────────────── TRF Revisions ──────────────────┘
```

### How a Request Flows Step by Step

1. **Quotation & Samples**
   - When a customer asks for pricing first, it starts in **Quotation** (with an optional reference number).
   - When a physical sample is requested first—or after a quotation is approved—it is logged in **Samples** and assigned to a Technician In Charge with a commitment date.
2. **Approval**
   - Once the customer accepts the sample or quotation (with a P.O., or proceeding without a P.O.), the item moves to **Approval**.
   - The team tracks when the P.O. was received, when the approval document was sent to the customer, and when the signed approval came back.
3. **APQP (First Run)**
   - After signed approval is received, the item enters **APQP**.
   - The technician records the internal meeting date, requests and receives the **Item Code**, specifies which **tooling** is needed (Die Cut, Rubber, Silkscreen, Pattern, and/or Jig) along with commitment dates, releases the **FRRD**, and forwards it to **PPQC**.
   - After the first run finishes, the FRRD returns and is forwarded to **MD** and then **DDCC**.
4. **Tooling & CNC**
   - Required tooling items from APQP (or rework items from a TRF) appear in the **Tooling** tab so the Tooling team sees what is assigned, whether it is *In House* or *Job Out*, and when it is forwarded to PPQC.
   - Machining jobs are listed in the **CNC** tab with job order numbers, quantities, and delivery schedules.
5. **MD & DDCC**
   - **MD** tracks monthly drawing retrieval, final MD preparation, drawings forwarded to DDCC, and special cases. Counts automatically update from APQP activity, with manual overrides available when needed.
6. **TRF Log (Internal Revisions)**
   - Whenever an internal drawing or tooling revision is needed, a **TRF** is filed first in the **TRF Log** and linked to the RSQDF, MD, or Tooling.

---

## Pages & How to Use Them

### 1. Dashboard
The home screen gives an immediate snapshot of department workload:
- **Summary cards**: Total active jobs, overdue items, items due within 7 days, and upcoming O.B. trips.
- **Technician Workload Chart**: Visualizes open, due-soon, and overdue tasks per technician. Click any technician bar/row to see their assigned open items across all stages.
- **Overdue & Due This Week Queues**: Direct jump-list of urgent items sorted by deadline.

### 2. Stage Tabs (Samples, Quotation, Approval, APQP, Tooling, CNC, MD, TRF Log)
Each stage has its own dedicated table with search, filtering, sorting, and status badges:
- **Red (Overdue)**: Past the commitment date and not yet finished.
- **Amber (Due Soon)**: Due within the next 2 days (or today).
- **Green (Done)**: Completed / signed / forwarded.
- **On Track**: Open and not yet due soon.
- **Promote Button**: On **Quotation**, **Samples**, **Approval**, and **APQP**, click **Promote** on any row to move the item forward into the next stage (for example, pushing Approval into APQP, or pushing APQP tooling needs straight into Tooling & CNC) while carrying over customer, model, RSQDF, and technician details.

### 3. RSQDF Lookup & Item Timeline
Use the **Lookup RSQDF...** search bar at the top of any screen (or click any RSQDF number in a table) to open the **RSQDF Item Timeline**.
- Shows every linked record for that RSQDF in one place: Quotation → Samples → Approval → APQP → Tooling & CNC → TRF Revisions.
- **Drawings & Documents**: Attach PDFs or images (quotations, signed approvals, FRRD drawings). Attached files can be **downloaded**, **edited** (renamed or replaced with a newer file), or **removed**.

### 4. Completed / Done Items
A dedicated archive tab collecting all finished records across **Samples**, **Quotation**, **Approval**, **APQP**, **Tooling**, **CNC**, and **TRF Log**, organized by category:
- **Categorized Views**: Filter by category or view items grouped under each stage header (`By Category` or `All Table`), search by RSQDF/customer/model, and export to Excel.
- **Re-Check & Edit Status**: Open any completed item's RSQDF timeline to review details and drawings, edit its completion details, or choose **Reopen / For Revision** to move it back to active monitoring.
- **Quick TRF Filing**: File a new **TRF Revision** directly from any completed item if a drawing or tooling change is needed.

### 5. O.B. (Official Business)
Tracks field visits and customer trips with two ways to view the schedule:
- **Table View**: Filterable list of upcoming and past trips with dates, departure/arrival times, customers, and assigned technicians.
- **Calendar View**: Monthly calendar layout to spot scheduling overlaps and upcoming field visits at a glance.

### 6. Excel Import & Export
Every stage table supports working with spreadsheets:
- **Export**: Download the current table view as an `.xlsx` Excel file.
- **Import**: Upload an existing `.xlsx` or `.csv` file, match spreadsheet columns to system fields, review validation errors in a dry-run preview, and import valid rows in bulk.

### 7. Admin Console (Admin Role Only)
- **Technicians**: Add, rename, or deactivate Technical In Charge roster members (the dropdown list used across all stages).
- **Audit Trail**: View a read-only history of changes made across records and attachments.

---

## User Roles & Access

Each person uses the system according to their role:
- **ADMIN**: Full access across all stage tabs, Technician roster management, and Audit Trail.
- **TECHNICAL**: Full access to create, update, promote, and attach/edit documents across engineering stages.
- **TOOLING**: Can update assigned **Tooling** records (and manage documents), with read-only visibility on other stages.
- **CNC**: Can update assigned **CNC** records (and manage documents), with read-only visibility on other stages.
- **VIEWER**: Read-only access to dashboards, stage tables, timelines, and downloading attached documents.
