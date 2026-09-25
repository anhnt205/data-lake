import { Card, Empty, Table, Spin, Alert } from "antd";
import { COMPANY_NAME } from "../../layout/HeaderBar";

interface ReportHeader {
  tableName?: string;
  tmplName?: string; // Tên template từ URL param
  year?: number;
  period?: string; // "1" to "12"
  day?: string;
  reportType?: "MONTH" | "YEAR" | "DAY";
}

interface ResultPanelProps {
  results: any[];
  reportHeader?: ReportHeader;
  loading?: boolean;
  errorMessage?: string | null;
}

// Danh sách cột cần loại bỏ khỏi bảng (sẽ dùng làm header hoặc trường hệ thống)
const META_COLUMNS = [
  "Mã công ty",
  "mã đơn vị",
  "năm",
  "tháng",
  "ngày",
  "loại dữ liệu",
  "period",
  "ngay",
  "day",
  "type_data",
  "data_type",
  "loai_du_lieu",
  "ma_don_vi",
  "bukrs",
  "data_upload_id",
  "created_by",
  "created_at",
  "modified_by",
  "modified_at",
  "syncdate",
  "version",
  "maxdate",
  "tenant_id",
  "delete_flag",
  "is_deleted",
];

const PRIORITY_COLUMNS = [
  "id",
  "bukrs",
  "matnr",
  "kunnr",
  "mã sản phẩm",
  "tên sản phẩm",
  "dvt",
  "số lượng tồn kho cuối ngày",
  "số lượng đi đường",
];

const PRIORITY_EN = [
  "product_code",
  "product_name",
  "unit",
  "qty_onhand",
  "qty_in_transit",
];

const normalizeKey = (key: string): string => {
  return key
    .toLowerCase()
    .replace(/[_\s-]/g, "")
    .trim();
};

const getReportName = (tableName?: string): string => {
  if (!tableName) return "BÁO CÁO";

  const reportNames: Record<string, string> = {
    tồn_kho: "SỐ LIỆU TỒN KHO CUỐI NGÀY",
    tkv: "SỐ LIỆU TỒN KHO CUỐI NGÀY",
    hợp_đồng: "SỐ THEO DÕI HỢP ĐỒNG",
    hop_dong: "SỐ THEO DÕI HỢP ĐỒNG",
    sales: "BÁO CÁO BÁN HÀNG",
    report_sales: "BÁO CÁO BÁN HÀNG",
  };

  for (const [key, name] of Object.entries(reportNames)) {
    if (tableName.toLowerCase().includes(key)) {
      return name;
    }
  }

  return tableName.toUpperCase() || "BÁO CÁO";
};

const ResultPanel = ({
  results,
  reportHeader,
  loading,
  errorMessage,
}: ResultPanelProps) => {
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full gap-3">
        <Spin size="large" />
        <span className="text-gray-500 text-sm">Đang tải dữ liệu từ Vinacomin...</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full p-6">
        <Alert
          type="warning"
          message="Không thể lấy dữ liệu báo cáo từ Vinacomin"
          description={
            <div className="space-y-2 text-sm mt-1">
              <p>{errorMessage}</p>
              <p className="text-gray-500">
                💡 Gợi ý: Hãy kiểm tra xem tài khoản kết nối Vinacomin đã được cấu hình tại trang{" "}
                <b>Cấu hình tài khoản TKV</b> (/account-config) hay chưa, hoặc thử chọn Năm / Tháng / Ngày cụ thể.
              </p>
            </div>
          }
          showIcon
          className="max-w-lg shadow-sm"
        />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full p-6">
        <Empty
          description={
            <div className="text-center space-y-2 max-w-md">
              <p className="font-medium text-gray-700">Chưa có dữ liệu cho báo cáo này từ Vinacomin</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                💡 Nếu báo cáo đã được upload/đồng bộ thành công, hãy chọn <b>Năm</b>, <b>Tháng</b> hoặc <b>Ngày</b> trên thanh công cụ phía trên và bấm <b>Tìm kiếm</b>.
              </p>
            </div>
          }
        />
      </div>
    );
  }

  // ========== ĐỌC NĂM / THÁNG / NGÀY TỪ ROW ĐẦU TIÊN ==========
  const firstRow = results[0] || {};

  // Đọc năm: ưu tiên từ data response, fallback về filter
  const displayYear: number | undefined =
    firstRow["Năm"] ??
    firstRow["YEAR"] ??
    firstRow["year"] ??
    reportHeader?.year;

  // Đọc tháng: ưu tiên từ data response, fallback về filter period
  const displayMonth: number | undefined =
    firstRow["Tháng"] ??
    firstRow["MONTH"] ??
    firstRow["month"] ??
    firstRow["PERIOD"] ??
    firstRow["period"] ??
    (reportHeader?.period ? Number(reportHeader.period) : undefined);

  // Đọc ngày: ưu tiên từ data response, fallback về filter day
  const displayDay: number | undefined =
    firstRow["Ngày"] ??
    firstRow["NGAY"] ??
    firstRow["ngay"] ??
    firstRow["DAY"] ??
    firstRow["day"] ??
    (reportHeader?.day ? Number(reportHeader.day) : undefined);

  // ========== TÊN BÁO CÁO ==========
  // Ưu tiên tmplName (tên template thực) từ URL, fallback suy đoán từ tableName
  const reportName = reportHeader?.tmplName
    ? reportHeader.tmplName.toUpperCase()
    : getReportName(reportHeader?.tableName);

  // ========== FORMAT THỜI GIAN ==========
  let periodText = "";
  if (displayYear) {
    if (displayDay && displayMonth) {
      periodText = `Ngày ${displayDay} tháng ${displayMonth} năm ${displayYear}`;
    } else if (displayMonth) {
      periodText = `Tháng ${displayMonth} năm ${displayYear}`;
    } else {
      periodText = `Năm ${displayYear}`;
    }
  }

  // ========== XỬ LÝ CỘT ==========
  const allKeys = Object.keys(results[0] || {});

  const filteredKeys = allKeys.filter((key) => {
    const normalized = normalizeKey(key);
    return !META_COLUMNS.some((meta) => normalized === normalizeKey(meta));
  });

  const sortedKeys = Array.from(
    new Set([
      ...PRIORITY_COLUMNS.filter((k) => filteredKeys.includes(k)),
      ...PRIORITY_EN.filter((k) => filteredKeys.includes(k)),
      ...filteredKeys.filter(
        (k) =>
          ![...PRIORITY_COLUMNS, ...PRIORITY_EN].includes(k) &&
          !META_COLUMNS.some((meta) => normalizeKey(k) === normalizeKey(meta))
      ),
    ])
  );

  const columns = sortedKeys.map((key) => ({
    title: key.toUpperCase(),
    dataIndex: key,
    key: key,
    width: 150,
    ellipsis: true,
    render: (text: any) => {
      let val = text?.toString() || "-";
      if (
        (key === "id" || key === "data_upload_id") &&
        typeof text === "string"
      ) {
        val = text.slice(0, 8) + (text.length > 8 ? "..." : "");
      }
      return (
        <span title={text} className="text-sm">
          {val}
        </span>
      );
    },
  }));

  const tableScrollX = Math.max(columns.length * 150, 1200);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-50 h-full overflow-hidden print:overflow-visible">
      {/* ===== REPORT HEADER ===== */}
      <div className="shrink-0 px-8 py-5 bg-white border-b print:border-0 print:py-3 print:px-4">
        {/* Tên công ty - căn giữa */}
        <div className="text-center mb-1 print:mb-0.5">
          <div className="font-bold text-sm print:text-xs tracking-wide text-gray-700">
            {COMPANY_NAME}
          </div>
        </div>

        {/* Tên báo cáo - căn giữa */}
        <div className="text-center mb-0.5">
          <h1 className="font-bold text-lg print:text-sm uppercase tracking-wide text-gray-900">
            {reportName}
          </h1>
        </div>

        {/* Thời gian báo cáo - căn giữa */}
        {periodText && (
          <div className="text-center">
            <p className="text-sm text-gray-600 print:text-xs">{periodText}</p>
          </div>
        )}
      </div>

      {/* ===== TABLE CONTAINER ===== */}
      <div className="flex-1 min-h-0 p-4 print:p-0 print:pt-4">
        <Card
          className="h-full shadow-sm border-0 rounded-xl print:shadow-none print:rounded-none
  [&>.ant-card-body]:p-0 
  [&>.ant-card-body]:h-full 
  [&>.ant-card-body]:overflow-x-auto
  print:[&>.ant-card-body]:overflow-visible"
        >
          <Table
            dataSource={results}
            columns={columns}
            rowKey={(record, index) => record.id || index}
            pagination={{
              pageSize: 50,
              showSizeChanger: true,
              size: "small",
              position: ["bottomRight"],
            }}
            scroll={{ x: tableScrollX, y: "calc(100% - 60px)" }}
            tableLayout="fixed"
            size="small"
            bordered
            className="print:text-xs"
          />
        </Card>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .ant-pagination {
            display: none !important;
          }
          .ant-table-cell {
            padding: 6px 4px !important;
            font-size: 11px !important;
          }
          .ant-table-thead > tr > th {
            background-color: #f5f5f5 !important;
            padding: 6px 4px !important;
            font-size: 11px !important;
            font-weight: bold !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ResultPanel;