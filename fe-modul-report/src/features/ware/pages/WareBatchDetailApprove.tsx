import React, { useEffect, useRef, useState, type JSX } from "react";
import {
  Table,
  Input,
  Row,
  Col,
  Button,
  message,
  Modal,
  Form,
  Radio,
  Alert,
  Space,
  Card,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams } from "react-router-dom";
import { wareDataRowApi } from "../api/wareDataRowApi";
import { wareMappingApi } from "../api/wareMappingApi";
import { wareBatchApi } from "../api/wareBathApi";
import type { WareDataRowResponse } from "../types/wareDataRow";
import type { WareMappingResponse } from "../types/wareMapping";
import type { WareBatchResponse } from "../types/wareBacth";
import {
  CheckCircleOutlined,
  SearchOutlined,
  CloudUploadOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
// import * as XLSX from "xlsx";
import { userPushApi } from "../../auth/api/accountConfigApi";
import type { UserPushResponse } from "../../auth/types/accountConfig";
import { approvalConfigsApi } from "../api/wareConfigApi";

// ─── ExcelMetaRows ────────────────────────────────────────────────────────────

export const ExcelMetaRows = ({
  metaRows,
  totalCols,
  colWidths,
  onColWidthChange,
}: {
  metaRows: any[][];
  totalCols: number;
  colWidths: number[];
  onColWidthChange?: (colIdx: number, newWidth: number) => void;
}) => {
  if (!metaRows || metaRows.length === 0) return null;

  return (
    <div
      style={{
        background: "#f0f7ff",
        borderBottom: "2px solid #1677ff",
        padding: 0,
        overflowX: "auto",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: colWidths.reduce((a, b) => a + b, 0),
        }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          {metaRows.map((row, rIdx) => {
            const cells: JSX.Element[] = [];
            let cIdx = 0;
            for (const cell of row) {
              if (cell.mergeInfo && !cell.mergeInfo.isOrigin) {
                cIdx++;
                continue;
              }
              const colspan = cell.mergeInfo?.colspan || 1;
              const rowspan = cell.mergeInfo?.rowspan || 1;
              const totalWidth = colWidths
                .slice(cIdx, cIdx + colspan)
                .reduce((a, b) => a + b, 0);
              cells.push(
                <td
                  key={cIdx}
                  colSpan={colspan}
                  rowSpan={rowspan}
                  style={{
                    width: totalWidth,
                    padding: "6px 10px",
                    fontSize: colspan > 1 ? 15 : 13,
                    fontWeight: colspan > 1 ? 600 : 500,
                    color: "#1a3c6e",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    verticalAlign: "top",
                    position: "relative",
                    background: cell.bg ?? undefined,
                  }}
                >
                  {cell.value != null && cell.value !== ""
                    ? String(cell.value)
                    : ""}
                  {colspan === 1 && onColWidthChange && (
                    <ResizeHandle colIdx={cIdx} onResize={onColWidthChange} />
                  )}
                </td>
              );
              cIdx++;
            }
            while (cIdx < totalCols) {
              cells.push(<td key={cIdx++} />);
            }
            return <tr key={rIdx}>{cells}</tr>;
          })}
        </tbody>
      </table>
    </div>
  );
};

const ResizeHandle = ({
  colIdx,
  onResize,
}: {
  colIdx: number;
  onResize: (i: number, w: number) => void;
}) => {
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    const th = (e.target as HTMLElement).closest("td");
    startW.current = th?.offsetWidth ?? 100;

    const onMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX.current;
      onResize(colIdx, Math.max(60, startW.current + diff));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 5,
        cursor: "col-resize",
        background: "transparent",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "#1677ff44")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
    />
  );
};

// ─── Auto-approve helpers (từ ApproveBatch) ───────────────────────────────────

type BatchRecord = any & { id?: string | number };

const getBatchType = (batch: BatchRecord): "year" | "month" | "day" => {
  if (batch.reportDay) return "day";
  if (batch.reportMonth) return "month";
  return "year";
};

const isDuplicate = (a: BatchRecord, b: BatchRecord): boolean => {
  const nameA = (a.batchName || a.name || "").trim();
  const nameB = (b.batchName || b.name || "").trim();
  if (nameA !== nameB) return false;
  const typeA = getBatchType(a);
  const typeB = getBatchType(b);
  if (typeA !== typeB) return false;
  if (typeA === "year") return String(a.reportYear) === String(b.reportYear);
  if (typeA === "month")
    return (
      String(a.reportYear) === String(b.reportYear) &&
      String(a.reportMonth) === String(b.reportMonth)
    );
  return (
    String(a.reportYear) === String(b.reportYear) &&
    String(a.reportMonth) === String(b.reportMonth) &&
    String(a.reportDay) === String(b.reportDay)
  );
};

const calcDeleteMissing = (
  batchToPush: BatchRecord,
  allBatches: BatchRecord[]
): boolean => {
  const alreadyPushed = allBatches.filter(
    (b) => b.isPushed === true && b.batchId !== batchToPush.batchId
  );
  return alreadyPushed.some((existing) => isDuplicate(batchToPush, existing));
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const WareBatchDetailApprove: React.FC = () => {
  const wareBatchId = Number(
    useParams<{ wareBatchId: string }>().wareBatchId ?? 0
  );

  const [rows, setRows] = useState<WareDataRowResponse[]>([]);
  const [mappings, setMappings] = useState<WareMappingResponse[]>([]);
  const [batchDetail, setBatchDetail] = useState<WareBatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [pushModalVisible, setPushModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [messageApi, contextHolderMessage] = message.useMessage();
  const [modal, contextHolderModal] = Modal.useModal();

  // Auto-approve
  const [userPushConfig, setUserPushConfig] = useState<UserPushResponse | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Excel preview
  // const [previewModalVisible, setPreviewModalVisible] = useState(false);
  // const [previewLoading, setPreviewLoading] = useState(false);
  // const [sheetColWidths, setSheetColWidths] = useState<Record<string, number[]>>({});
  // const [previewSheets, setPreviewSheets] = useState<
  //   {
  //     name: string;
  //     headers: string[];
  //     rows: any[][];
  //     metaRows: { value: any; mergeInfo?: any }[][];
  //     totalCols: number;
  //     colWidths: number[];
  //     headerRows: any[][];
  //   }[]
  // >([]);
  // const [activeSheet, setActiveSheet] = useState("0");

  const [form] = Form.useForm();
  const [rejectForm] = Form.useForm();

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchBatchDetail = async () => {
    if (!wareBatchId) return;
    try {
      const res = await wareBatchApi.getDetail(wareBatchId);
      setBatchDetail(res);
    } catch {
      messageApi.error("Lấy thông tin batch thất bại");
    }
  };

  const fetchMappings = async () => {
    try {
      const res = await wareMappingApi.getByBatch(wareBatchId);
      setMappings(res);
    } catch {
      messageApi.error("Lấy mapping thất bại");
    }
  };

  const fetchRows = async () => {
    if (!wareBatchId) return;
    setLoading(true);
    try {
      const res = await wareDataRowApi.searchWareDataRow({
        wareBatchId,
        keyword,
        page: 0,
        limit: 1000,
      });
      setRows(res.content);
    } catch {
      messageApi.error("Lấy dữ liệu thất bại");
    } finally {
      setLoading(false);
    }
  };

  const loadUserPushConfig = async () => {
    try {
      const res = await userPushApi.getAllUserPush();
      setUserPushConfig(res && res.length > 0 ? res[0] : null);
    } catch {
      setUserPushConfig(null);
    }
  };

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchBatchDetail();
    fetchMappings();
    loadUserPushConfig();
  }, [wareBatchId]);

  useEffect(() => {
    fetchRows();
  }, [wareBatchId, keyword]);

  // useEffect(() => {
  //   const init: Record<string, number[]> = {};
  //   previewSheets.forEach((s, i) => {
  //     init[String(i)] = [...s.colWidths];
  //   });
  //   setSheetColWidths(init);
  // }, [previewSheets]);

  // ── Excel preview ────────────────────────────────────────────────────────────

  // const handleColResize = (sheetIdx: string, colIdx: number, newWidth: number) => {
  //   setSheetColWidths((prev) => {
  //     const widths = [...(prev[sheetIdx] ?? [])];
  //     widths[colIdx] = newWidth;
  //     return { ...prev, [sheetIdx]: widths };
  //   });
  // };

  // const handlePreviewExcel = async () => {
  //   if (!batchDetail?.s3FileKey) {
  //     messageApi.warning("Không tìm thấy file đính kèm");
  //     return;
  //   }
  //   setPreviewModalVisible(true);
  //   setPreviewLoading(true);
  //   setPreviewSheets([]);
  //   setActiveSheet("0");

  //   try {
  //     const arrayBuffer = await wareBatchApi.getFileBlob(batchDetail.s3FileKey);
  //     const workbook = XLSX.read(arrayBuffer, { type: "array", cellStyles: true });

  //     const sheets = workbook.SheetNames.map((sheetName) => {
  //       const worksheet = workbook.Sheets[sheetName];
  //       const ref = worksheet["!ref"];
  //       if (!ref)
  //         return {
  //           name: sheetName,
  //           headers: [],
  //           rows: [],
  //           metaRows: [],
  //           totalCols: 0,
  //           colWidths: [],
  //           headerRows: [],
  //         };

  //       const range = XLSX.utils.decode_range(ref);
  //       const merges = worksheet["!merges"] || [];
  //       const colsInfo = worksheet["!cols"] || [];

  //       const mergeMap: Record<
  //         string,
  //         { r: number; c: number; rowspan: number; colspan: number }
  //       > = {};
  //       for (const merge of merges) {
  //         for (let r = merge.s.r; r <= merge.e.r; r++) {
  //           for (let c = merge.s.c; c <= merge.e.c; c++) {
  //             mergeMap[`${r}_${c}`] = {
  //               r: merge.s.r,
  //               c: merge.s.c,
  //               rowspan: merge.e.r - merge.s.r + 1,
  //               colspan: merge.e.c - merge.s.c + 1,
  //             };
  //           }
  //         }
  //       }

  //       const getCellBg = (cell: any): string | null => {
  //         const tryColor = (fc: any): string | null => {
  //           if (!fc) return null;
  //           if (
  //             fc.rgb &&
  //             fc.rgb.length === 8 &&
  //             fc.rgb !== "00000000" &&
  //             fc.rgb !== "FFFFFFFF"
  //           )
  //             return "#" + fc.rgb.slice(2);
  //           if (
  //             fc.rgb &&
  //             fc.rgb.length === 6 &&
  //             fc.rgb !== "000000" &&
  //             fc.rgb !== "FFFFFF"
  //           )
  //             return "#" + fc.rgb;
  //           if (fc.theme !== undefined) {
  //             const themeColors: Record<number, string> = {
  //               0: "#FFFFFF",
  //               1: "#000000",
  //               2: "#EEECE1",
  //               3: "#1F497D",
  //               4: "#4F81BD",
  //               5: "#C0504D",
  //               6: "#9BBB59",
  //               7: "#8064A2",
  //               8: "#4BACC6",
  //               9: "#F79646",
  //             };
  //             return themeColors[fc.theme] ?? null;
  //           }
  //           return null;
  //         };
  //         return tryColor(cell?.s?.fgColor) ?? tryColor(cell?.s?.bgColor);
  //       };

  //       const rawRows: {
  //         value: any;
  //         bg: string | null;
  //         bold: boolean;
  //         mergeInfo?: {
  //           r: number;
  //           c: number;
  //           rowspan: number;
  //           colspan: number;
  //           isOrigin: boolean;
  //         };
  //       }[][] = [];

  //       for (let r = range.s.r; r <= range.e.r; r++) {
  //         const row: (typeof rawRows)[0] = [];
  //         for (let c = range.s.c; c <= range.e.c; c++) {
  //           const cellAddr = XLSX.utils.encode_cell({ r, c });
  //           const cell = worksheet[cellAddr];
  //           const value = cell
  //             ? cell.t === "n"
  //               ? cell.v
  //               : cell.v ?? ""
  //             : "";
  //           const bg = getCellBg(cell);
  //           const bold =
  //             cell?.s?.bold === true || cell?.s?.font?.bold === true;
  //           const key = `${r}_${c}`;
  //           const mi = mergeMap[key];
  //           if (mi) {
  //             const isOrigin = mi.r === r && mi.c === c;
  //             row.push({
  //               value: isOrigin ? value : null,
  //               bg,
  //               bold,
  //               mergeInfo: { ...mi, isOrigin },
  //             });
  //           } else {
  //             row.push({ value, bg, bold });
  //           }
  //         }
  //         rawRows.push(row);
  //       }

  //       let headerRowIdx = -1;
  //       const totalCols = range.e.c - range.s.c + 1;
  //       for (let i = 0; i < rawRows.length; i++) {
  //         const nonEmpty = rawRows[i].filter(
  //           (c) => c.value != null && c.value !== ""
  //         ).length;
  //         if (nonEmpty >= Math.max(2, totalCols * 0.6)) {
  //           headerRowIdx = i;
  //           break;
  //         }
  //       }

  //       let headerEndIdx = headerRowIdx;
  //       if (headerRowIdx >= 0 && headerRowIdx + 1 < rawRows.length) {
  //         const nextRow = rawRows[headerRowIdx + 1];
  //         const nextNonEmpty = nextRow.filter(
  //           (c) => c.value != null && c.value !== ""
  //         ).length;
  //         const nextHasStyling = nextRow.some((c) => c.bg || c.bold);
  //         if (nextNonEmpty > 0 && nextHasStyling) {
  //           headerEndIdx = headerRowIdx + 1;
  //         }
  //       }

  //       const metaRows = rawRows
  //         .slice(0, headerRowIdx)
  //         .map((row) =>
  //           row.map((c) => ({ value: c.value, bg: c.bg, mergeInfo: c.mergeInfo }))
  //         );
  //       const headerRows =
  //         headerRowIdx >= 0
  //           ? rawRows.slice(headerRowIdx, headerEndIdx + 1)
  //           : [];
  //       const dataRows =
  //         headerEndIdx >= 0 ? rawRows.slice(headerEndIdx + 1) : rawRows;

  //       const colWidths = Array.from({ length: totalCols }, (_, i) => {
  //         const colInfo = colsInfo[i];
  //         if (colInfo?.wch) return Math.min(400, Math.max(80, colInfo.wch * 7));
  //         if (colInfo?.wpx) return Math.min(400, Math.max(80, colInfo.wpx));
  //         return 120;
  //       });

  //       return {
  //         name: sheetName,
  //         headers:
  //           headerRows[0]?.map((c) =>
  //             c.value != null ? String(c.value) : ""
  //           ) ?? [],
  //         rows: dataRows.map((row) => row.map((c) => c.value)),
  //         metaRows,
  //         totalCols,
  //         colWidths,
  //         headerRows,
  //       };
  //     });

  //     setPreviewSheets(sheets as any);
  //   } catch (error: any) {
  //     messageApi.error(error?.message || "Xem trước file thất bại");
  //     setPreviewModalVisible(false);
  //   } finally {
  //     setPreviewLoading(false);
  //   }
  // };

  // const buildExcelColumns = (sheet: any) => {
  //   const { headerRows, colWidths } = sheet;
  //   if (!headerRows || headerRows.length === 0) return [];
  //   const totalCols = sheet.totalCols;

  //   if (headerRows.length === 1) {
  //     return headerRows[0].map((cell: any, i: number) => ({
  //       title: (
  //         <div
  //           style={{
  //             background: cell.bg || undefined,
  //             margin: "-8px -8px",
  //             padding: "8px",
  //             fontWeight: 600,
  //             fontSize: 12,
  //             textAlign: "center",
  //             whiteSpace: "pre-wrap",
  //             wordBreak: "break-word",
  //             lineHeight: 1.3,
  //           }}
  //         >
  //           {cell.value != null && cell.value !== ""
  //             ? String(cell.value)
  //             : `Cột ${i + 1}`}
  //         </div>
  //       ),
  //       dataIndex: i,
  //       key: i,
  //       width: colWidths[i] ?? 120,
  //       onHeaderCell: () => ({ style: { padding: 0, background: "transparent" } }),
  //       ellipsis: { showTitle: true },
  //       render: (val: any) => (
  //         <span style={{ fontSize: 13 }}>
  //           {val != null && val !== "" ? String(val) : ""}
  //         </span>
  //       ),
  //     }));
  //   }

  //   const row1 = headerRows[0];
  //   const row2 = headerRows[1];
  //   const columns: any[] = [];
  //   const processed = new Set<number>();

  //   for (let c = 0; c < totalCols; c++) {
  //     if (processed.has(c)) continue;
  //     const cell = row1[c];
  //     if (!cell) continue;
  //     const mi = cell.mergeInfo;
  //     const isOrigin = !mi || mi.isOrigin;
  //     if (!isOrigin) {
  //       processed.add(c);
  //       continue;
  //     }
  //     const colspan = mi?.colspan ?? 1;
  //     const rowspan = mi?.rowspan ?? 1;
  //     const label =
  //       cell.value != null && cell.value !== "" ? String(cell.value) : "";
  //     const bg = cell.bg;

  //     if (rowspan > 1 || colspan === 1) {
  //       columns.push({
  //         title: (
  //           <div
  //             style={{
  //               background: bg || undefined,
  //               margin: "-8px -8px",
  //               padding: "8px 4px",
  //               fontWeight: 600,
  //               fontSize: 12,
  //               textAlign: "center",
  //               whiteSpace: "pre-wrap",
  //               wordBreak: "break-word",
  //               lineHeight: 1.3,
  //               minHeight: rowspan > 1 ? 52 : undefined,
  //               display: "flex",
  //               alignItems: "center",
  //               justifyContent: "center",
  //             }}
  //           >
  //             {label || `Cột ${c + 1}`}
  //           </div>
  //         ),
  //         dataIndex: c,
  //         key: c,
  //         width: colWidths[c] ?? 120,
  //         onHeaderCell: () => ({ style: { padding: 0, background: "transparent" } }),
  //         ellipsis: { showTitle: true },
  //         render: (val: any) => (
  //           <span style={{ fontSize: 13 }}>
  //             {val != null && val !== "" ? String(val) : ""}
  //           </span>
  //         ),
  //       });
  //       processed.add(c);
  //     } else {
  //       const children: any[] = [];
  //       for (let cc = c; cc < c + colspan; cc++) {
  //         const childCell = row2[cc];
  //         const childLabel =
  //           childCell?.value != null && childCell?.value !== ""
  //             ? String(childCell.value)
  //             : `Cột ${cc + 1}`;
  //         const childBg = childCell?.bg;
  //         children.push({
  //           title: (
  //             <div
  //               style={{
  //                 background: childBg || bg || undefined,
  //                 margin: "-8px -8px",
  //                 padding: "8px 4px",
  //                 fontWeight: 600,
  //                 fontSize: 12,
  //                 textAlign: "center",
  //                 whiteSpace: "pre-wrap",
  //                 wordBreak: "break-word",
  //                 lineHeight: 1.3,
  //               }}
  //             >
  //               {childLabel}
  //             </div>
  //           ),
  //           dataIndex: cc,
  //           key: cc,
  //           width: colWidths[cc] ?? 100,
  //           ellipsis: { showTitle: true },
  //           render: (val: any) => (
  //             <span style={{ fontSize: 13 }}>
  //               {val != null && val !== "" ? String(val) : ""}
  //             </span>
  //           ),
  //         });
  //         processed.add(cc);
  //       }
  //       columns.push({
  //         title: (
  //           <div
  //             style={{
  //               background: bg || undefined,
  //               margin: "-8px -8px",
  //               padding: "8px 4px",
  //               fontWeight: 700,
  //               fontSize: 12,
  //               textAlign: "center",
  //               lineHeight: 1.3,
  //             }}
  //           >
  //             {label}
  //           </div>
  //         ),
  //         key: `group_${c}`,
  //         children,
  //       });
  //       processed.add(c);
  //     }
  //   }

  //   return columns;
  // };

  // ── Auto-approve logic ────────────────────────────────────────────────────────

  /**
   * Kiểm tra config template xem có autoApprove không.
   * Dùng templateId lấy từ batchDetail đã có sẵn.
   */
  const checkAutoApprove = async (): Promise<boolean> => {
    try {
      const tplId = batchDetail?.templateId;
      if (!tplId) return false;
      const res = await approvalConfigsApi.getByTemplateId(String(tplId));
      const configs: any[] = res?.data?.configs || [];
      return configs.some((c) => c.autoApprove === true);
    } catch {
      return false;
    }
  };

  // ── Approve handler ───────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!wareBatchId) return;

    modal.confirm({
      title: "Duyệt batch",
      icon: <CheckCircleOutlined />,
      content: "Bạn có chắc chắn muốn duyệt batch này?",
      okText: "Duyệt",
      cancelText: "Hủy",
      okType: "primary",
      onOk: async () => {
        setApprovalLoading(true);
        try {
          // Bước 1: Duyệt
          await wareBatchApi.approveBatch(wareBatchId);
          messageApi.success("Duyệt batch thành công");
          await fetchBatchDetail();

          // Bước 2: Kiểm tra autoApprove
          const shouldAutoPush = await checkAutoApprove();
          if (!shouldAutoPush) return;

          // Bước 3: Kiểm tra đã duyệt hoàn toàn và chưa push
          const latest = await wareBatchApi.getDetail(wareBatchId);
          if (latest?.status !== "Da_Phe_Duyet" || latest?.isPushed) return;

          // Bước 4: Kiểm tra userPushConfig
          if (!userPushConfig) {
            messageApi.warning(
              "Batch đã duyệt nhưng chưa có cấu hình tài khoản đồng bộ. Vui lòng thiết lập trong phần cấu hình."
            );
            return;
          }

          // Bước 5: Lấy danh sách tất cả batch để tính deleteMissing
          const allBatches = await wareBatchApi
            .getMyApprovals()
            .catch(() => []);
          const deleteMissingAuto = calcDeleteMissing(
            { ...latest, batchId: wareBatchId },
            allBatches
          );

          // Bước 6: Push
          await wareBatchApi.pushWareBatch({
            id: wareBatchId,
            deleteMissing: deleteMissingAuto,
            username: userPushConfig.username,
            password: userPushConfig.password,
          });
          messageApi.success("Đã duyệt và đồng bộ dữ liệu thành công");
          fetchBatchDetail();
        } catch (error: any) {
          messageApi.error(error?.data || "Duyệt batch thất bại");
        } finally {
          setApprovalLoading(false);
        }
      },
    });
  };

  // ── Other handlers ────────────────────────────────────────────────────────────

  const handlePushConfirm = async (values: {
    username: string;
    password: string;
    deleteMissing: boolean;
  }) => {
    if (!wareBatchId) return;
    try {
      const res = await wareBatchApi.pushWareBatch({
        id: wareBatchId,
        deleteMissing: values.deleteMissing,
        username: values.username,
        password: values.password,
      });
      messageApi.success(JSON.stringify(res));
      setPushModalVisible(false);
      fetchBatchDetail();
    } catch (error: any) {
      messageApi.error(error?.data || "Push batch thất bại");
    }
  };

  const handleRejectClick = () => setRejectModalVisible(true);

  const handleRejectConfirm = async () => {
    if (!wareBatchId) return;
    try {
      await wareBatchApi.rejectBatch(wareBatchId);
      messageApi.success("Từ chối batch thành công");
      setRejectModalVisible(false);
      rejectForm.resetFields();
      fetchBatchDetail();
    } catch (error: any) {
      messageApi.error(error?.data || "Từ chối batch thất bại");
    }
  };

  // ── Columns ───────────────────────────────────────────────────────────────────

  const formatVNDate = (iso?: string) => {
    if (!iso) return "-";
    const hasTimezone = iso.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(iso);
    const isoStr = hasTimezone ? iso : `${iso}+07:00`;
    const d = new Date(isoStr);
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

  const defaultColumns: ColumnsType<WareDataRowResponse> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
      render: (text: number) => (
        <span className="font-medium text-gray-800">#{text}</span>
      ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (value: string) => (
        <span className="text-gray-600 text-sm">{formatVNDate(value)}</span>
      ),
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      render: (value: string) => (
        <span className="text-gray-600 text-sm">{formatVNDate(value)}</span>
      ),
    },
  ];

  const mappingColumns: ColumnsType<WareDataRowResponse> = mappings.map((m) => ({
    title: m.fieldTitle || m.fieldName,
    dataIndex: ["data", m.fieldName],
    key: m.fieldName,
    render: (value) => (
      <span className="text-gray-700">
        {value == null ? "-" : value.toString()}
      </span>
    ),
  }));

  const columns = [...defaultColumns, ...mappingColumns];

  // ── Status & action buttons ───────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { color: string; label: string } } = {
      Cho_Phe_Duyet: { color: "orange", label: "Chờ duyệt" },
      Da_Phe_Duyet: { color: "success", label: "Đã duyệt" },
      Tu_Choi_Phe_Duyet: { color: "error", label: "Từ chối" },
    };
    const config = statusConfig[status] || { color: "default", label: status };
    return (
      <Tag color={config.color} className="px-3 py-1 text-sm font-medium">
        {config.label}
      </Tag>
    );
  };

  const getActionButtons = () => {
    const status = batchDetail?.status;
    const canApprove = batchDetail?.canApprove;

    if (canApprove) {
      return (
        <>
          <Tooltip title="Duyệt batch này">
            <Button
              type="primary"
              size="large"
              icon={<CheckOutlined />}
              onClick={handleApprove}
              loading={approvalLoading}
              className="bg-green-600! hover:bg-green-700! h-10 px-6"
            >
              Duyệt
            </Button>
          </Tooltip>
          <Tooltip title="Từ chối batch này">
            <Button
              danger
              size="large"
              icon={<CloseOutlined />}
              onClick={handleRejectClick}
              disabled={approvalLoading}
              className="h-10 px-6"
            >
              Từ chối
            </Button>
          </Tooltip>
        </>
      );
    }

    if (status === "Tu_Choi_Phe_Duyet") {
      return (
        <Tooltip title="Batch đã bị từ chối, không thể duyệt">
          <Button
            disabled
            danger
            size="large"
            icon={<CloseOutlined />}
            className="h-10 px-6"
          >
            Đã từ chối
          </Button>
        </Tooltip>
      );
    }

    return null;
  };

  const isRejected = batchDetail?.status === "Tu_Choi_Phe_Duyet";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-6 bg-linear-to-br from-gray-50 to-gray-100 min-h-screen">
      {contextHolderMessage}
      {contextHolderModal}

      {isRejected && (
        <Alert
          message="Batch này đã bị từ chối duyệt"
          type="error"
          showIcon
          closable
          className="mb-6 rounded-lg"
        />
      )}

      <Card className="shadow-sm border-0 rounded-xl mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-linear-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
            <p className="text-gray-600 text-sm font-medium mb-1">Mã Batch</p>
            <p className="text-gray-900 font-semibold text-lg">
              {batchDetail?.code || "-"}
            </p>
          </div>
          <div className="bg-linear-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
            <p className="text-gray-600 text-sm font-medium mb-1">Tên Batch</p>
            <p className="text-gray-900 font-semibold text-lg">
              {batchDetail?.name || "-"}
            </p>
          </div>
          <div className="bg-linear-to-br from-green-50 to-green-100 p-4 rounded-lg">
            <p className="text-gray-600 text-sm font-medium mb-1">Trạng thái</p>
            <div className="mt-2">
              {batchDetail?.status && getStatusBadge(batchDetail.status)}
            </div>
          </div>
        </div>

        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} lg={19}>
            <Input
              placeholder="Tìm kiếm theo ID..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={fetchRows}
              size="large"
              className="rounded-lg"
            />
          </Col>
          <Col xs={24} sm={12} lg={5} className="text-start">
            <Space>
              <Tooltip title="Tải lại dữ liệu">
                <Button
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={fetchRows}
                  loading={loading}
                  className="h-10 px-6"
                >
                  Tải lại
                </Button>
              </Tooltip>

              {/* Nút xem trước Excel */}
              {/* <Tooltip
                title={
                  batchDetail?.s3FileKey
                    ? "Xem trước file Excel đã tải lên"
                    : "Chưa có file đính kèm"
                }
              >
                <Button
                  size="large"
                  icon={<FileExcelOutlined />}
                  onClick={handlePreviewExcel}
                  disabled={!batchDetail?.s3FileKey}
                  className="h-10 px-6"
                  style={{ borderColor: "#16a34a", color: "#16a34a" }}
                >
                  Xem trước Excel
                </Button>
              </Tooltip> */}

              {getActionButtons()}
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="shadow-sm border-0 rounded-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100">
            <SearchOutlined className="text-blue-600 text-lg" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 m-0">
            Dữ liệu chi tiết ({rows.length})
          </h2>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <Table
            rowKey={(record) => record.id ?? Math.random()}
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={false}
            size="middle"
            bordered
            rowClassName={(index: any) =>
              index % 2 === 0
                ? "bg-white hover:bg-gray-50 transition-colors"
                : "bg-gray-50 hover:bg-gray-100 transition-colors"
            }
            scroll={{ x: 1300 }}
          />
        </div>

        {rows.length === 0 && !loading && (
          <div className="text-center py-16 bg-gray-50 rounded-lg mt-4">
            <SearchOutlined className="text-4xl text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg">Không có dữ liệu</p>
          </div>
        )}
      </Card>

      {/* ── Modal xem trước Excel ── */}
      {/* <Modal
        title={
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-10 h-10 flex items-center justify-center bg-green-100 rounded-lg">
              <FileExcelOutlined className="text-green-600 text-lg" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-800">
                Xem trước file Excel
              </div>
              {batchDetail?.s3FileKey && (
                <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                  {batchDetail.s3FileKey.split("/").pop()}
                </div>
              )}
            </div>
          </div>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width="90vw"
        style={{ top: 24 }}
        styles={{ body: { padding: "16px 0 0 0" } }}
      >
        {previewLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spin size="large" />
            <p className="text-gray-500">Đang tải file Excel...</p>
          </div>
        ) : previewSheets.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileExcelOutlined className="text-4xl mb-3" />
            <p>Không có dữ liệu trong file</p>
          </div>
        ) : (
          <Tabs
            activeKey={activeSheet}
            onChange={setActiveSheet}
            type="card"
            size="small"
            className="px-4"
            items={previewSheets.map((sheet, index) => ({
              key: String(index),
              label: (
                <span>
                  <FileExcelOutlined className="mr-1 text-green-600" />
                  {sheet.name}
                </span>
              ),
              children: (
                <div>
                  <ExcelMetaRows
                    metaRows={sheet.metaRows}
                    totalCols={sheet.totalCols}
                    colWidths={
                      sheetColWidths[String(index)] ?? sheet.colWidths
                    }
                    onColWidthChange={(ci, w) =>
                      handleColResize(String(index), ci, w)
                    }
                  />
                  <div className="overflow-x-auto rounded-lg border border-gray-200 mt-2">
                    <Table
                      rowKey={(record: any) => record._key}
                      columns={buildExcelColumns(sheet)}
                      dataSource={sheet.rows.map((row, i) =>
                        Object.assign({ _key: i }, row as any[])
                      )}
                      pagination={{
                        pageSize: 50,
                        showSizeChanger: true,
                        pageSizeOptions: ["20", "50", "100"],
                        showTotal: (total) => `Tổng ${total} dòng`,
                        size: "small",
                      }}
                      size="small"
                      bordered
                      scroll={{ x: "max-content", y: 420 }}
                      locale={{ emptyText: "Sheet này không có dữ liệu" }}
                      rowClassName={(_, i) =>
                        i % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }
                    />
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Modal> */}

      {/* ── Modal push TKV ── */}
      <Modal
        title={
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-100">
              <CloudUploadOutlined className="text-blue-600 text-lg" />
            </div>
            <div className="text-lg font-semibold text-gray-800">
              Upload dữ liệu TKV
            </div>
          </div>
        }
        open={pushModalVisible}
        onCancel={() => setPushModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={handlePushConfirm}
          className="py-4"
        >
          <Form.Item
            label={
              <span className="font-medium text-gray-800">Xoá dữ liệu cũ</span>
            }
            name="deleteMissing"
            rules={[{ required: true, message: "Vui lòng chọn có hoặc không!" }]}
          >
            <Radio.Group
              onChange={(e) => setDeleteMissing(e.target.value)}
              value={deleteMissing}
            >
              <Radio value={true}>Có</Radio>
              <Radio value={false}>Không</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label={
              <span className="font-medium text-gray-800">Tên đăng nhập</span>
            }
            name="username"
            rules={[{ required: true, message: "Vui lòng nhập username!" }]}
          >
            <Input
              placeholder="Nhập tên đăng nhập"
              size="large"
              className="rounded-lg"
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
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              icon={<CloudUploadOutlined />}
              className="bg-green-600! hover:bg-green-700! h-11 font-medium rounded-lg"
            >
              Upload dữ liệu
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal từ chối ── */}
      <Modal
        title={
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-10 h-10 flex items-center justify-center bg-red-100">
              <CloseOutlined className="text-red-600 text-lg" />
            </div>
            <div className="text-lg font-semibold text-gray-800">
              Từ chối batch
            </div>
          </div>
        }
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          layout="vertical"
          form={rejectForm}
          onFinish={handleRejectConfirm}
          className="py-4"
        >
          <Form.Item
            label={
              <span className="font-medium text-gray-800">Lý do từ chối</span>
            }
            name="reason"
            rules={[
              { required: true, message: "Vui lòng nhập lý do từ chối!" },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Nhập lý do từ chối batch"
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item>
            <Button
              danger
              htmlType="submit"
              block
              size="large"
              icon={<CloseOutlined />}
              className="h-11 font-medium rounded-lg"
            >
              Từ chối batch
            </Button>
          </Form.Item>
        </Form>
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
      `}</style>
    </div>
  );
};
