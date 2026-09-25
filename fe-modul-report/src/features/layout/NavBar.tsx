import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserOutlined,
  DownOutlined,
  LogoutOutlined,
  ProfileOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
  AppstoreOutlined,
  TeamOutlined,
  FileTextOutlined,
  IdcardOutlined,
  FormOutlined,
  BarChartOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  RightOutlined,
  LoadingOutlined,
  SettingOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Menu, Spin } from "antd";
import { employeeApi } from "../employee/api/employeeApi";
import { departmentApi } from "../department/api/departmentApi";
import { wareCategoryApi } from "../ware/api/wareCategoryApi";
import { wareTemplateApi } from "../ware/api/wareTemplateApi";
import type { DepartmentResponse } from "../department/types/department";
import { useAuthStore } from "../../stores/authStore";

type Cat = { id: number; code: string; name: string };
type Tmpl = { id: number; code: string; name: string; tableCode?: string; deptName?: string; catName?: string };

const QuickInputPanel = ({
  onSelectTemplate,
  footerText,
}: {
  onSelectTemplate: (tmpl: Tmpl) => void;
  footerText?: string;
}) => {
  const [depts, setDepts] = useState<DepartmentResponse[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  const [activeDept, setActiveDept] = useState<DepartmentResponse | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  const [activeCat, setActiveCat] = useState<Cat | null>(null);
  const [tmpls, setTmpls] = useState<Tmpl[]>([]);
  const [loadingTmpls, setLoadingTmpls] = useState(false);

  // Dùng useRef để track activeDept/activeCat hiện tại, tránh stale closure trong async handlers
  const activeDeptRef = useRef<DepartmentResponse | null>(null);
  const activeCatRef = useRef<Cat | null>(null);

  // Load departments on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await departmentApi.getMyDepartment("", 0, 1000);
        setDepts(res.content);
        if (res.content.length > 0) handleSelectDept(res.content[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingDepts(false);
      }
    })();
  }, []);

  const handleSelectDept = async (dept: DepartmentResponse) => {
    if (activeDeptRef.current?.id === dept.id) return;
    activeDeptRef.current = dept;
    setActiveDept(dept);
    setActiveCat(null);
    activeCatRef.current = null;
    setTmpls([]);
    setCats([]);
    setLoadingCats(true);
    try {
      const res = await wareCategoryApi.searchWareCategory({
        page: 0, limit: 100, keyword: "", departmentId: String(dept.id),
      });
      setCats(res.content);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCats(false);
    }
  };

  const handleSelectCat = async (cat: Cat) => {
    if (activeCatRef.current?.id === cat.id) return;
    activeCatRef.current = cat;
    setActiveCat(cat);
    setTmpls([]);
    setLoadingTmpls(true);
    try {
      const res = await wareTemplateApi.searchWareTemplate({
        page: 0, limit: 100, wareCategoryId: cat.id, keyword: "",
      });
      setTmpls(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTmpls(false);
    }
  };

  const colBase = "flex flex-col border-r border-gray-100 overflow-y-auto";

  // Kích thước text & item đồng nhất, to rõ hơn
  const colHeader = "px-4 pt-3 pb-2 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100";
  const itemBase = "flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-all";
  const activeItem = "bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-500";
  const hoverItem = "text-gray-700 hover:bg-gray-50";

  return (
    <div
      className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ width: 820 }}
      onMouseDown={(e) => e.stopPropagation()}
    >

      {/* 3-column cascade */}
      <div className="flex" style={{ height: 400 }}>

        {/* Col 1: Departments */}
        <div className={`${colBase} bg-gray-50`} style={{ width: 220, flexShrink: 0 }}>
          <div className={colHeader}>Phòng ban</div>
          {loadingDepts ? (
            <div className="flex justify-center pt-10">
              <Spin indicator={<LoadingOutlined spin />} />
            </div>
          ) : depts.length === 0 ? (
            <div className="px-4 py-8 text-gray-400 text-sm text-center">Không có phòng ban</div>
          ) : (
            depts.map((d) => (
              <div
                key={d.id}
                onMouseEnter={() => handleSelectDept(d)}
                className={`${itemBase} ${activeDept?.id === d.id ? activeItem : hoverItem} justify-between`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TeamOutlined style={{ fontSize: 15, flexShrink: 0, opacity: 0.7 }} />
                  <span className="truncate" style={{ fontSize: 14 }}>{d.name}</span>
                </div>
                <RightOutlined style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }} />
              </div>
            ))
          )}
        </div>

        {/* Col 2: Categories */}
        <div className={`${colBase}`} style={{ width: 240, flexShrink: 0 }}>
          <div className={colHeader}>Danh mục</div>
          {loadingCats ? (
            <div className="flex justify-center pt-10">
              <Spin indicator={<LoadingOutlined spin />} />
            </div>
          ) : !activeDept ? (
            <div className="px-4 py-8 text-gray-400 text-sm text-center">← Chọn phòng ban</div>
          ) : cats.length === 0 ? (
            <div className="px-4 py-8 text-gray-400 text-sm text-center">Không có danh mục</div>
          ) : (
            cats.map((c) => (
              <div
                key={c.id}
                onMouseEnter={() => handleSelectCat(c)}
                className={`${itemBase} ${activeCat?.id === c.id ? activeItem : hoverItem} justify-between`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AppstoreOutlined style={{ fontSize: 15, flexShrink: 0, opacity: 0.7 }} />
                  <div className="min-w-0">
                    <div className="truncate font-medium" style={{ fontSize: 14 }}>{c.name}</div>
                    <div className="text-gray-400 truncate" style={{ fontSize: 12 }}>{c.code}</div>
                  </div>
                </div>
                <RightOutlined style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }} />
              </div>
            ))
          )}
        </div>

        {/* Col 3: Templates */}
        <div className={`${colBase} flex-1 border-r-0`}>
          <div className={colHeader}>Template</div>
          {loadingTmpls ? (
            <div className="flex justify-center pt-10">
              <Spin indicator={<LoadingOutlined spin />} />
            </div>
          ) : !activeCat ? (
            <div className="px-4 py-8 text-gray-400 text-sm text-center">← Chọn danh mục</div>
          ) : tmpls.length === 0 ? (
            <div className="px-4 py-8 text-gray-400 text-sm text-center">Không có template</div>
          ) : (
            tmpls.map((t) => (
              <div
                key={t.id}
                onClick={() => onSelectTemplate({
                  ...t,
                  deptName: activeDept?.name || "",
                  catName: activeCat?.name || "",
                })}
                className={`${itemBase} hover:bg-blue-50 hover:text-blue-700 group mx-2 my-1 rounded-lg`}
              >
                <div
                  className="rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors"
                  style={{ width: 36, height: 36, flexShrink: 0 }}
                >
                  <FileTextOutlined style={{ color: "#1976D2", fontSize: 16 }} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate" style={{ fontSize: 14 }}>{t.name}</div>
                  <div className="text-xs text-gray-400 truncate">{t.code}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
        <span className="text-gray-400" style={{ fontSize: 13 }}>
          {footerText || "💡 Di chuột vào các mục để điều hướng • Click vào Template để mở nhập liệu ngay"}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// NavBar
// ─────────────────────────────────────────────
export default function NavBar() {
  const [userName, setUserName] = useState<string>("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const navigate = useNavigate();
  const { role: storeRole, setRole } = useAuthStore();
  const isAdmin = storeRole === "ADMIN";

  const getRoleFromToken = (): string | null => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.role ?? null;
    } catch {
      return null;
    }
  };

  // Sync role từ token vào store nếu store bị mất sau reload
  useEffect(() => {
    if (!storeRole) {
      const tokenRole = getRoleFromToken();
      if (tokenRole) setRole(tokenRole);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const profile = await employeeApi.getMyProfile();
        setUserName(profile.name);
      } catch (e) {
        console.error("Failed to fetch profile:", e);
      }
    })();
  }, []);


  const handleSelectTemplate = (tmpl: Tmpl) => {
    setQuickOpen(false);
    const params = new URLSearchParams();
    if (tmpl.deptName) params.set("dept", tmpl.deptName);
    if (tmpl.catName) params.set("cat", tmpl.catName);
    if (tmpl.name) params.set("tmpl", tmpl.name);
    navigate(`/ware/template/${tmpl.id}?${params.toString()}`);
  };

  const handleSelectTemplateForView = (tmpl: Tmpl) => {
    setQuickViewOpen(false);
    const params = new URLSearchParams();
    if (tmpl.deptName) params.set("dept", tmpl.deptName);
    if (tmpl.catName) params.set("cat", tmpl.catName);
    if (tmpl.name) params.set("tmpl", tmpl.name);
    if (tmpl.tableCode) params.set("table", tmpl.tableCode);
    navigate(`/search/master?${params.toString()}`);
  };

  // ── Existing menus (unchanged) ──────────────

  const categoryMenu = (
    <Menu
      items={[
        {
          key: "departments",
          icon: <TeamOutlined className="text-lg" />,
          label: <span className="text-base font-medium">Danh mục phòng ban</span>,
          onClick: () => navigate("/category/departments"),
          className: "py-3 px-4 hover:bg-[#f0f9f4]!",
        },
        {
          key: "ware",
          icon: <FileTextOutlined className="text-lg" />,
          label: <span className="text-base font-medium">Danh mục báo cáo</span>,
          onClick: () => navigate("/category/ware"),
          className: "py-3 px-4 hover:bg-[#f0f9f4]!",
        },
        {
          key: "employee",
          icon: <IdcardOutlined className="text-lg" />,
          label: <span className="text-base font-medium">Danh mục tài khoản</span>,
          onClick: () => navigate("/employee"),
          className: "py-3 px-4 hover:bg-[#f0f9f4]!",
        },
        {
          key: "accountConfig",
          icon: <IdcardOutlined className="text-lg" />,
          label: <span className="text-base font-medium">Cấu hình tài khoản TKV</span>,
          onClick: () => navigate("/account-config"),
          className: "py-3 px-4 hover:bg-[#f0f9f4]!",
        },
        ...(isAdmin
          ? [
              {
                key: "sync-connections",
                icon: <DatabaseOutlined className="text-lg" />,
                label: <span className="text-base font-medium">Quản lý kết nối DB</span>,
                onClick: () => navigate("/servers"),
                className: "py-3 px-4 hover:bg-[#f0f9f4]!",
              },
            ]
          : []),
      ]}
      className="rounded-xl! shadow-2xl! min-w-[260px] py-2"
    />
  );

  // const datalakeMenu = (
  //   <Menu
  //     items={[
  //       {
  //         key: "ai-group",
  //         type: "group" as const,
  //         label: <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI & Chat</span>,
  //         children: [
  //           {
  //             key: "ai-chat",
  //             icon: <RobotOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Chat AI</span>,
  //             onClick: () => navigate("/ai-chat"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "table-qa",
  //             icon: <TableOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Table QA</span>,
  //             onClick: () => navigate("/lakehouse/table-qa"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "document-chat",
  //             icon: <FileSearchOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Document Chat</span>,
  //             onClick: () => navigate("/lakehouse/document-chat"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //         ],
  //       },
  //       { type: "divider" as const, className: "my-1" },
  //       {
  //         key: "pipeline-group",
  //         type: "group" as const,
  //         label: <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Pipeline</span>,
  //         children: [
  //           {
  //             key: "pipeline",
  //             icon: <CloudUploadOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Pipeline</span>,
  //             onClick: () => navigate("/lakehouse/pipeline"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "gold",
  //             icon: <GoldOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Gold Extraction</span>,
  //             onClick: () => navigate("/lakehouse/gold"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //         ],
  //       },
  //       { type: "divider" as const, className: "my-1" },
  //       {
  //         key: "data-group",
  //         type: "group" as const,
  //         label: <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quản lý dữ liệu</span>,
  //         children: [
  //           {
  //             key: "datalake-data",
  //             icon: <DatabaseOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Quản lý dữ liệu</span>,
  //             onClick: () => navigate("/datalake/data"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "datalake-sync",
  //             icon: <SyncOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Đồng bộ dữ liệu</span>,
  //             onClick: () => navigate("/datalake/sync"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "datalake-status",
  //             icon: <CloudServerOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Trạng thái hệ thống</span>,
  //             onClick: () => navigate("/datalake/status"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //         ],
  //       },
  //       { type: "divider" as const, className: "my-1" },
  //       {
  //         key: "tools-group",
  //         type: "group" as const,
  //         label: <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Công cụ</span>,
  //         children: [
  //           {
  //             key: "servers",
  //             icon: <HddOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Quản lý Server</span>,
  //             onClick: () => navigate("/servers"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "database",
  //             icon: <SearchOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Database Explorer</span>,
  //             onClick: () => navigate("/database"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "jobs",
  //             icon: <ScheduleOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Job Tracking</span>,
  //             onClick: () => navigate("/jobs"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "sql-metadata",
  //             icon: <CodeOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">SQL Metadata</span>,
  //             onClick: () => navigate("/sql-metadata"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //           {
  //             key: "excel-mapping",
  //             icon: <FileExcelOutlined className="text-lg" />,
  //             label: <span className="text-base font-medium">Excel Mapping</span>,
  //             onClick: () => navigate("/excel-mapping"),
  //             className: "py-2 px-4 hover:bg-[#f0f9f4]!",
  //           },
  //         ],
  //       },
  //     ]}
  //     className="rounded-xl! shadow-2xl! min-w-[280px] py-2 max-h-[80vh] overflow-y-auto"
  //   />
  // );

  const reportsMenu = (
    <Menu
      items={[
        {
          key: "approve",
          icon: <CheckCircleOutlined className="text-lg" />,
          label: <span className="text-base font-medium">Duyệt báo cáo</span>,
          onClick: () => navigate("/approve/batch"),
          className: "py-3 px-4 hover:bg-[#f0f9f4]!",
        },
        {
          key: "sync",
          icon: <SyncOutlined className="text-lg" />,
          label: <span className="text-base font-medium">Đồng bộ báo cáo</span>,
          onClick: () => navigate("/sync/batch"),
          className: "py-3 px-4 hover:bg-[#f0f9f4]!",
        },
      ]}
      className="rounded-xl! shadow-2xl! min-w-[260px] py-2"
    />
  );

  const accountMenu = (
    <Menu
      items={[
        {
          key: "profile",
          icon: <ProfileOutlined className="text-lg" />,
          label: <span className="text-base font-medium">Hồ sơ cá nhân</span>,
          onClick: () => navigate("/employee/profile"),
          className: "py-3 px-4 hover:bg-[#f0f9f4]!",
        },
        { type: "divider", className: "my-2" },
        {
          key: "logout",
          icon: <LogoutOutlined className="text-lg" />,
          danger: true,
          label: <span className="text-base font-medium">Đăng xuất</span>,
          onClick: () => navigate("/login"),
          className: "py-3 px-4 hover:bg-[#fff1f0]!",
        },
      ]}
      className="rounded-xl! shadow-2xl! min-w-[220px] py-2"
    />
  );

  return (
    <>
      <nav className="top-0 z-50 bg-[#1976D2] flex items-center px-8 py-3 gap-2 shadow-lg border-b border-[#0891b2]">
        {/* Back Button */}
        <Button
          type="text"
          icon={<ArrowLeftOutlined className="text-xl" />}
          onClick={() => navigate(-1)}
          className="text-white! border-0! bg-transparent! hover:bg-white/15! transition-all duration-300 rounded-lg"
          size="large"
        />

        {/* Home */}
        <Link to="/dashboard">
          <Button
            type="text"
            icon={<HomeOutlined className="text-lg mr-2" />}
            className="text-white! border-0! bg-transparent! font-semibold text-base tracking-wide hover:bg-white/15! transition-all duration-300 rounded-lg"
            size="large"
          >
            Trang chủ
          </Button>
        </Link>

        {/* System Dropdown */}
        <Dropdown overlay={categoryMenu} placement="bottomLeft">
          <Button
            type="text"
            icon={<AppstoreOutlined className="text-lg mr-2" />}
            className="text-white! border-0! bg-transparent! font-semibold text-base tracking-wide hover:bg-white/15! transition-all duration-300 rounded-lg cursor-pointer group"
            size="large"
          >
            <span>Hệ thống</span>
            <DownOutlined className="text-xs ml-2 group-hover:translate-y-0.5 transition-transform duration-300" />
          </Button>
        </Dropdown>

        {/* Data Input */}

        <Link to="/ware">
          <Button
            type="text"
            icon={<SettingOutlined className="text-lg mr-2" />}
            className="text-white! border-0! bg-transparent! font-semibold text-base tracking-wide hover:bg-white/15! transition-all duration-300 rounded-lg"
            size="large"
          >
            Cấu hình
          </Button>
        </Link>


        {/* ── Nhập nhanh ── */}
        <Dropdown
          open={quickOpen}
          onOpenChange={setQuickOpen}
          overlay={
            <QuickInputPanel
              onSelectTemplate={handleSelectTemplate}
              footerText="💡 Di chuột vào các mục để điều hướng • Click vào Template để mở nhập liệu ngay"
            />
          }
          placement="bottomLeft"
          trigger={["hover"]}
          mouseEnterDelay={0.15}
          mouseLeaveDelay={0.2}
        >
          <Button
            type="text"
            icon={<FormOutlined className="text-lg mr-2" />}
            className="text-white! border-0! bg-transparent! font-semibold text-base tracking-wide hover:bg-white/15! transition-all duration-300 rounded-lg cursor-pointer group"
            size="large"
          >
            <span>Nhập dữ liệu</span>
            <DownOutlined className="text-xs ml-2 group-hover:translate-y-0.5 transition-transform duration-300" />
          </Button>
        </Dropdown>

        {/* ── Xem báo cáo ── */}
        <Dropdown
          open={quickViewOpen}
          onOpenChange={setQuickViewOpen}
          overlay={
            <QuickInputPanel
              onSelectTemplate={handleSelectTemplateForView}
              footerText="💡 Di chuột vào các mục để điều hướng • Click vào Template để mở xem báo cáo"
            />
          }
          placement="bottomLeft"
          trigger={["hover"]}
          mouseEnterDelay={0.15}
          mouseLeaveDelay={0.2}
        >
          <Button
            type="text"
            icon={<EyeOutlined className="text-lg mr-2" />}
            className="text-white! border-0! bg-transparent! font-semibold text-base tracking-wide hover:bg-white/15! transition-all duration-300 rounded-lg cursor-pointer group"
            size="large"
          >
            <span>Xem báo cáo</span>
            <DownOutlined className="text-xs ml-2 group-hover:translate-y-0.5 transition-transform duration-300" />
          </Button>
        </Dropdown>

        {/* Data Lake Dropdown */}
        {/* <Dropdown overlay={datalakeMenu} placement="bottomLeft">
          <Button
            type="text"
            icon={<DatabaseOutlined className="text-lg mr-2" />}
            className="text-white! border-0! bg-transparent! font-semibold text-base tracking-wide hover:bg-white/15! transition-all duration-300 rounded-lg cursor-pointer group"
            size="large"
          >
            <span>Data Lake</span>
            <DownOutlined className="text-xs ml-2 group-hover:translate-y-0.5 transition-transform duration-300" />
          </Button>
        </Dropdown> */}

        {/* Reports Dropdown */}
        <Dropdown overlay={reportsMenu} placement="bottomLeft">
          <Button
            type="text"
            icon={<BarChartOutlined className="text-lg mr-2" />}
            className="text-white! border-0! bg-transparent! font-semibold text-base tracking-wide hover:bg-white/15! transition-all duration-300 rounded-lg cursor-pointer group"
            size="large"
          >
            <span>Báo cáo tác nghiệp</span>
            <DownOutlined className="text-xs ml-2 group-hover:translate-y-0.5 transition-transform duration-300" />
          </Button>
        </Dropdown>

        {/* <Link to="/analytics">
          <Button
            type="text"
            icon={<PieChartOutlined className="text-lg mr-2" />}
            className="text-white! border-0! bg-transparent! font-semibold text-base tracking-wide hover:bg-white/15! transition-all duration-300 rounded-lg"
            size="large"
          >
            Thống kê
          </Button>
        </Link> */}

        {/* Account Menu */}
        <div className="ml-auto">
          <Dropdown overlay={accountMenu} placement="bottomRight">
            <Button
              type="text"
              icon={<UserOutlined className="text-xl" />}
              className="text-white! border-0! bg-transparent! hover:bg-white/15! transition-all duration-300 rounded-lg"
              size="large"
            >
              {userName && (
                <span className="text-sm font-semibold ml-1">{userName}</span>
              )}
            </Button>
          </Dropdown>
        </div>
      </nav>
    </>
  );
}