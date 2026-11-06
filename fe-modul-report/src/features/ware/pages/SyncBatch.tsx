import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  message,
  Tooltip,
  Card,
  Tag,
  Checkbox,
  Radio,
  Alert,
  Select,
  Space,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { WareBatchResponse, WareBatchSearch } from "../types/wareBacth";
import type { PageResponse } from "../../department/types/department";
import { wareBatchApi } from "../api/wareBathApi";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  FileTextOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
  FilterOutlined,
  EditOutlined,
  CopyOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { userPushApi } from "../../auth/api/accountConfigApi";
import type { UserPushResponse } from "../../auth/types/accountConfig";
import { departmentApi } from "../../department/api/departmentApi";
import { employeeApi } from "../../employee/api/employeeApi";
import { formatVNDate } from "../../../utils/dateUtils";
import { useNavigate } from "react-router-dom";

export interface SyncBatchResultItem {
  id: number | string;
  code: string;
  name: string;
  tableCode?: string;
  reportName?: string;
  reportYear?: number | null;
  reportMonth?: number | null;
  reportDay?: number | null;
  status: "success" | "warning" | "error";
  inserted: number;
  updated: number;
  errorMessage?: string;
  advice?: string;
}

const { Search } = Input;
const { Option } = Select;

export const SyncBatch: React.FC = () => {
  const [modal, contextHolder] = Modal.useModal();
  const [batches, setBatches] = useState<WareBatchResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [form] = Form.useForm();
  const [syncing, setSyncing] = useState(false);
  const [messageApi, contextHolderMessage] = message.useMessage();
  const [userPushConfig, setUserPushConfig] = useState<UserPushResponse | null>(null);
  const [pushStatusFilter, setPushStatusFilter] = useState<boolean | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [myDepartmentIds, setMyDepartmentIds] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [syncResultModalVisible, setSyncResultModalVisible] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncBatchResultItem[]>([]);
  const nav = useNavigate();
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await departmentApi.searchDepartment("", 0, 20000);
        setDepartments(res.content);
      } catch (error) {
        console.error("Lấy danh sách phòng ban thất bại", error);
      }
    };

    const fetchProfile = async () => {
      try {
        const profile = await employeeApi.getMyProfile();
        const ids = profile.departments?.map((d: { id: string }) => d.id) ?? [];
        setMyDepartmentIds(ids);
      } catch (error) {
        console.error("Lấy profile thất bại", error);
      }
    };

    fetchProfile();
    loadUserPushConfig();
    fetchDepartments(); // giữ nguyên
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const effectiveDeptIds =
        departmentFilter.length > 0
          ? departmentFilter // user đã chọn cụ thể
          : myDepartmentIds; // mặc định: toàn bộ phòng ban của mình

      const params: WareBatchSearch = {
        page,
        limit,
        keyword: searchKeyword,
        status: "Da_Phe_Duyet",
        departmentIds: effectiveDeptIds.length > 0 ? effectiveDeptIds : null,
      };
      const res: PageResponse<WareBatchResponse> =
        await wareBatchApi.searchWareBatch(params);
      setBatches(res.content);
      setTotal(res.totalElements);
    } catch (error) {
      messageApi.error("Lấy danh sách báo cáo thất bại");
    } finally {
      setLoading(false);
    }
  };

  const loadUserPushConfig = async () => {
    try {
      const res = await userPushApi.getAllUserPush();
      if (res && res.length > 0) {
        setUserPushConfig(res[0]);
      } else {
        setUserPushConfig(null);
      }
    } catch (error) {
      console.log(error);
      setUserPushConfig(null);
    }
  };

  useEffect(() => {
    if (myDepartmentIds.length === 0) return;
    fetchBatches();
  }, [page, searchKeyword, departmentFilter, myDepartmentIds]);

  // Filter FE cho isPushed
  const filteredBatches = useMemo(() => {
    if (pushStatusFilter === null) {
      return batches;
    }
    return batches.filter((batch) => batch.isPushed === pushStatusFilter);
  }, [batches, pushStatusFilter]);


  const getStatusBadge = (status: string) => {
    const statusConfig: {
      [key: string]: { color: string; label: string };
    } = {
      Cho_Phe_Duyet: {
        color: "orange",
        label: "Chờ duyệt",
      },
      Da_Phe_Duyet: {
        color: "success",
        label: "Đã duyệt",
      },
      Tu_Choi_Phe_Duyet: {
        color: "error",
        label: "Từ chối",
      },
    };

    const config = statusConfig[status] || {
      color: "default",
      label: status,
    };

    return (
      <Tag color={config.color} className="px-3 py-1 text-sm font-medium">
        {config.label}
      </Tag>
    );
  };

  const checkDuplicates = (batches: WareBatchResponse[]): string[] => {
    const warnings: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      for (let j = i + 1; j < batches.length; j++) {
        const a = batches[i];
        const b = batches[j];

        if (a.name !== b.name) continue;
        if (a.reportYear !== b.reportYear) continue;

        // Báo cáo Năm: cả 2 đều không có month và không có day
        if (!a.reportMonth && !a.reportDay && !b.reportMonth && !b.reportDay) {
          warnings.push(
            `Có 2 báo cáo "${a.name}" trùng tên, trùng năm (${a.reportYear}). Hãy bỏ chọn 1 báo cáo để tránh lặp dữ liệu.`
          );
          continue;
        }

        // Báo cáo Tháng: cả 2 đều có month, không có day, month giống nhau
        if (
          a.reportMonth && b.reportMonth &&
          !a.reportDay && !b.reportDay &&
          a.reportMonth === b.reportMonth
        ) {
          warnings.push(
            `Có 2 báo cáo "${a.name}" trùng tên, trùng năm (${a.reportYear}), trùng tháng (${a.reportMonth}). Hãy bỏ chọn 1 báo cáo để tránh lặp dữ liệu.`
          );
          continue;
        }

        // Báo cáo Ngày: cả 2 đều có month, có day, month + day giống nhau
        if (
          a.reportMonth && b.reportMonth &&
          a.reportDay && b.reportDay &&
          a.reportMonth === b.reportMonth &&
          a.reportDay === b.reportDay
        ) {
          warnings.push(
            `Có 2 báo cáo "${a.name}" trùng tên, trùng năm (${a.reportYear}), trùng tháng (${a.reportMonth}), trùng ngày (${a.reportDay}). Hãy bỏ chọn 1 báo cáo để tránh lặp dữ liệu.`
          );
          continue;
        }
      }
    }

    return warnings;
  };

  const isBatchSelectable = (batch: WareBatchResponse) => {
    if (batch.wareBatchStatus !== "Da_Phe_Duyet") return false;
    // Nếu chọn Cập nhật dữ liệu (deleteMissing = true), cho phép chọn lại các batch đã push
    // Nếu chọn Đồng bộ dữ liệu mới (deleteMissing = false), chỉ cho chọn batch chưa push
    return deleteMissing || !batch.isPushed;
  };

  const selectableBatches = useMemo(
    () => filteredBatches.filter((b) => isBatchSelectable(b)),
    [filteredBatches, deleteMissing]
  );

  const selectedBatches = filteredBatches.filter((b) => selectedIds.includes(b.id!));

  const handleSyncClick = () => {
    if (selectedIds.length === 0) {
      messageApi.warning("Vui lòng chọn ít nhất một batch để đồng bộ");
      return;
    }

    const duplicateWarnings = checkDuplicates(selectedBatches);
    if (duplicateWarnings.length > 0) {
      modal.warning({
        title: "Phát hiện báo cáo trùng lặp",
        content: (
          <ul className="space-y-2 mt-2">
            {duplicateWarnings.map((w, i) => (
              <li key={i} style={{ color: "#ea580c", fontSize: 14 }}>• {w}</li>
            ))}
          </ul>
        ),
        okText: "Đã hiểu",
        width: 560,
      });
      return;
    }

    if (userPushConfig) {
      form.setFieldsValue({
        username: userPushConfig.username,
        password: userPushConfig.password || "",
      });
    } else {
      form.resetFields();
    }

    setSyncModalVisible(true);
  };

  const handleSyncConfirm = async (values: {
    username: string;
    password: string;
  }) => {
    if (selectedIds.length === 0) return;

    setSyncing(true);
    const results: SyncBatchResultItem[] = [];

    try {
      // Đồng bộ từng batch một và ghi nhận chi tiết kết quả từng batch
      for (const batchId of selectedIds) {
        const batchInfo = batches.find((b) => b.id === batchId);
        const code = batchInfo?.code || `ID ${batchId}`;
        const name = batchInfo?.name || batchInfo?.reportName || "Báo cáo";
        const tableCode = batchInfo?.tableCode || "-";
        const reportName = batchInfo?.reportName || batchInfo?.name || "-";
        const reportYear = batchInfo?.reportYear;
        const reportMonth = batchInfo?.reportMonth;
        const reportDay = batchInfo?.reportDay;

        try {
          const res = await wareBatchApi.pushWareBatch({
            id: batchId as number,
            deleteMissing: deleteMissing,
            username: values.username,
            password: values.password,
          });

          const inserted = Number(res?.inserted ?? 0);
          const updated = Number(res?.updated ?? 0);

          if (inserted === 0 && updated === 0) {
            // TKV phản hồi 200 nhưng không có bản ghi nào được thêm/sửa
            results.push({
              id: batchId,
              code,
              name,
              tableCode,
              reportName,
              reportYear,
              reportMonth,
              reportDay,
              status: "warning",
              inserted: 0,
              updated: 0,
              errorMessage:
                "Hệ thống TKV đã tiếp nhận yêu cầu nhưng ghi nhận 0 dòng thêm mới và 0 dòng cập nhật. Thực tế số liệu CHƯA được nạp vào kho dữ liệu TKV.",
              advice:
                "Vui lòng kiểm tra lại cấu hình keyColumns / scopeFilter của mẫu báo cáo hoặc kiểm tra xem file Excel có chứa dòng dữ liệu hợp lệ hay không.",
            });
          } else {
            results.push({
              id: batchId,
              code,
              name,
              tableCode,
              reportName,
              reportYear,
              reportMonth,
              reportDay,
              status: "success",
              inserted,
              updated,
            });
          }
        } catch (err: any) {
          console.error(`Sync batch ${batchId} failed:`, err);
          let rawMsg = "Đồng bộ thất bại";
          if (typeof err === "string") {
            rawMsg = err;
          } else if (err?.message) {
            rawMsg = err.message;
          } else if (err?.data?.message) {
            rawMsg = err.data.message;
          } else if (typeof err?.data === "string") {
            rawMsg = err.data;
          }

          let friendlyMsg = rawMsg;
          let advice = "Vui lòng liên hệ quản trị viên hoặc kiểm tra log hệ thống.";

          if (
            rawMsg.includes("401") ||
            rawMsg.toLowerCase().includes("sai thông tin tài khoản") ||
            rawMsg.toLowerCase().includes("sai tài khoản") ||
            rawMsg.toLowerCase().includes("unauthorized")
          ) {
            friendlyMsg =
              "Sai tài khoản hoặc mật khẩu kết nối API Vinacomin TKV. Không thể lấy mã xác thực Access Token.";
            advice =
              "Kiểm tra lại username/password đã nhập hoặc cấu hình lại tại trang 'Cấu hình tài khoản' (menu bên trái).";
          } else if (rawMsg.includes("chưa có dữ liệu dòng")) {
            friendlyMsg = "Batch này chưa có dòng dữ liệu nào để đồng bộ.";
            advice = "Kiểm tra lại việc parse file Excel khi tạo batch.";
          } else if (
            rawMsg.includes("Connection refused") ||
            rawMsg.includes("timeout") ||
            rawMsg.includes("Failed to connect")
          ) {
            friendlyMsg = `Lỗi kết nối máy chủ Vinacomin: ${rawMsg}`;
            advice = "Kiểm tra đường truyền VPN / mạng nội bộ kết nối tới hệ thống máy chủ Vinacomin.";
          } else if (rawMsg.startsWith("Push error:")) {
            try {
              const jsonPart = rawMsg.replace(/^Push error:\s*/, "");
              const parsed = JSON.parse(jsonPart);
              friendlyMsg = `Lỗi từ Vinacomin TKV: ${parsed.message || jsonPart}`;
            } catch {
              friendlyMsg = `Lỗi từ Vinacomin TKV: ${rawMsg}`;
            }
            advice =
              "Kiểm tra các trường dữ liệu và định dạng cột xem có khớp với bảng đích trên hệ thống Vinacomin hay không.";
          }

          results.push({
            id: batchId,
            code,
            name,
            tableCode,
            reportName,
            reportYear,
            reportMonth,
            reportDay,
            status: "error",
            inserted: 0,
            updated: 0,
            errorMessage: friendlyMsg,
            advice,
          });
        }
      }

      setSyncResults(results);
      setSyncModalVisible(false);
      fetchBatches();

      const successList = results.filter((r) => r.status === "success");
      const warningList = results.filter((r) => r.status === "warning");
      const errorList = results.filter((r) => r.status === "error");

      if (warningList.length === 0 && errorList.length === 0) {
        const totalIns = successList.reduce((acc, c) => acc + c.inserted, 0);
        const totalUpd = successList.reduce((acc, c) => acc + c.updated, 0);
        messageApi.success(
          `Đồng bộ thành công ${successList.length} batch lên TKV! (Thêm mới: ${totalIns}, Cập nhật: ${totalUpd})`
        );
        setSelectedIds([]);
        form.resetFields();
      } else {
        setSyncResultModalVisible(true);
        if (successList.length > 0) {
          messageApi.warning(
            `Đồng bộ hoàn tất: ${successList.length} thành công, ${warningList.length} cảnh báo (0 dòng), ${errorList.length} thất bại.`
          );
        } else {
          messageApi.error(`Đồng bộ thất bại toàn bộ ${results.length} batch. Vui lòng xem chi tiết lỗi.`);
        }
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyErrorReport = () => {
    const lines = [
      `=== BÁO CÁO KẾT QUẢ ĐỒNG BỘ DỮ LIỆU TKV ===`,
      `Thời gian: ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
      `Tổng số batch xử lý: ${syncResults.length}`,
      `Thành công: ${syncResults.filter((r) => r.status === "success").length}`,
      `Cảnh báo (0 dòng): ${syncResults.filter((r) => r.status === "warning").length}`,
      `Thất bại: ${syncResults.filter((r) => r.status === "error").length}`,
      `-------------------------------------------`,
    ];

    syncResults.forEach((item, index) => {
      lines.push(`[${index + 1}] Mã: ${item.code} | Báo cáo: ${item.name}`);
      lines.push(
        `    Bảng TKV: ${item.tableCode || "-"} | Năm/Tháng/Ngày: ${item.reportYear || "-"}/${item.reportMonth || "-"}/${item.reportDay || "-"}`
      );
      lines.push(`    Trạng thái: ${item.status.toUpperCase()}`);
      if (item.status === "success") {
        lines.push(`    Kết quả: Inserted ${item.inserted}, Updated ${item.updated}`);
      } else {
        lines.push(`    Nguyên nhân lỗi: ${item.errorMessage || "Không xác định"}`);
        if (item.advice) {
          lines.push(`    Gợi ý xử lý: ${item.advice}`);
        }
      }
      lines.push(`-------------------------------------------`);
    });

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      messageApi.success("Đã sao chép nội dung báo cáo lỗi vào clipboard!");
    });
  };

  const handleRetryFailed = () => {
    const failedIds = syncResults
      .filter((r) => r.status !== "success")
      .map((r) => r.id);

    setSelectedIds(failedIds);
    setSyncResultModalVisible(false);
    setSyncModalVisible(true);
  };

  const handleClearFilter = () => {
    setPushStatusFilter(null);
    setDepartmentFilter([]);
  };

  const columns: ColumnsType<WareBatchResponse> = [
    {
      title: (
        <Checkbox
          checked={
            selectableBatches.length > 0 &&
            selectableBatches.every((b) => selectedIds.includes(b.id!))
          }
          indeterminate={
            selectableBatches.some((b) => selectedIds.includes(b.id!)) &&
            !selectableBatches.every((b) => selectedIds.includes(b.id!))
          }
          onChange={(e) => {
            if (e.target.checked) {
              const selectableIds = selectableBatches.map((b) => b.id!);
              setSelectedIds(Array.from(new Set([...selectedIds, ...selectableIds])));
            } else {
              const selectableIdSet = new Set<string | number>(selectableBatches.map((b) => b.id!));
              setSelectedIds(selectedIds.filter((id) => !selectableIdSet.has(id)));
            }
          }}
        />
      ),
      dataIndex: "checkbox",
      key: "checkbox",
      width: 60,
      align: "center",
      render: (_, record) => {
        const isSelectable = isBatchSelectable(record);
        return (
          <Tooltip
            title={
              !isSelectable && record.isPushed && !deleteMissing
                ? "Báo cáo này đã từng được đẩy lên TKV. Để cập nhật lại dữ liệu, hãy chọn chế độ 'Cập nhật dữ liệu' ở trên."
                : ""
            }
          >
            <Checkbox
              checked={selectedIds.includes(record.id!)}
              disabled={!isSelectable}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds([...selectedIds, record.id!]);
                } else {
                  setSelectedIds(selectedIds.filter((id) => id !== record.id));
                }
              }}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "Mã",
      dataIndex: "code",
      key: "code",
      render: (text: string) => (
        <span className="font-medium text-gray-800">{text}</span>
      ),
    },
    {
      title: "Mã bảng",
      dataIndex: "tableCode",
      key: "tableCode",
      render: (text: string) => (
        <span className="font-medium text-gray-800">{text}</span>
      ),
    },
    {
      title: "Tên báo cáo",
      dataIndex: "reportName",
      key: "reportName",
      render: (text: string) => <span className="text-gray-700">{text}</span>,
    },
    {
      title: "Năm",
      dataIndex: "reportYear",
      key: "reportYear",
      render: (text: string) => (
        <span className="text-gray-600 line-clamp-2">{text || "-"}</span>
      ),
    },
    {
      title: "Tháng",
      dataIndex: "reportMonth",
      key: "reportMonth",
      render: (text: string) => (
        <span className="text-gray-600 line-clamp-2">{text || "-"}</span>
      ),
    },
    {
      title: "Ngày",
      dataIndex: "reportDay",
      key: "reportDay",
      render: (text: string) => (
        <span className="text-gray-600 line-clamp-2">{text || "-"}</span>
      ),
    },
    {
      title: "Người tạo",
      dataIndex: "employeeName",
      key: "employeeName",
      render: (text: string) => <span className="text-gray-700">{text}</span>,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (text: string) => (
        <span className="text-gray-600">{formatVNDate(text)}</span>
      ),
    },
    {
      title: "Upload TKV",
      dataIndex: "isPushed",
      key: "isPushed",
      align: "center",
      width: 120,
      render: (value: boolean) => (
        <Tooltip
          title={
            value
              ? "Đã đồng bộ lên TKV (có ghi nhận dữ liệu Insert/Update > 0)"
              : "Chưa đẩy dữ liệu lên TKV hoặc lần đẩy trước ghi nhận 0 dòng"
          }
        >
          {value ? (
            <Tag
              color="success"
              className="px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-medium border-0 bg-emerald-50 text-emerald-700"
            >
              <CheckCircleOutlined className="text-sm" />
              <span>Đã đẩy</span>
            </Tag>
          ) : (
            <Tag
              color="error"
              className="px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-medium border-0 bg-rose-50 text-rose-700"
            >
              <CloseCircleOutlined className="text-sm" />
              <span>Chưa đẩy</span>
            </Tag>
          )}
        </Tooltip>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "wareBatchStatus",
      key: "wareBatchStatus",
      render: (status: string) => getStatusBadge(status),
    },
    {
      title: "Thao tác",
      key: "action",
      align: "center",
      width: 140,
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => nav(`/ware/batch-approve/${record.id}`)}
              className="bg-blue-600! hover:bg-blue-700!"
              size="large"
            >
              Xem
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="px-6 py-6 bg-linear-to-br from-gray-50 to-gray-100 min-h-screen">
      {contextHolderMessage}
      {contextHolder}

      <Card className="shadow-sm border-0 rounded-xl mb-6">
        <div className="flex justify-between items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-64">
            <Search
              placeholder="Tìm kiếm theo mã, tên hoặc mô tả..."
              onSearch={(value) => setSearchKeyword(value || null)}
              allowClear
              size="large"
              prefix={<SearchOutlined className="text-gray-400" />}
              className="flex-1 rounded-lg"
              enterButton={
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Tìm kiếm
                </Button>
              }
            />

            <Select
              placeholder="Lọc theo trạng thái đồng bộ"
              value={pushStatusFilter}
              onChange={(value) => setPushStatusFilter(value)}
              allowClear
              size="large"
              className="w-56"
              suffixIcon={<FilterOutlined />}
            >
              <Option value={true}>
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined className="text-black!" />
                  <span>Đã đồng bộ</span>
                </div>
              </Option>
              <Option value={false}>
                <div className="flex items-center gap-2">
                  <CloseCircleOutlined className="text-red-600!" />
                  <span>Chưa đồng bộ</span>
                </div>
              </Option>
            </Select>

            <Select
              mode="multiple"
              placeholder="Lọc theo phòng ban"
              value={departmentFilter}
              onChange={(value) => setDepartmentFilter(value)}
              allowClear
              size="large"
              className="w-56"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => {
                const label = typeof option?.children === "string" ? option.children : "";
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {/* Chỉ hiện phòng ban mà nhân viên thuộc về */}
              {departments
                .filter((dept) => myDepartmentIds.includes(dept.id))
                .map((dept) => (
                  <Option key={dept.id} value={dept.id}>
                    {dept.name}
                  </Option>
                ))}
            </Select>

            {(pushStatusFilter !== null || departmentFilter.length > 0) && (
              <Button onClick={handleClearFilter} size="large">
                Xóa bộ lọc
              </Button>
            )}
          </div>

          <Tooltip
            title={
              selectedIds.length === 0
                ? "Vui lòng chọn ít nhất một batch"
                : `${selectedIds.length} batch được chọn`
            }
          >
            <Button
              type="primary"
              size="large"
              icon={<CloudUploadOutlined />}
              onClick={handleSyncClick}
              disabled={selectedIds.length === 0}
              className="bg-blue-600! hover:bg-blue-700! h-10 px-6"
            >
              Đồng bộ ({selectedIds.length})
            </Button>
          </Tooltip>
        </div>

        {/* Chọn chế độ đồng bộ */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between flex-wrap gap-4">
          <div className="text-sm text-gray-600">
            {deleteMissing ? (
              <span className="text-blue-700 font-medium flex items-center gap-1.5">
                <InfoCircleOutlined className="text-blue-600" />
                Chế độ <strong>Cập nhật dữ liệu</strong>: Cho phép chọn lại cả các báo cáo đã từng đồng bộ để đẩy đè / cập nhật lại dữ liệu lên TKV.
              </span>
            ) : (
              <span className="text-gray-600 flex items-center gap-1.5">
                <InfoCircleOutlined className="text-gray-500" />
                Chế độ <strong>Đồng bộ dữ liệu mới</strong>: Chỉ cho phép chọn các báo cáo chưa từng đẩy dữ liệu lên TKV.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Radio.Group
              onChange={(e) => setDeleteMissing(e.target.value)}
              value={deleteMissing}
              className="text-gray-700 font-medium"
            >
              <Radio value={false}>Đồng bộ dữ liệu mới</Radio>
              <Radio value={true}>Cập nhật dữ liệu</Radio>
            </Radio.Group>
          </div>
        </div>
      </Card>

      <Card className="shadow-sm border-0 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100">
              <FileTextOutlined className="text-blue-600 text-lg" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 m-0">
              Đồng bộ Batch
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              Hiển thị {filteredBatches.length} / {batches.length} batch
            </div>
            <Button
              size="large"
              icon={<ReloadOutlined />}
              onClick={() => fetchBatches()}
              loading={loading}
              className="h-10 px-6"
            >
              Tải lại
            </Button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">{selectedIds.length}</span> batch
              được chọn để đồng bộ
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredBatches}
            loading={loading}
            pagination={{
              current: page + 1,
              pageSize: limit,
              total: total,
              onChange: (pageNumber) => setPage(pageNumber - 1),
              onShowSizeChange: (_, newSize) => {
                setPage(0);
                setLimit(newSize);
              },
              showSizeChanger: true,
              showTotal: (total) => `Tổng cộng ${total} batch`,
              pageSizeOptions: [10, 20, 50],
            }}
            size="middle"
            bordered
            rowClassName={(index: any) =>
              index % 2 === 0
                ? "bg-white hover:bg-gray-50 transition-colors"
                : "bg-gray-50 hover:bg-gray-100 transition-colors"
            }
            scroll={{ x: 1200 }}
          />
        </div>

        {filteredBatches.length === 0 && !loading && (
          <div className="text-center py-16 bg-gray-50 rounded-lg mt-4">
            <FileTextOutlined className="text-4xl text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg">
              {pushStatusFilter !== null
                ? "Không có batch nào phù hợp với bộ lọc"
                : "Không có batch nào"}
            </p>
          </div>
        )}
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-100">
              <CloudUploadOutlined className="text-blue-600 text-lg" />
            </div>
            <div className="text-lg font-semibold text-gray-800">
              Đồng bộ dữ liệu TKV
            </div>
          </div>
        }
        open={syncModalVisible}
        onCancel={() => setSyncModalVisible(false)}
        footer={null}
        width={600}
      >
        <div className="py-4">
          {/* Thêm alert hiển thị thông tin config */}
          {userPushConfig && (
            <Alert
              message="Sử dụng tài khoản đã cấu hình"
              description={
                <div>
                  <p className="mb-1">Tên đăng nhập: <strong>{userPushConfig.username}</strong></p>
                  {userPushConfig.password && (
                    <p className="mb-0">Mật khẩu đã được lưu trong hệ thống</p>
                  )}
                </div>
              }
              type="info"
              showIcon
              className="mb-4 rounded-lg"
            />
          )}

          {selectedBatches.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-3">
                Batch sẽ được đồng bộ:
              </p>
              <ul className="space-y-2">
                {selectedBatches.map((batch) => (
                  <li key={batch.id} className="text-sm text-blue-700">
                    • {batch.code} - {batch.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Form
            layout="vertical"
            form={form}
            onFinish={handleSyncConfirm}
            className="py-4"
          >
            <Form.Item
              label={<span className="font-medium text-gray-800">Tên đăng nhập</span>}
              name="username"
              rules={[{ required: true, message: "Vui lòng nhập username!" }]}
            >
              <Input
                placeholder="Nhập tên đăng nhập"
                size="large"
                className="rounded-lg"
                disabled={!!userPushConfig}
                prefix={userPushConfig ? <Tag color="blue">Từ cấu hình</Tag> : null}
              />
            </Form.Item>

            <Form.Item
              label={
                <span className="font-medium text-gray-800">Mật khẩu</span>
              }
              name="password"
              rules={[{ required: true, message: "Vui lòng nhập password!" }]}
            >
              <Input.Password
                placeholder="Nhập mật khẩu"
                size="large"
                className="rounded-lg"
                disabled={!!userPushConfig && !!userPushConfig.password}
                prefix={userPushConfig?.password ? <Tag color="green">Đã lưu</Tag> : null}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                icon={<CloudUploadOutlined />}
                loading={syncing}
                className="bg-blue-600! hover:bg-blue-700! h-11 font-medium rounded-lg"
              >
                Đồng bộ {selectedIds.length} batch
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* Modal Báo cáo Kết quả & Form Lỗi Chi Tiết khi Đồng bộ TKV */}
      <Modal
        title={
          <div className="flex items-center gap-3 pb-3 border-b">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                syncResults.some((r) => r.status === "error")
                  ? "bg-red-100 text-red-600"
                  : "bg-amber-100 text-amber-600"
              }`}
            >
              {syncResults.some((r) => r.status === "error") ? (
                <CloseCircleOutlined className="text-xl" />
              ) : (
                <WarningOutlined className="text-xl" />
              )}
            </div>
            <div>
              <div className="text-lg font-bold text-gray-800">
                Kết quả & Báo cáo Lỗi Đồng bộ TKV
              </div>
              <div className="text-xs text-gray-500 font-normal">
                Đối soát chi tiết trạng thái gửi giao dịch lên hệ thống Vinacomin TKV
              </div>
            </div>
          </div>
        }
        open={syncResultModalVisible}
        onCancel={() => setSyncResultModalVisible(false)}
        footer={
          <div className="flex justify-between items-center w-full pt-2 flex-wrap gap-2">
            <Button
              icon={<CopyOutlined />}
              onClick={handleCopyErrorReport}
            >
              Sao chép nội dung lỗi
            </Button>
            <Space>
              {syncResults.some((r) => r.status !== "success") && (
                <Button
                  type="primary"
                  danger
                  icon={<ReloadOutlined />}
                  onClick={handleRetryFailed}
                >
                  Thử lại các batch lỗi ({syncResults.filter((r) => r.status !== "success").length})
                </Button>
              )}
              <Button onClick={() => setSyncResultModalVisible(false)}>
                Đóng
              </Button>
            </Space>
          </div>
        }
        width={850}
      >
        <div className="py-3 space-y-4">
          {/* Thẻ thống kê nhanh */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <div className="text-xs text-gray-500">Tổng batch</div>
              <div className="text-xl font-bold text-gray-800">{syncResults.length}</div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
              <div className="text-xs text-emerald-600 font-medium">Thành công</div>
              <div className="text-xl font-bold text-emerald-700">
                {syncResults.filter((r) => r.status === "success").length}
              </div>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
              <div className="text-xs text-amber-600 font-medium">Cảnh báo (0 dòng)</div>
              <div className="text-xl font-bold text-amber-700">
                {syncResults.filter((r) => r.status === "warning").length}
              </div>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-center">
              <div className="text-xs text-rose-600 font-medium">Thất bại</div>
              <div className="text-xl font-bold text-rose-700">
                {syncResults.filter((r) => r.status === "error").length}
              </div>
            </div>
          </div>

          {/* Cảnh báo quan trọng */}
          <Alert
            message="Lưu ý đối soát số liệu hệ thống TKV"
            description="Các batch có trạng thái 'Thất bại' hoặc 'Cảnh báo (0 dòng)' thì dữ liệu thực tế CHƯA ĐƯỢC CẬP NHẬT vào hệ thống Vinacomin TKV. Trạng thái 'Đã duyệt' trên hệ thống nội bộ chỉ thể hiện cấp quản lý đã duyệt báo cáo, cần kiểm tra nguyên nhân lỗi bên dưới để xử lý triệt để."
            type="warning"
            showIcon
            className="rounded-lg"
          />

          {/* Danh sách chi tiết các batch */}
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {syncResults.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  item.status === "success"
                    ? "bg-emerald-50/40 border-emerald-200"
                    : item.status === "warning"
                    ? "bg-amber-50/50 border-amber-300"
                    : "bg-rose-50/50 border-rose-300"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{item.code}</span>
                    <span className="text-gray-400">•</span>
                    <span className="font-medium text-gray-700">{item.name}</span>
                    {item.tableCode && item.tableCode !== "-" && (
                      <Tag color="cyan" className="font-mono text-xs">
                        {item.tableCode}
                      </Tag>
                    )}
                  </div>
                  <div>
                    {item.status === "success" && (
                      <Tag color="success" className="font-medium">
                        ✓ Thành công (Thêm: {item.inserted}, Sửa: {item.updated})
                      </Tag>
                    )}
                    {item.status === "warning" && (
                      <Tag color="warning" className="font-medium">
                        ⚠ Cảnh báo: 0 dòng nạp vào TKV
                      </Tag>
                    )}
                    {item.status === "error" && (
                      <Tag color="error" className="font-medium">
                        ✕ Thất bại
                      </Tag>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-2">
                  Kỳ báo cáo: Năm {item.reportYear || "-"}{" "}
                  {item.reportMonth ? `| Tháng ${item.reportMonth}` : ""}{" "}
                  {item.reportDay ? `| Ngày ${item.reportDay}` : ""}
                </div>

                {item.errorMessage && (
                  <div className="p-2.5 bg-white/90 rounded border border-gray-200 text-xs space-y-1">
                    <div className="text-rose-700 font-medium">
                      <strong>Chi tiết lỗi / phản hồi:</strong> {item.errorMessage}
                    </div>
                    {item.advice && (
                      <div className="text-gray-600">
                        <strong>Hướng dẫn xử lý:</strong> {item.advice}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <style>{`
        .bg-linear-to-br {
          background: linear-gradient(to bottom right, #f9fafb, #f3f4f6);
        }
        .ant-table-cell {
          padding: 12px !important;
        }
        .ant-table-header .ant-table-cell {
          background: linear-gradient(to right, #f3f4f6, #e5e7eb);
          font-weight: 600;
          color: #374151;
        }
        .ant-table-row {
          transition: all 0.2s ease;
        }
        .ant-table-row:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .ant-input:focus,
        .ant-input-affix-wrapper:focus,
        .ant-input-affix-wrapper-focused {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
        .ant-input-password:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};