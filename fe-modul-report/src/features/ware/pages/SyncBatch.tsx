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
} from "@ant-design/icons";
import { userPushApi } from "../../auth/api/accountConfigApi";
import type { UserPushResponse } from "../../auth/types/accountConfig";
import { departmentApi } from "../../department/api/departmentApi";
import { employeeApi } from "../../employee/api/employeeApi";
import { useNavigate } from "react-router-dom";

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

  const selectedBatches = filteredBatches.filter((b) => selectedIds.includes(b.id!));

  const handleSyncClick = () => {
    if (selectedIds.length === 0) {
      messageApi.warning("Vui lòng chọn ít nhất một batch để đồng bộ");
      return;
    }

    const duplicateWarnings = checkDuplicates(selectedBatches);
    if (duplicateWarnings.length > 0) {
      modal.warning({  // ✅ dùng modal.warning thay vì Modal.warning
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
    const errors: { name: string; errorMsg: string }[] = [];
    let successCount = 0;

    try {
      for (const batchId of selectedIds) {
        const batchItem = selectedBatches.find((b) => b.id === batchId);
        const batchName = batchItem?.name || batchItem?.code || `Batch #${batchId}`;

        try {
          await wareBatchApi.pushWareBatch({
            id: batchId as number,
            deleteMissing: deleteMissing,
            username: values.username,
            password: values.password,
          });
          successCount++;
        } catch (error: any) {
          console.error(`Lỗi đồng bộ batch ${batchId}:`, error);
          const errorMsg =
            error?.response?.data?.message ||
            (typeof error?.response?.data === "string" ? error.response.data : null) ||
            error?.message ||
            error?.data?.message ||
            (typeof error?.data === "string" ? error.data : null) ||
            "Lỗi không xác định";
          errors.push({ name: batchName, errorMsg });
        }
      }

      setSyncModalVisible(false);
      setSelectedIds([]);
      form.resetFields();
      fetchBatches();

      if (errors.length === 0) {
        messageApi.success(`Đồng bộ thành công ${successCount} batch`);
      } else {
        if (successCount > 0) {
          messageApi.warning(
            `Đồng bộ thành công ${successCount} batch, thất bại ${errors.length} batch`
          );
        } else {
          messageApi.error(`Đồng bộ thất bại toàn bộ ${errors.length} batch`);
        }

        modal.error({
          title: "Chi tiết lỗi đồng bộ",
          content: (
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {errors.map((err, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: 8,
                    padding: 8,
                    backgroundColor: "#fff2f0",
                    borderRadius: 6,
                    border: "1px solid #ffccc7",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#cf1322" }}>
                    {err.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#a8071a" }}>
                    {err.errorMsg}
                  </div>
                </div>
              ))}
            </div>
          ),
          width: 520,
          okText: "Đã hiểu",
        });
      }
    } catch (error: any) {
      console.error("Lỗi đồng bộ batch:", error);
      const mainErrorMsg =
        error?.message ||
        error?.data?.message ||
        (typeof error?.data === "string" ? error.data : null) ||
        "Đồng bộ batch thất bại";
      messageApi.error(mainErrorMsg);
    } finally {
      setSyncing(false);
    }
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
            selectedIds.length > 0 &&
            selectedIds.length ===
            filteredBatches.filter(
              (b) => b.wareBatchStatus === "Da_Phe_Duyet"
            ).length
          }
          indeterminate={
            selectedIds.length > 0 &&
            selectedIds.length <
            filteredBatches.filter(
              (b) => b.wareBatchStatus === "Da_Phe_Duyet"
            ).length
          }
          onChange={(e) => {
            if (e.target.checked) {
              const selectableIds = filteredBatches
                .filter(
                  (b) => b.wareBatchStatus === "Da_Phe_Duyet"
                )
                .map((b) => b.id!);
              setSelectedIds(selectableIds);

            } else {
              setSelectedIds([]);
            }
          }}
        />
      ),
      dataIndex: "checkbox",
      key: "checkbox",
      width: 60,
      align: "center",
      render: (_, record) => {
        const isSelectable = record.wareBatchStatus === "Da_Phe_Duyet";
        return (
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
      render: (text: string) => {
        if (!text) return <span className="text-gray-600">-</span>;
        const formatted = new Date(text + "Z").toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        });;
        return <span className="text-gray-600">{formatted}</span>;
      },
    },
    {
      title: "Upload",
      dataIndex: "isPushed",
      key: "isPushed",
      align: "center",
      width: 100,
      render: (value: boolean) => (
        <Tooltip title={value ? "Đã đẩy dữ liệu" : "Chưa đẩy dữ liệu"}>
          {value ? (
            <CheckCircleOutlined className="text-lg text-blue-600!" />
          ) : (
            <CloseCircleOutlined className="text-lg text-red-600!" />
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

        {/* Checkbox Xóa dữ liệu cũ được đặt ở đây */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <Radio.Group
              onChange={(e) => setDeleteMissing(e.target.value)}
              value={deleteMissing}
              className="text-gray-700"
            >
              <Radio value={true}>Cập nhật dữ liệu</Radio>
              <Radio value={false}>Đồng bộ dữ liệu mới</Radio>
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