import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { message } from "antd";
import type { GetRequest, GetResponse } from "../types/getMaster";
import { wareTkvApi } from "../api/wareTkvApi";
import NavbarSearch from "../components/NavbarSearch";
import ResultPanel from "../components/ResultPanel";

export interface ReportHeader {
  tableName?: string;
  tmplName?: string; // Tên template hiển thị trên header
  year?: number;
  period?: string;
  day?: string;
  reportType?: "MONTH" | "YEAR" | "DAY";
}

const SearchMasterData = () => {
  const [searchParams] = useSearchParams();

  const [table, setTable] = useState(() => searchParams.get("table") || "");
  const [tmplName, setTmplName] = useState(() => searchParams.get("tmpl") || "");

  const [year, setYear] = useState<number | undefined>();
  const [period, setPeriod] = useState<string | undefined>();
  const [day, setDay] = useState<string | undefined>();
  const [reportType, setReportType] = useState<"MONTH" | "YEAR" | undefined>();

  const defaultLimit = 50;
  const defaultOffset = 0;

  const [results, setResults] = useState<any[]>([]);
  const [reportHeader, setReportHeader] = useState<ReportHeader>({});
  const [loading, setLoading] = useState(false);

  // Keep ref to avoid stale closures in handleSearch
  const stateRef = useRef({ year, period, day, reportType });
  stateRef.current = { year, period, day, reportType };

  const handleSearch = useCallback(async (tableOverride?: string) => {
    const tableToSearch = tableOverride !== undefined ? tableOverride : table;

    if (!tableToSearch) {
      message.warning("Vui lòng chọn bảng dữ liệu hoặc báo cáo cần xem");
      return;
    }

    const { year: curYear, period: curPeriod, day: curDay, reportType: curReportType } = stateRef.current;

    // Cập nhật report header — bao gồm tmplName
    setReportHeader({
      tableName: tableToSearch,
      tmplName: tmplName,
      year: curYear,
      period: curPeriod,
      day: curDay,
      reportType: curReportType,
    });

    const buildFilters = (dayKey?: "DAY" | "NGAY") => {
      const nextFilters: Record<string, any> = {};
      if (curYear) nextFilters["YEAR"] = curYear;
      if (curPeriod) nextFilters["PERIOD"] = curPeriod;
      if (curDay && dayKey) nextFilters[dayKey] = curDay;
      return Object.keys(nextFilters).length ? nextFilters : undefined;
    };

    const buildReportFilters = (type: "MONTH" | "YEAR") => {
      const nextFilters: Record<string, any> = {};
      if (curYear) nextFilters["YEAR"] = curYear;
      if (type === "MONTH" && curPeriod) nextFilters["PERIOD"] = curPeriod;
      return Object.keys(nextFilters).length ? nextFilters : undefined;
    };

    const buildRequest = (
      filters?: Record<string, any>,
      reportTypeOverride?: "MONTH" | "YEAR"
    ): GetRequest => ({
      table: tableToSearch,
      limit: defaultLimit,
      offset: defaultOffset,
      reportType: reportTypeOverride,
      filters,
    });

    setLoading(true);
    try {
      setResults([]);

      if (curReportType === "MONTH" || curReportType === "YEAR") {
        const res: GetResponse = await wareTkvApi.searchTkv(
          buildRequest(buildReportFilters(curReportType), curReportType)
        );
        setResults(res?.rows || []);
        return;
      }

      // Có filter ngày: ưu tiên DAY, nếu không có thì fallback sang NGAY
      if (curDay) {
        try {
          const resByDay: GetResponse = await wareTkvApi.searchTkv(
            buildRequest(buildFilters("DAY"))
          );

          if ((resByDay?.rows?.length || 0) > 0) {
            setResults(resByDay.rows || []);
            return;
          }

          const resByNgay: GetResponse = await wareTkvApi.searchTkv(
            buildRequest(buildFilters("NGAY"))
          );
          setResults(resByNgay?.rows || []);
          return;
        } catch (dayError) {
          console.warn("Search by DAY failed, fallback to NGAY", dayError);
          const resByNgay: GetResponse = await wareTkvApi.searchTkv(
            buildRequest(buildFilters("NGAY"))
          );
          setResults(resByNgay?.rows || []);
          return;
        }
      }

      const res: GetResponse = await wareTkvApi.searchTkv(
        buildRequest(buildFilters())
      );
      setResults(res?.rows || []);
    } catch (err: any) {
      console.error("Lỗi khi tải dữ liệu báo cáo:", err);
      const errMsg = err?.response?.data?.message || err?.message || "Không thể tải dữ liệu báo cáo từ máy chủ";
      message.error(errMsg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [table, tmplName]);

  // Đồng bộ table và tmplName khi URL params thay đổi và TỰ ĐỘNG TẢI DỮ LIỆU
  useEffect(() => {
    const urlTable = searchParams.get("table") || "";
    const urlTmpl = searchParams.get("tmpl") || "";

    setTable(urlTable);
    setTmplName(urlTmpl);

    if (urlTable) {
      handleSearch(urlTable);
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <NavbarSearch
        table={table}
        setTable={setTable}
        year={year}
        setYear={setYear}
        period={period}
        setPeriod={setPeriod}
        day={day}
        setDay={setDay}
        reportType={reportType}
        setReportType={setReportType}
        loading={loading}
        onSearch={handleSearch}
      />

      <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <ResultPanel results={results} reportHeader={reportHeader} loading={loading} />
      </main>
    </div>
  );
};

export default SearchMasterData;