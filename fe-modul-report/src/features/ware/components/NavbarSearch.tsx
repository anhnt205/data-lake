import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Select,
  Spin,
  Tag,
} from "antd";
import {
  SearchOutlined,
  TableOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import type { TableOption } from "../types/wareTemplate";
import { wareTemplateApi } from "../api/wareTemplateApi";

interface NavbarSearchProps {
  table: string;
  setTable: (val: string) => void;
  tmplName?: string;
  setTmplName?: (val: string) => void;
  year?: number;
  setYear: (val?: number) => void;
  period?: string;
  setPeriod: (val?: string) => void;
  day?: string;
  setDay: (val?: string) => void;
  reportType?: "MONTH" | "YEAR";
  setReportType: (val?: "MONTH" | "YEAR") => void;
  loading?: boolean;
  onSearch: (tableOverride?: string, tmplOverride?: string) => Promise<void>;
}

const NavbarSearch = ({
  table,
  setTable,
  tmplName,
  setTmplName,
  year,
  setYear,
  period,
  setPeriod,
  day,
  setDay,
  reportType,
  setReportType,
  loading = false,
  onSearch,
}: NavbarSearchProps) => {
  const [tableLabel, setTableLabel] = useState("");
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableOptions, setTableOptions] = useState<TableOption[]>([]);
  const [loadingTableOptions, setLoadingTableOptions] = useState(false);

  useEffect(() => {
    if (table) {
      void fetchTableInfo(table);
    }
  }, [table]);

  const fetchTables = async (keyword = "") => {
    setLoadingTableOptions(true);
    try {
      const res = await wareTemplateApi.getOptionTable(keyword);
      setTableOptions(res || []);
    } finally {
      setLoadingTableOptions(false);
    }
  };

  const fetchTableInfo = async (tableCode: string) => {
    if (!tableCode) return;
    try {
      const res = await wareTemplateApi.getOptionTable(tableCode);
      if (res && res.length > 0) {
        setTableLabel(res[0].tableName);
      }
    } catch (error) {
      console.error("Error fetching table info:", error);
    }
  };

  const handleSearch = async (tableOverride?: unknown) => {
    const tableToSearch = typeof tableOverride === "string" ? tableOverride : table;
    await onSearch(tableToSearch);
    if (tableToSearch) {
      await fetchTableInfo(tableToSearch);
    }
  };

  const isMonthReport = reportType === "MONTH";
  const isYearReport = reportType === "YEAR";

  return (
    <div className="px-3 pt-3 pb-2 bg-gray-100 border-b border-gray-200">
      <Card className="shadow-sm border-0 rounded-xl">
        <div className="flex flex-wrap items-end gap-3">
          {/* Chọn bảng báo cáo */}
          <div className="min-w-[260px] max-w-[360px] flex-[1_1_280px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Bảng / Báo cáo</div>
            <div
              onClick={() => {
                setTableModalOpen(true);
                void fetchTables();
              }}
              className="h-10 px-3 border border-gray-300 hover:border-blue-500 rounded-lg flex items-center justify-between cursor-pointer bg-white transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <TableOutlined className="text-blue-600 shrink-0" />
                {table ? (
                  <div className="truncate text-sm font-medium text-gray-800">
                    <span className="font-semibold text-blue-700">{table}</span>
                    <span className="text-gray-500 text-xs ml-1.5">
                      ({tmplName || tableLabel || "Báo cáo"})
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">Chọn bảng dữ liệu...</span>
                )}
              </div>
              <Button size="small" type="link" icon={<SwapOutlined />} className="shrink-0 p-0 text-blue-600">
                Đổi
              </Button>
            </div>
          </div>

          <div className="w-[120px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Năm</div>
            <Input
              size="large"
              className="w-full"
              value={year ?? ""}
              placeholder="VD: 2026"
              onChange={(e) => {
                const val = e.target.value.trim();
                if (!val) {
                  setYear(undefined);
                  return;
                }
                const num = Number(val);
                setYear(Number.isNaN(num) ? undefined : num);
              }}
            />
          </div>

          <div className="w-[120px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Tháng</div>
            <Input
              size="large"
              className="w-full"
              value={period ?? ""}
              placeholder="VD: 04"
              disabled={isYearReport}
              onChange={(e) => {
                const val = e.target.value.trim();
                setPeriod(val || undefined);
              }}
            />
          </div>

          <div className="w-[120px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Ngày</div>
            <Input
              size="large"
              className="w-full"
              value={day ?? ""}
              placeholder="VD: 01"
              disabled={isMonthReport || isYearReport}
              onChange={(e) => {
                const val = e.target.value.trim();
                setDay(val || undefined);
              }}
            />
          </div>

          <div className="w-[200px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Loại báo cáo</div>
            <Select
              size="large"
              className="w-full"
              value={reportType ?? ""}
              placeholder="Mặc định / Theo ngày"
              onChange={(val) => {
                if (!val) {
                  setReportType(undefined);
                  return;
                }
                const nextType = val as "MONTH" | "YEAR";
                setReportType(nextType);
                if (nextType === "MONTH") {
                  setDay(undefined);
                  return;
                }
                setPeriod(undefined);
                setDay(undefined);
              }}
              options={[
                { value: "", label: "Mặc định" },
                { value: "MONTH", label: "Lũy kế theo tháng" },
                { value: "YEAR", label: "Lũy kế theo năm" },
              ]}
            />
          </div>

          <div className="flex-1 flex justify-end items-center gap-2">
            <Button
              size="large"
              type="primary"
              loading={loading}
              icon={<SearchOutlined />}
              className="bg-[#1976D2]! hover:bg-blue-700!"
              onClick={() => {
                void handleSearch();
              }}
            >
              Xem báo cáo
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={tableModalOpen}
        footer={null}
        width={640}
        title={
          <div className="flex items-center gap-2 font-semibold">
            <TableOutlined className="text-blue-600" /> Chọn bảng dữ liệu cần xem
          </div>
        }
        onCancel={() => setTableModalOpen(false)}
      >
        <Input.Search
          size="large"
          placeholder="Nhập tên hoặc mã bảng..."
          className="mb-4"
          allowClear
          onChange={(e) => fetchTables(e.target.value)}
        />

        {loadingTableOptions ? (
          <div className="text-center py-8">
            <Spin tip="Đang tải danh sách bảng..." />
          </div>
        ) : tableOptions.length === 0 ? (
          <Empty description="Không tìm thấy bảng phù hợp" />
        ) : (
          <List
            dataSource={tableOptions}
            className="max-h-[400px] overflow-y-auto"
            renderItem={(item) => (
              <List.Item
                className="cursor-pointer hover:bg-blue-50 rounded-lg px-3 transition-colors"
                onClick={async () => {
                  setTable(item.tableCode);
                  setTableLabel(item.tableName);
                  if (setTmplName) setTmplName(item.tableName);
                  setTableModalOpen(false);
                  await onSearch(item.tableCode, item.tableName);
                }}
              >
                <div>
                  <div className="font-semibold text-gray-800">{item.tableName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Mã bảng: <Tag color="blue">{item.tableCode}</Tag>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default NavbarSearch;
