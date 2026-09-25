import { createBrowserRouter } from "react-router-dom";
import ReportTemplatePage from "../features/report/pages/ReportTemplatePage";
import ReportStoragePage from "../features/report/pages/ReportStoragePage";
import ReportDetailPage from "../features/report/pages/ReportDetailPage";
import EmployeePage from "../features/employee/pages/Employee";
import ReportStorageDepartment from "../features/report/pages/ReportStorageDepartment";
import ReportDetail from "../features/report/pages/ReportDetail";
import ReportTemplateDepartment from "../features/report/pages/ReportTemplateDepartment";
import ReportCategoryPage from "../features/category/reportCategory/pages/ReportCategory";
import DepartmentCategoryPage from "../features/department/pages/DepartmentCategoryPage";
import LoginPage from "../features/auth/pages/LoginPage";
import LuckeyExcelViewer from "../features/report/components/previewFile/LuckeyExcel";
import PreviewFilePdf from "../features/report/components/previewFile/PreviewFilePdf";
import ProfilePage from "../features/employee/pages/ProfilePage";
import MainLayout from "../features/layout/MainLayout";
import DepartmentMy from "../features/department/pages/DepartmentMy";
import WareCategoryPage from "../features/ware/pages/WareCategory";
import WareTemplate from "../features/ware/pages/WareTemplate";
import { WareBatch } from "../features/ware/pages/WareBatch";
import { TemplateDetail } from "../features/ware/pages/WareTemplateDetail";
import { WareBatchDetail } from "../features/ware/pages/WareBatchDetail";
import DashboardWare from "../features/ware/pages/WareBatchDasboard";
import SearchMasterData from "../features/ware/pages/WareMasterData";
import ReportTargetsPage from "../features/dashboard/pages/ReportTarget";
import { WareBatchForManagement } from "../features/ware/pages/WareBatchForManage";
import { ApproveBatch } from "../features/ware/pages/ApproveBatch";
import { SyncBatch } from "../features/ware/pages/SyncBatch";
import { WareBatchDetailApprove } from "../features/ware/pages/WareBatchDetailApprove";
import UserPushConfigPage from "../features/auth/pages/accountConfig";
import AiChatPage from "../features/ai-chat/pages/AiChatPage";
import DataManagementPage from "../features/datalake/pages/DataManagementPage";
import DatalakeStatusPage from "../features/datalake/pages/DatalakeStatusPage";
import SyncSettingsPage from "../features/datalake-sync/pages/SyncSettingsPage";
import ServerManagementPage from "../features/server/pages/ServerManagementPage";
import DatabaseExplorerPage from "../features/database/pages/DatabaseExplorerPage";
import JobTrackingPage from "../features/jobs/pages/JobTrackingPage";
import PipelinePage from "../features/lakehouse/pipeline/pages/PipelinePage";
import GoldPage from "../features/lakehouse/gold/pages/GoldPage";
import RagPage from "../features/lakehouse/rag/pages/RagPage";
import TableQaPage from "../features/lakehouse/table-qa/pages/TableQaPage";
import DocumentChatPage from "../features/lakehouse/document-chat/pages/DocumentChatPage";
import SqlMetadataPage from "../features/sql-metadata/pages/SqlMetadataPage";
import ExcelMappingPage from "../features/excel-mapping/pages/ExcelMappingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { path: "/", element: <DashboardWare /> },
      { path: "/report-targets", element: <ReportTargetsPage /> },
      { path: "/dashboard", element: <DashboardWare /> },

      // DataLake AI routes
      { path: "/ai-chat", element: <AiChatPage /> },
      { path: "/datalake/data", element: <DataManagementPage /> },
      { path: "/datalake/status", element: <DatalakeStatusPage /> },
      { path: "/datalake/sync", element: <SyncSettingsPage /> },

      // Server, Database, Jobs routes
      { path: "/servers", element: <ServerManagementPage /> },
      { path: "/database", element: <DatabaseExplorerPage /> },
      { path: "/jobs", element: <JobTrackingPage /> },

      // Lakehouse routes
      { path: "/lakehouse/pipeline", element: <PipelinePage /> },
      { path: "/lakehouse/gold", element: <GoldPage /> },
      { path: "/lakehouse/rag", element: <RagPage /> },
      { path: "/lakehouse/table-qa", element: <TableQaPage /> },
      { path: "/lakehouse/document-chat", element: <DocumentChatPage /> },
      { path: "/sql-metadata", element: <SqlMetadataPage /> },
      { path: "/excel-mapping", element: <ExcelMappingPage /> },

      { path: "/employee", element: <EmployeePage /> },
      { path: "/account-config", element: <UserPushConfigPage /> },

      { path: "/employee/:employeeId", element: <ProfilePage /> },
      { path: "/ware", element: <DepartmentMy /> },
      { path: "/search/master", element: <SearchMasterData /> },
      { path: "/ware/department/:departmentId", element: <WareTemplate /> },
      { path: "/ware/template/:templateId", element: <WareBatch /> },
      { path: "/ware/template/approve/:templateId", element: <WareBatchForManagement /> },
      { path: "/ware/template/detail/:templateId", element: <TemplateDetail /> },
      { path: "/ware/batch/:wareBatchId", element: <WareBatchDetail /> },
      { path: "/ware/batch-approve/:wareBatchId", element: <WareBatchDetailApprove /> },
      { path: "/approve/batch", element: <ApproveBatch /> },
      { path: "/sync/batch", element: <SyncBatch /> },
      { path: "/category/report", element: <ReportCategoryPage /> },
      { path: "/category/departments", element: <DepartmentCategoryPage /> },
      { path: "/category/ware", element: <WareCategoryPage /> },

      {
        path: "/reports/view/excel/:fileKey",
        element: <LuckeyExcelViewer />,
      },

      {
        path: "/reports/view/pdf/:fileKey",
        element: <PreviewFilePdf />,
      },


      { path: "/reports/template/us/:reportId", element: <ReportDetail /> },
      { path: "/reports/template/edit/:reportId", element: <ReportDetail /> },

      { path: "/reports/template", element: <ReportTemplatePage /> },
      { path: "/reports/template/department/:departmentId", element: <ReportTemplateDepartment /> },

      { path: "/reports/storage", element: <ReportStoragePage /> },
      { path: "/reports/storage/department/:departmentId", element: <ReportStorageDepartment /> },

      { path: "/report/:id", element: <ReportDetailPage /> },
    ],
  },

  {
    path: "/login",
    element: <LoginPage />,
  },
]);