export interface WareBatchRequest {
  id?: number | null;
  name: string;
  description: string;
  file?: File | null;
  wareTemplateId: number | null;
  reportYear: number | null;
  reportMonth: number | null;
  reportDay: number | null;
}

export interface WareBatchResponse {
  id: number;
  code: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  employeeName?: string | null;
  isPushed: boolean;
  status: string;
  myApprovalStatus: string;
  wareBatchStatus: string;
  canApprove: boolean;
  reportYear?: number | null;
  reportMonth?: number | null;
  reportDay?: number | null;
  templateId?: number | null;
  s3FileKey?: string | null;
}

export interface WareBatchSearch {
  page?: number;
  limit?: number;
  keyword?: string | null;
  wareTemplateId?: number | null;
  status?: string | null;
  departmentId?: string | null;
  departmentIds?: string[] | null;
  isPushed?: boolean;
}

export interface WareBatchPush {
  id: number;
  deleteMissing: boolean;
  username: string;
  password: string;
}