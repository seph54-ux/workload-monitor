import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { SamplesPage } from '../features/samples/SamplesPage';
import { QuotationPage } from '../features/quotation/QuotationPage';
import { ApprovalPage } from '../features/approval/ApprovalPage';
import { ApqpPage } from '../features/apqp/ApqpPage';
import { ToolingPage } from '../features/tooling/ToolingPage';
import { CncPage } from '../features/cnc/CncPage';
import { MdPage } from '../features/md/MdPage';
import { TrfPage } from '../features/trf/TrfPage';
import { ObPage } from '../features/ob/ObPage';
import { CompletedPage } from '../features/completed/CompletedPage';
import { TimelinePage } from '../features/timeline/TimelinePage';
import { AdminPage } from '../features/admin/AdminPage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/samples" element={<SamplesPage />} />
          <Route path="/quotation" element={<QuotationPage />} />
          <Route path="/approval" element={<ApprovalPage />} />
          <Route path="/apqp" element={<ApqpPage />} />
          <Route path="/tooling" element={<ToolingPage />} />
          <Route path="/cnc" element={<CncPage />} />
          <Route path="/md" element={<MdPage />} />
          <Route path="/trf" element={<TrfPage />} />
          <Route path="/ob" element={<ObPage />} />
          <Route path="/completed" element={<CompletedPage />} />
          <Route path="/item/:rsqdf" element={<TimelinePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
