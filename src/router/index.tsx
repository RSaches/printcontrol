// src/router/index.tsx
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { JobsPage } from "../features/jobs/pages/JobsPage";
import { PrintersPage } from "../features/printers/pages/PrintersPage";
import { ReportsPage } from "../features/reports/pages/ReportsPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { MonitorLogPage } from "../features/monitor/pages/MonitorLogPage";

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/jobs" replace />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/printers" element={<PrintersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/monitor-log" element={<MonitorLogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
