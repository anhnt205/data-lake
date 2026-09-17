import { Card, Row, Col, Statistic, Table, Tag, Select } from "antd";
import { DatabaseOutlined, EditOutlined } from "@ant-design/icons";
import { Column, Line } from "@ant-design/charts";
import { useEffect, useState } from "react";
import type {
  TimeCountDto,
  WareBatchActionResponse,
  WareBatchActionSearch,
  WareBatchActionStatistic,
} from "../types/wareBatchAction";
import { wareBatchActionApi } from "../api/wareBatchActionApi";

const DashboardWare = () => {
  const [dashboard, setDashboard] = useState<WareBatchActionStatistic>({
    insert_today: 0,
    update_today: 0,
    insert_total: 0,
    update_total: 0,
  });
  const formatVNDate = (iso: string) => {
    if (!iso) return "-";
    const hasTimezone = iso.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(iso);
    const normalized = hasTimezone ? iso : `${iso}+07:00`;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };
  const [lineChartData, setLineChartData] = useState<TimeCountDto[]>([]);
  const [lineType, setLineType] = useState<"DAY" | "MONTH" | "YEAR">("DAY");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [chartColumData, setChartColumData] = useState<TimeCountDto[]>([]);
  const [actions, setActions] = useState<WareBatchActionResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChartLineData = async (type: "DAY" | "MONTH" | "YEAR") => {
    try {
      const res = await wareBatchActionApi.cntActionTime(type);
      setLineChartData(res);
    } catch (err) {
      console.error("Fetch line chart data failed", err);
    }
  };

  const getTop10Table = async () => {
    try {
      const res = await wareBatchActionApi.getTop10ByMonth();
      setChartColumData(res);
    } catch (err) {
      console.error("Fetch colums chart data failed", err);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await wareBatchActionApi.getDashboard();
      setDashboard(res);
    } catch (err) {
      console.error("Fetch dashboard failed", err);
    }
  };

  const fetchAuditActions = async (p = page, s = pageSize) => {
    try {
      setLoading(true);

      const req: WareBatchActionSearch = {
        page: p,
        limit: s,
        actionName: "",
        tableName: "",
        sortBy: "createdAt",
        sort: "DESC",
      };

      const res = await wareBatchActionApi.searchWareActionBatch(req);

      setActions(res.content ?? []);
      setTotalPages(res.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch audit actions failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditActions(page, pageSize);
  }, [page, pageSize]);

  useEffect(() => {
    fetchDashboard();
    fetchAuditActions();
    getTop10Table();
  }, []);

  useEffect(() => {
    fetchChartLineData(lineType);
  }, [lineType]);

  const columns = [
    {
      title: "Request ID",
      dataIndex: "requestId",
      width: 200,
      render: (text: string) => (
        <span className="font-mono text-blue-600 font-medium">{text}</span>
      ),
    },
    {
      title: "Bảng",
      dataIndex: "tableName",
      width: 120,
      render: (text: string) => (
        <Tag color="purple" className="font-medium">
          {text}
        </Tag>
      ),
    },
    {
      title: "Hành động",
      dataIndex: "actionName",
      width: 120,
      render: (value: string) =>
        value === "Insert" ? (
          <Tag color="success" className="px-3 py-1 font-medium">
            <DatabaseOutlined className="mr-1" />
            INSERT
          </Tag>
        ) : (
          <Tag color="processing" className="px-3 py-1 font-medium">
            <EditOutlined className="mr-1" />
            UPDATE
          </Tag>
        ),
    },
    {
      title: "Thời gian",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 200,
      render: (value?: string | Date) =>
        value ? (
          <span className="text-gray-600">{formatVNDate(String(value))}</span>
        ) : (
          "-"
        ),
    },
  ];

  const barConfig = {
    data: chartColumData,
    xField: "label",
    yField: "total",
    color: "#1677ff",
    columnStyle: {
      radius: [8, 8, 0, 0],
    },
    label: {
      position: "top",
      style: {
        fill: "#000",
        fontSize: 12,
        fontWeight: 600,
      },
    },
    xAxis: {
      label: {
        autoRotate: false,
        style: {
          fontSize: 12,
          fontWeight: 500,
        },
      },
    },
    yAxis: {
      label: {
        style: {
          fontSize: 12,
        },
      },
      grid: {
        line: {
          style: {
            stroke: "#e5e7eb",
            lineWidth: 1,
            lineDash: [4, 4],
          },
        },
      },
    },
  };

  const lineConfig = {
    data: lineChartData,
    xField: "label",
    yField: "total",
    smooth: true,
    color: "#10b981",
    lineStyle: {
      lineWidth: 3,
    },
    point: {
      size: 5,
      shape: "circle",
      style: {
        fill: "#10b981",
        stroke: "#fff",
        lineWidth: 2,
      },
    },
    xAxis: {
      label: {
        style: {
          fontSize: 12,
          fontWeight: 500,
        },
      },
    },
    yAxis: {
      label: {
        style: {
          fontSize: 12,
        },
      },
      grid: {
        line: {
          style: {
            stroke: "#e5e7eb",
            lineWidth: 1,
            lineDash: [4, 4],
          },
        },
      },
    },
    areaStyle: {
      fillOpacity: 0.1,
      fill: "l(270) 0:#10b981 1:#ffffff",
    },
  };

  return (
    <div className="px-10 py-6 min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      {/* Header */}

      {/* Statistics Cards */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0"
            style={{
              background: "linear-gradient(135deg, #0d4526 0%, #1a8649 100%)",
            }}
          >
            <Statistic
              title={
                <span className="text-white text-opacity-90 font-medium">
                  Insert hôm nay
                </span>
              }
              value={dashboard.insert_today}
              valueStyle={{
                color: "#fff",
                fontSize: "32px",
                fontWeight: "bold",
              }}
              prefix={
                <DatabaseOutlined
                  style={{ fontSize: "24px", marginRight: "8px" }}
                />
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0"
            style={{
              background: "linear-gradient(135deg, #115a31 0%, #1f9a5c 100%)",
            }}
          >
            <Statistic
              title={
                <span className="text-white text-opacity-90 font-medium">
                  Update hôm nay
                </span>
              }
              value={dashboard.update_today}
              valueStyle={{
                color: "#fff",
                fontSize: "32px",
                fontWeight: "bold",
              }}
              prefix={
                <EditOutlined
                  style={{ fontSize: "24px", marginRight: "8px" }}
                />
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0"
            style={{
              background: "linear-gradient(135deg, #15703d 0%, #46b17c 100%)",
            }}
          >
            <Statistic
              title={
                <span className="text-white text-opacity-90 font-medium">
                  Tổng Insert
                </span>
              }
              value={dashboard.insert_total}
              valueStyle={{
                color: "#fff",
                fontSize: "32px",
                fontWeight: "bold",
              }}
              prefix={
                <DatabaseOutlined
                  style={{ fontSize: "24px", marginRight: "8px" }}
                />
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-0"
            style={{
              background: "linear-gradient(135deg, #1a8649 0%, #52b788 100%)",
            }}
          >
            <Statistic
              title={
                <span className="text-white text-opacity-90 font-medium">
                  Tổng Update
                </span>
              }
              value={dashboard.update_total}
              valueStyle={{
                color: "#fff",
                fontSize: "32px",
                fontWeight: "bold",
              }}
              prefix={
                <EditOutlined
                  style={{ fontSize: "24px", marginRight: "8px" }}
                />
              }
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center">
                <div className="w-1 h-6 bg-blue-500 rounded mr-3"></div>
                <span className="text-lg font-semibold text-gray-800">
                  Top 10 bảng upload nhiều nhất
                </span>
              </div>
            }
            className="shadow-lg border-0 h-full"
            bodyStyle={{ padding: "24px" }}
          >
            <div style={{ height: 320 }}>
              <Column {...barConfig} />
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="flex items-center">
                <div className="w-1 h-6 bg-green-500 rounded mr-3"></div>
                <span className="text-lg font-semibold text-gray-800">
                  Thống kê upload theo thời gian
                </span>
              </div>
            }
            extra={
              <Select
                value={lineType}
                style={{ width: 140 }}
                onChange={(v) => setLineType(v)}
                options={[
                  { value: "DAY", label: "📅 Theo ngày" },
                  { value: "MONTH", label: "📊 Theo tháng" },
                  { value: "YEAR", label: "📈 Theo năm" },
                ]}
                size="middle"
              />
            }
            className="shadow-lg border-0 h-full"
            bodyStyle={{ padding: "24px" }}
          >
            <div style={{ height: 320 }}>
              <Line {...lineConfig} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity Table */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-1 h-6 bg-blue-500 rounded mr-3"></div>
              <span className="text-lg font-semibold text-gray-800">
                Lịch sử hoạt động gần đây
              </span>
            </div>
            <Tag color="green" className="px-3 py-1">
              {actions.length} bản ghi
            </Tag>
          </div>
        }
        className="shadow-lg border-0"
        bodyStyle={{ padding: "0" }}
      >
        <div className="overflow-auto">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={actions}
            loading={loading}
            className="modern-table"
            pagination={{
              current: page + 1,
              pageSize,
              total: totalPages * pageSize,
              onChange: (p, ps) => {
                setPage(p - 1);
                setPageSize(ps);
                fetchAuditActions(p - 1, ps);
              },
              showSizeChanger: true,
              pageSizeOptions: ["10", "50", "100"],
              showTotal: (total) => `Tổng ${total} bản ghi`,
              className: "px-6 py-4",
            }}
            scroll={{ x: 800 }}
          />
        </div>
      </Card>

      <style>{`
        .modern-table .ant-table {
          font-size: 14px;
        }
        .modern-table .ant-table-thead > tr > th {
          background: #f8fafc;
          color: #1e293b;
          font-weight: 600;
          border-bottom: 2px solid #e2e8f0;
          padding: 16px;
        }
        .modern-table .ant-table-tbody > tr > td {
          padding: 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .modern-table .ant-table-tbody > tr:hover > td {
          background: #f8fafc;
        }
        .ant-statistic-content {
          display: flex;
          flex-direction: column;
        }
        .ant-card {
          border-radius: 12px;
        }
        .ant-select-selector {
          border-radius: 8px !important;
          border: 1px solid #e2e8f0 !important;
        }
        .bg-gradient-to-br {
          background: linear-gradient(to bottom right, #f9fafb, #f3f4f6);
        }
      `}</style>
    </div>
  );
};

export default DashboardWare;
