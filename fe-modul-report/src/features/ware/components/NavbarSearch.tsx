import { useState } from "react";
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
} from "@ant-design/icons";
import type { TableOption } from "../types/wareTemplate";
import { wareTemplateApi } from "../api/wareTemplateApi";

interface NavbarSearchProps {
  table: string;
  setTable: (val: string) => void;
  year?: number;
  setYear: (val?: number) => void;
  period?: string;
  setPeriod: (val?: string) => void;
  day?: string;
  setDay: (val?: string) => void;
  reportType?: "MONTH" | "YEAR";
  setReportType: (val?: "MONTH" | "YEAR") => void;
  onSearch: (tableOverride?: string) => Promise<void>;
}

const NavbarSearch = ({
  table,
  setTable,
  year,
  setYear,
  period,
  setPeriod,
  day,
  setDay,
  reportType,
  setReportType,
  onSearch,
}: NavbarSearchProps) => {
  const [tableLabel, setTableLabel] = useState("");
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableOptions, setTableOptions] = useState<TableOption[]>([]);
  const [loadingTableOptions, setLoadingTableOptions] = useState(false);

  const fetchTables = async (keyword = "") => {
    setLoadingTableOptions(true);
    try {
      const res = await wareTemplateApi.getOptionTable(keyword);
      setTableOptions(res);
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
          {/* <div className="min-w-60 max-w-[380px] flex-[0_1_320px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Mã bảng</div>
            <div className="relative">
              <Input
                size="large"
                value={table}
                prefix={<TableOutlined />}
                placeholder="Nhập tableCode"
                className="pr-10"
                onChange={(e) => {
                  setTable(e.target.value);
                  setTableLabel("");
                }}
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 text-xl font-bold w-8 h-8 flex items-center justify-center bg-white rounded hover:bg-blue-50 transition-colors z-10"
                onClick={() => {
                  setTableModalOpen(true);
                  fetchTables();
                }}
                type="button"
              >
                +
              </button>
            </div>
          </div> */}

          <div className="w-[150px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Năm</div>
            <Input
              size="large"
              className="w-full"
              value={year ?? ""}
              placeholder="2026"
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

          <div className="w-[150px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Tháng</div>
            <Input
              size="large"
              className="w-full"
              value={period ?? ""}
              placeholder="04"
              disabled={isYearReport}
              onChange={(e) => {
                const val = e.target.value.trim();
                setPeriod(val || undefined);
              }}
            />
          </div>

          <div className="w-[150px]">
            <div className="text-xs font-semibold text-gray-600 mb-1">Ngày</div>
            <Input
              size="large"
              className="w-full"
              value={day ?? ""}
              placeholder="01"
              disabled={isMonthReport || isYearReport}
              onChange={(e) => {
                const val = e.target.value.trim();
                setDay(val || undefined);
              }}
            />
          </div>

          <div className="w-[220px]">
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
            {tableLabel ? (
              <Tag color="blue" className="mr-0! max-w-[260px] truncate">
                {tableLabel}
              </Tag>
            ) : null}
            <Button
              size="large"
              type="primary"
              icon={<SearchOutlined />}
              className="bg-[#1976D2]! hover:bg-blue-700!"
              onClick={() => {
                void handleSearch();
              }}
            >
              Xem
            </Button>
          </div>
        </div>
        {/* Đã bỏ phần tìm kiếm nâng cao theo yêu cầu */}
      </Card>

      <Modal
        open={tableModalOpen}
        footer={null}
        width={640}
        title={
          <div className="flex items-center gap-2">
            <TableOutlined /> Chọn bảng dữ liệu
          </div>
        }
        onCancel={() => setTableModalOpen(false)}
      >
        <Input.Search
          size="large"
          placeholder="Nhập tên hoặc mã bảng..."
          className="mb-4"
          onChange={(e) => fetchTables(e.target.value)}
        />

        {loadingTableOptions ? (
          <div className="text-center py-8">
            <Spin />
          </div>
        ) : tableOptions.length === 0 ? (
          <Empty description="Không có dữ liệu" />
        ) : (
          <List
            dataSource={tableOptions}
            renderItem={(item) => (
              <List.Item
                className="cursor-pointer hover:bg-blue-50 rounded-lg px-3"
                onClick={async () => {
                  setTable(item.tableCode);
                  setTableLabel(item.tableName);
                  setTableModalOpen(false);
                  await handleSearch(item.tableCode);
                }}
              >
                <div>
                  <div className="font-semibold">{item.tableName}</div>
                  <div className="text-xs text-gray-500">
                    Mã: <Tag color="blue">{item.tableCode}</Tag>
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
