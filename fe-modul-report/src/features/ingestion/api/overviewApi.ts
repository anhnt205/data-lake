/**
 * Client số liệu tổng quan cho màn hình điều hành.
 *
 * Mọi khối đều có thể là `null`: đó là cách máy chủ nói "bạn không có quyền với
 * phần này". Giao diện phải ẩn hẳn ô đó chứ đừng hiển thị 0 — "không được xem"
 * và "bằng không" là hai chuyện khác nhau, hiện 0 sẽ khiến người dùng tưởng hệ
 * đang rỗng trong khi thực ra họ chỉ không đủ quyền.
 */
import { ingestionClient } from "./ingestionApi";

/** Đếm gộp theo trạng thái: { DRAFT: 3, PUBLISHED: 1 }. */
export type DemTheoTrangThai = Record<string, number>;

export interface KhoiDemGop {
  tong: number;
  theo_trang_thai: DemTheoTrangThai;
}

export interface KhoiNguon extends KhoiDemGop { }

export interface KhoiTiepNhan extends KhoiDemGop {
  trong_24h: number;
}

export interface KhoiHangDoi extends KhoiDemGop {
  dlq: number;
}

export interface KhoiDanhMuc extends KhoiDemGop {
  theo_namespace: DemTheoTrangThai;
}

export interface KhoiChatLuong {
  rule: number;
  issue_dang_mo: number;
  /** null khi chưa có lần chạy nào có điểm — khác hẳn với điểm bằng 0. */
  diem_trung_binh: number | null;
  dataset_da_do: number;
  dataset_dang_bi_chan: number;
}

export interface KhoiPheDuyet extends KhoiDemGop {
  /** Đã trừ yêu cầu do chính người xem tạo ra, vì bốn mắt không cho tự duyệt. */
  cho_ban_quyet_dinh: number;
}

export interface KhoiPipeline {
  tong: number;
  lan_chay_theo_trang_thai: DemTheoTrangThai;
}

export interface KhoiMoHinh extends KhoiDemGop {
  noi_bo: number;
}

export interface KhoiPhanPhoi {
  api_product: KhoiDemGop | null;
  bi_view: KhoiDemGop | null;
  chi_so: KhoiDemGop | null;
}

export interface DongKiemToan {
  hanh_dong: string;
  loai_tai_nguyen: string | null;
  ket_qua: string;
  chu_the: string | null;
  luc: string | null;
}

export interface KhoiKiemToan {
  trong_24h: number;
  bi_tu_choi_24h: number;
  gan_day: DongKiemToan[];
}

export type MucViec = "canh_bao" | "cho_xu_ly" | "luu_y";

export interface ViecCanLam {
  muc: MucViec;
  noi_dung: string;
  /** Luôn có: một dòng cảnh báo không chỉ được chỗ xử lý thì chỉ làm nhiễu. */
  duong_dan: string;
}

export interface TongQuan {
  nguon: KhoiNguon | null;
  tiep_nhan: KhoiTiepNhan | null;
  hang_doi: KhoiHangDoi | null;
  danh_muc: KhoiDanhMuc | null;
  chat_luong: KhoiChatLuong | null;
  phe_duyet: KhoiPheDuyet | null;
  pipeline: KhoiPipeline | null;
  mo_hinh: KhoiMoHinh | null;
  phan_phoi: KhoiPhanPhoi | null;
  kiem_toan: KhoiKiemToan | null;
  viec_can_lam: ViecCanLam[];
  nguoi_dung: {
    ten: string;
    clearance_level: number;
    vai_tro: string[];
  };
}

const overviewApi = {
  tongQuan: async (): Promise<TongQuan> =>
    (await ingestionClient.get<TongQuan>("/api/v1/overview")).data,
};

export default overviewApi;
