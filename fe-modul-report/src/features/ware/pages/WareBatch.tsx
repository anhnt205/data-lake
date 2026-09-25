import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Upload,
  message,
  Space,
  Tooltip,
  Card,
  Tag,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import type { ColumnsType } from "antd/es/table";
import type {
  WareBatchRequest,
  WareBatchResponse,
  WareBatchSearch,
} from "../types/wareBacth";
import type { PageResponse } from "../../department/types/department";
import { wareBatchApi } from "../api/wareBathApi";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  FileTextOutlined,
  ReloadOutlined,
  TeamOutlined,
  AppstoreOutlined,
  RightOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { Select } from "antd";
import { wareTemplateApi } from "../api/wareTemplateApi";

const { Search } = Input;
const quarterMonthMap: Record<string, number[]> = {
  Q1: [1, 2, 3],
  Q2: [4, 5, 6],
  Q3: [7, 8, 9],
  Q4: [10, 11, 12],
};
interface BreadcrumbInfo {
  departmentName: string;
  categoryName: string;
  templateName: string;
}

interface WareBatchProps {
  templateIdProp?: number;
}

export const WareBatch: React.FC<WareBatchProps> = ({ templateIdProp }) => {
  const { templateId: templateIdParam } = useParams<{ templateId: string }>();
  const [searchParams] = useSearchParams();
  const resolvedTemplateId = templateIdProp ?? (templateIdParam ? Number(templateIdParam) : undefined);
  const isViewOnly = searchParams.get("viewOnly") === "true";

  const breadcrumbFromUrl: BreadcrumbInfo | null =
    searchParams.get("dept") || searchParams.get("cat")
      ? {
        departmentName: searchParams.get("dept") || "",
        categoryName: searchParams.get("cat") || "",
        templateName: searchParams.get("tmpl") || "",
      }
      : null;

  const [batches, setBatches] = useState<WareBatchResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm<WareBatchRequest>();

  const selectedYear = Form.useWatch("reportYear", form);
  const selectedMonth = Form.useWatch("reportMonth", form);

  const currentYear = new Date().getFullYear();
  const yearOptions = React.useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const y = currentYear - 10 + i;
      return { label: String(y), value: y };
    });
  }, [currentYear]);

  const monthOptions = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      label: `Tháng ${i + 1}`,
      value: i + 1,
    }));
  }, []);

  const daysInMonth = React.useMemo(() => {
    if (!selectedYear || !selectedMonth) {
      return 31;
    }
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const dayOptions = React.useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => ({
      label: `Ngày ${i + 1}`,
      value: i + 1,
    }));
  }, [daysInMonth]);

  useEffect(() => {
    const currentDay = form.getFieldValue("reportDay");
    if (currentDay && currentDay > daysInMonth) {
      form.setFieldValue("reportDay", undefined);
    }
  }, [daysInMonth, form]);

  const nav = useNavigate();
  const [messageApi, contextHolderMessage] = message.useMessage();
  const [modal, contextHolderModal] = Modal.useModal();
  const [templateName, setTemplateName] = useState<string>("");
  const [downloadingTemplateId, setDownloadingTemplateId] = useState<number | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);

  const fetchTemplateName = async () => {
    if (resolvedTemplateId) {
      try {
        const template = await wareTemplateApi.getWareTemplateById(resolvedTemplateId);
        setTemplateName(template.name || "");
      } catch (error) {
        console.error("Lỗi khi lấy tên template:", error);
      }
    }
  };

  useEffect(() => {
    fetchTemplateName();
  }, [resolvedTemplateId]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params: WareBatchSearch = {
        page,
        limit,
        keyword: searchKeyword,
        wareTemplateId: resolvedTemplateId,
        ...(isViewOnly ? { isPushed: true } : {}),
      };
      const res: PageResponse<WareBatchResponse> =
        await wareBatchApi.searchWareBatch(params);
      let content = res.content || [];
      if (isViewOnly) {
        content = content.filter((b) => b.isPushed);
      }
      setBatches(content);
      setTotal(isViewOnly && res.totalElements === undefined ? content.length : res.totalElements);
    } catch (error) {
      messageApi.error("Lấy danh sách báo cáo thất bại");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [page, searchKeyword, resolvedTemplateId, isViewOnly]);

  const handleOpenModal = () => {
    form.setFieldsValue({ name: templateName });
    setIsModalOpen(true);
  };

  const handleAddBatch = async (values: WareBatchRequest) => {
    try {
      const request: WareBatchRequest = {
        ...values,
        id: null,
        wareTemplateId: resolvedTemplateId ?? null,
        file: fileList[0]?.originFileObj || null,
      };

      await wareBatchApi.saveWareBatch(request);
      messageApi.success("Thêm batch thành công");
      setIsModalOpen(false);
      setFileList([]);
      form.resetFields();
      fetchBatches();
    } catch (error: any) {
      messageApi.error(error?.message || "Thêm batch thất bại");
    }
  };

  const handleDelete = async (id: string | number) => {
    modal.confirm({
      title: "Xác nhận xóa",
      icon: <ExclamationCircleOutlined />,
      content: "Bạn có chắc chắn muốn xóa batch này?",
      okType: "danger",
      onOk: async () => {
        try {
          await wareBatchApi.deleteWareBatch(String(id));
          messageApi.success("Xóa batch thành công");
          fetchBatches();
        } catch (error) {
          messageApi.error("Xóa batch thất bại");
        }
      },
    });
  };

  const handleDownloadTemplate = async () => {
    if (!resolvedTemplateId) {
      messageApi.error("Không tìm thấy template ID");
      return;
    }

    setDownloadingTemplateId(resolvedTemplateId);
    try {
      const blob = await wareTemplateApi.exportTemplateExcel(resolvedTemplateId);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${templateName || `template-${resolvedTemplateId}`}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      messageApi.success("Tải biểu mẫu thành công");
    } catch (error: any) {
      messageApi.error(error?.response?.data?.message || "Tải biểu mẫu thất bại");
    } finally {
      setDownloadingTemplateId(null);
    }
  };

  const handleDownloadDataFile = async (record: WareBatchResponse) => {
    if (!record.s3FileKey) {
      messageApi.warning("Batch này chưa có file dữ liệu");
      return;
    }

    setDownloadingFileId(record.id!);
    try {
      const arrayBuffer = await wareBatchApi.getFileBlob(record.s3FileKey);
      // Convert ArrayBuffer to Blob
      const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${record.code || record.name || `batch-${record.id}`}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      messageApi.success("Tải file thành công");
    } catch (error: any) {
      messageApi.error(error?.response?.data?.message || "Tải file thất bại");
    } finally {
      setDownloadingFileId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (!status) return <span className="text-gray-400">—</span>;
    const statusConfig: { [key: string]: { color: string; label: string } } = {
      Cho_Phe_Duyet: { color: "orange", label: "Chờ duyệt" },
      Da_Phe_Duyet: { color: "success", label: "Đã duyệt" },
      Tu_Choi_Phe_Duyet: { color: "error", label: "Từ chối" },
    };
    const config = statusConfig[status];
    if (!config) return <span className="text-gray-400">—</span>;
    return (
      <Tag color={config.color} className="px-3 py-1 text-sm font-medium">
        {config.label}
      </Tag>
    );
  };

  const columns: ColumnsType<WareBatchResponse> = [
    {
      title: "Mã",
      dataIndex: "code",
      key: "code",
      render: (text: string) => (
        <span className="font-medium text-gray-800">{text}</span>
      ),
    },
    {
      title: "Tên",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <span className="text-gray-700">{text}</span>,
    },
    {
      title: "Người tạo",
      dataIndex: "employeeName",
      key: "employeeName",
      render: (text: string) => <span className="text-gray-700">{text}</span>,
    },
    {
      title: "Năm",
      dataIndex: "reportYear",
      key: "reportYear",
      render: (text: string) => (
        <span className="text-gray-600">{text || "-"}</span>
      ),
    },
    {
      title: "Tháng",
      dataIndex: "reportMonth",
      key: "reportMonth",
      render: (text: string) => (
        <span className="text-gray-600">{text || "-"}</span>
      ),
    },
    {
      title: "Ngày",
      dataIndex: "reportDay",
      key: "reportDay",
      render: (text: string) => (
        <span className="text-gray-600">{text || "-"}</span>
      ),
    },
    {
      title: "Upload",
      dataIndex: "isPushed",
      key: "isPushed",
      align: "center",
      width: 100,
      render: (value: boolean, record) => (
        <Tooltip title={value ? "Đã đẩy dữ liệu" : "Chưa đẩy dữ liệu"}>
          {value ? (
            <CheckCircleOutlined
              className="text-lg text-gray-700 cursor-pointer hover:text-blue-700 transition-colors"
              onClick={() => nav(`/ware/batch/${record.id}/actions`)}
            />
          ) : (
            <CloseCircleOutlined className="text-lg text-red-600 cursor-pointer" />
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
      width: isViewOnly ? 150 : 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => nav(`/ware/batch/${record.id}${isViewOnly ? "?viewOnly=true" : ""}`)}
              className="bg-green-600! hover:bg-green-700!"
              size="large"
            >
              Xem
            </Button>
          </Tooltip>
          <Tooltip title="Tải file dữ liệu đã đẩy">
            <Button
              type="default"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadDataFile(record)}
              loading={downloadingFileId === record.id}
              size="large"
            >
              Tải file
            </Button>
          </Tooltip>

          {!isViewOnly && (
            <Tooltip title="Xóa batch">
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id!)}
                size="large"
              >
                Xóa
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="px-6 py-6 bg-linear-to-br from-gray-50 to-gray-100 min-h-screen">
      {contextHolderMessage}
      {contextHolderModal}

      <Card className="shadow-sm border-0 rounded-xl mb-6">
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
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
          </div>
          <Button
            type="default"
            size="large"
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
            loading={downloadingTemplateId === resolvedTemplateId}
            className="h-10 px-6"
          >
            Tải biểu mẫu
          </Button>
          {!isViewOnly && (
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={handleOpenModal}
              className="bg-[#0891b2]! hover:bg-cyan-700! h-10 px-6"
            >
              Thêm dữ liệu
            </Button>
          )}
        </div>
      </Card>

      <Card className="shadow-sm border-0 rounded-xl">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 shrink-0">
              <FileTextOutlined className="text-blue-600 text-lg" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800 m-0 leading-tight">
                Danh sách Báo cáo
              </h1>
              {(breadcrumbFromUrl || templateName) && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {breadcrumbFromUrl?.departmentName && (
                    <>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-md border border-blue-100">
                        <TeamOutlined style={{ fontSize: 11, color: "#1976D2" }} />
                        <span className="text-xs font-medium text-blue-700">{breadcrumbFromUrl.departmentName}</span>
                      </div>
                      <RightOutlined style={{ fontSize: 9, color: "#9ca3af" }} />
                    </>
                  )}
                  {breadcrumbFromUrl?.categoryName && (
                    <>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 rounded-md border border-purple-100">
                        <AppstoreOutlined style={{ fontSize: 11, color: "#7c3aed" }} />
                        <span className="text-xs font-medium text-purple-700">{breadcrumbFromUrl.categoryName}</span>
                      </div>
                      <RightOutlined style={{ fontSize: 9, color: "#9ca3af" }} />
                    </>
                  )}
                  {(breadcrumbFromUrl?.templateName || templateName) && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 rounded-md border border-green-100">
                      <FileTextOutlined style={{ fontSize: 11, color: "#16a34a" }} />
                      <span className="text-xs font-medium text-green-700">
                        {breadcrumbFromUrl?.templateName || templateName}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            size="large"
            icon={<ReloadOutlined />}
            onClick={() => fetchBatches()}
            loading={loading}
            className="h-10 px-6 shrink-0"
          >
            Tải lại
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={batches}
            loading={loading}
            pagination={{
              current: page + 1,
              pageSize: limit,
              total: total,
              onChange: (pageNumber) => setPage(pageNumber - 1),
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

        {batches.length === 0 && !loading && (
          <div className="text-center py-16 bg-gray-50 rounded-lg mt-4">
            <FileTextOutlined className="text-4xl text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg mb-6">
              {isViewOnly
                ? "Chưa có báo cáo nào được đẩy dữ liệu thành công lên Tập đoàn"
                : "Không có batch nào"}
            </p>
            {!isViewOnly && (
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => setIsModalOpen(true)}
                className="bg-[#0891b2]! hover:bg-cyan-700! h-11 px-8"
              >
                Thêm batch mới
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Modal Thêm Batch */}
      <Modal
        title={
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-100">
              <PlusOutlined className="text-blue-600 text-lg" />
            </div>
            <div className="text-lg font-semibold text-gray-800">Thêm Batch</div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setFileList([]);
          form.resetFields();
        }}
        width={700}
        okText="Thêm"
        cancelText="Hủy"
        onOk={() => form.submit()}
        okButtonProps={{
          className: "bg-[#1976D2]! hover:bg-blue-700! text-white! border-0 h-10 px-6 text-base font-medium",
          size: "large",
        }}
        cancelButtonProps={{ size: "large", className: "h-10 px-6 text-base" }}
      >
        <Form form={form} layout="vertical" onFinish={handleAddBatch} className="py-4">
          <Form.Item
            name="name"
            label={<span className="font-medium text-gray-800">Tên Batch</span>}
            rules={[{ required: true, message: "Vui lòng nhập tên batch" }]}
          >
            <Input placeholder="Nhập tên batch" size="large" className="rounded-lg" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="reportYear"
              label={
                <span className="font-medium text-gray-800">
                  Năm báo cáo <span className="text-red-500">*</span>
                </span>
              }
              rules={[{ required: true, message: "Vui lòng chọn năm báo cáo" }]}
            >
              <Select
                placeholder="Chọn năm"
                size="large"
                className="rounded-lg"
                options={yearOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              name="reportMonth"
              label={<span className="font-medium text-gray-800">Tháng báo cáo</span>}
              dependencies={["reportQuarter"]}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const quarter = getFieldValue("reportQuarter");

                    if (!quarter || !value) {
                      return Promise.resolve();
                    }

                    const validMonths = quarterMonthMap[quarter];

                    if (validMonths.includes(Number(value))) {
                      return Promise.resolve();
                    }

                    return Promise.reject(
                      new Error(
                        `Tháng phải thuộc ${quarter} (${validMonths.join(", ")})`
                      )
                    );
                  },
                }),
              ]}
            >
              <Select
                placeholder="Chọn tháng (tùy chọn)"
                allowClear
                size="large"
                className="rounded-lg"
                options={monthOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              name="reportQuarter"
              label={<span className="font-medium text-gray-800">Quý báo cáo</span>}
            >
              <Select
                placeholder="Chọn quý (tùy chọn)"
                allowClear
                size="large"
                onChange={(value) => {
                  if (value) {
                    const months = quarterMonthMap[value];
                    form.setFieldValue(
                      "reportMonth",
                      months[months.length - 1]
                    );
                  }
                }}
                options={[
                  { label: "Q1 (Tháng 1-3)", value: "Q1" },
                  { label: "Q2 (Tháng 4-6)", value: "Q2" },
                  { label: "Q3 (Tháng 7-9)", value: "Q3" },
                  { label: "Q4 (Tháng 10-12)", value: "Q4" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="reportDay"
              label={<span className="font-medium text-gray-800">Ngày báo cáo</span>}
            >
              <Select
                placeholder="Chọn ngày (tùy chọn)"
                allowClear
                size="large"
                className="rounded-lg"
                options={dayOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label={<span className="font-medium text-gray-800">Mô tả</span>}
          >
            <Input.TextArea placeholder="Nhập mô tả (tùy chọn)" rows={4} className="rounded-lg" />
          </Form.Item>

          <Form.Item label={<span className="font-medium text-gray-800">File</span>}>
            <Upload
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              maxCount={1}
              accept=".xlsx,.xls,.csv"
            >
              <Button icon={<PlusOutlined />} size="large" className="w-full h-10 rounded-lg">
                Chọn file (Excel hoặc CSV)
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .bg-linear-to-br { background: linear-gradient(to bottom right, #f9fafb, #f3f4f6); }
        .ant-table-cell { padding: 12px !important; }
        .ant-table-header .ant-table-cell {
          background: linear-gradient(to right, #f3f4f6, #e5e7eb);
          font-weight: 600; color: #374151;
        }
        .ant-table-row { transition: all 0.2s ease; }
        .ant-table-row:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .ant-input:focus, .ant-input-affix-wrapper:focus, .ant-input-affix-wrapper-focused {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
        }
      `}</style>
    </div>
  );
};