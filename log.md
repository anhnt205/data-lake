# NHẬT KÝ THỰC HIỆN VÀ QUY TRÌNH BUILD / DEPLOY HỆ THỐNG DATA LAKE

---

## I. NGUYÊN NHÂN VÀ QUÁ TRÌNH KHẮC PHỤC LỖI TẠI TRANG "XEM BÁO CÁO"

### 1. Hiện tượng
- Khi truy cập chức năng **Xem báo cáo** trên hệ thống Công ty Than Dương Huy (`http://103.226.250.92:7112/`), tiêu đề phía trên bảng báo cáo hiển thị:
  > **CÔNG TY THAN ĐÈO NAI - CỌC SÁU - TKV**
- Đồng thời giao diện thanh tìm kiếm phía trên bị thay đổi so với bản cũ (xuất hiện ô chọn *"Bảng / Báo cáo"* có nút *"Đổi"* và nút *"Xem báo cáo"* làm lệch giao diện cũ).
- Các cột audit hệ thống (`DATA_UPLOAD_ID`, `CREATED_BY`, `CREATED_AT`, `MODIFIED_BY`, `MODIFIED_AT`, `SYNCDATE`, `VERSION`, `MAXDATE`) hiển thị ở cuối bảng dữ liệu làm rối bảng nghiệp vụ.

---

### 2. Nguyên nhân gốc rễ (Root Cause)
1. **Tiêu đề công ty bị hardcode trong source code Frontend:**
   - Trong file `fe-modul-report/src/features/ware/components/ResultPanel.tsx` (dòng 221), tại commit `7b28496ed86305a98fd34728cdece6b2066e94e8`, chuỗi `CÔNG TY THAN ĐÈO NAI - CỌC SÁU - TKV` đã bị hardcode cố định vào JSX hiển thị tiêu đề báo cáo.
   - Khi chạy trên server staging `http://103.226.250.92:7112/`, bản build trước đó chứa đoạn mã này khiến cho bất kỳ báo cáo nào cũng hiển thị tiêu đề của Đèo Nai - Cọc Sáu.
2. **Dữ liệu trả về từ API Vinacomin:**
   - Bảng `T_SXT_22` trên API Vinacomin tập trung (`https://Apidatabi.vinacomin.vn`) có chứa các bản ghi kiểm thử với mã đơn vị `BUKRS: 4600` và tên đơn vị thi công (`congty`) gồm cả "Công ty Xây lắp mỏ - TKV".
   - Các trường kỹ thuật audit do hệ thống quản lý dữ liệu tự sinh (`data_upload_id`, `created_by`, `created_at`, `modified_by`, `modified_at`, `syncdate`, `version`, `maxdate`) không được ẩn đi khi chuyển đổi dữ liệu.
3. **Thanh tìm kiếm `NavbarSearch.tsx` bị thay đổi so với thiết kế chuẩn của Than Dương Huy:**
   - Phiên bản chuẩn cũ của Than Dương Huy (commit `e44a02b30e0358692381c4b9a1ddad8141596968`):
     - Không có ô chọn *"Bảng / Báo cáo"* chiếm diện tích ở hàng nhập liệu.
     - Chỉ gồm 4 ô gọn gàng: **Năm** (150px, placeholder `2026`), **Tháng** (150px, placeholder `04`), **Ngày** (150px, placeholder `01`), **Loại báo cáo** (220px, placeholder `Mặc định / Theo ngày`).
     - Góc phải gồm: Tag tên bảng (nếu có) hoặc nút mở popup chọn bảng, và nút **"Xem"** (nút màu xanh `#1976D2`, icon `SearchOutlined`, chữ *"Xem"*).

---

### 3. Chi tiết các bước đã xử lý

#### Bước 1: Khôi phục giao diện thanh tìm kiếm cũ (`NavbarSearch.tsx` & `WareMasterData.tsx`)
- File [NavbarSearch.tsx](file:///c:/Users/MALV2025/Kho%20d%E1%BB%AF%20li%E1%BB%87u%20datalake/fe-modul-report/src/features/ware/components/NavbarSearch.tsx):
  - Khôi phục đúng cấu trúc gốc: loại bỏ khung `Bảng / Báo cáo` ở đầu hàng.
  - Giữ nguyên các ô nhập chuẩn:
    - **Năm**: độ rộng `150px`, placeholder `2026`.
    - **Tháng**: độ rộng `150px`, placeholder `04`, disable khi xem báo cáo năm.
    - **Ngày**: độ rộng `150px`, placeholder `01`, disable khi xem báo cáo tháng/năm.
    - **Loại báo cáo**: độ rộng `220px`, placeholder `Mặc định / Theo ngày`, các tùy chọn: Mặc định, Lũy kế theo tháng, Lũy kế theo năm.
    - Tag hiển thị mã/tên bảng bên phải (cho phép click để mở Modal chọn bảng khi cần).
    - Nút bấm nguyên bản: **"Xem"** (icon `SearchOutlined`).
- File [WareMasterData.tsx](file:///c:/Users/MALV2025/Kho%20d%E1%BB%AF%20li%E1%BB%87u%20datalake/fe-modul-report/src/features/ware/pages/WareMasterData.tsx):
  - Đồng bộ tham số tìm kiếm với URL khi người dùng chọn báo cáo từ Menu điều hướng "Xem báo cáo".
  - Tự động gọi API tải dữ liệu ngay khi mở báo cáo.

#### Bước 2: Sửa tên công ty trên báo cáo thành Công ty Than Dương Huy
- File [ResultPanel.tsx](file:///c:/Users/MALV2025/Kho%20d%E1%BB%AF%20li%E1%BB%87u%20datalake/fe-modul-report/src/features/ware/components/ResultPanel.tsx):
  - Đổi tiêu đề cố định:
    ```tsx
    <div className="font-bold text-sm print:text-xs tracking-wide text-gray-700">
      CÔNG TY THAN DƯƠNG HUY - TKV
    </div>
    ```

#### Bước 3: Lọc bỏ các cột kỹ thuật audit hệ thống
- **Frontend ([ResultPanel.tsx](file:///c:/Users/MALV2025/Kho%20d%E1%BB%AF%20li%E1%BB%87u%20datalake/fe-modul-report/src/features/ware/components/ResultPanel.tsx)):**
  Bổ sung vào danh sách `META_COLUMNS` để ẩn khỏi bảng hiển thị:
  - `data_upload_id`, `created_by`, `created_at`, `modified_by`, `modified_at`, `syncdate`, `version`, `maxdate`, `tenant_id`, `delete_flag`, `is_deleted`.
- **Backend ([WareApiService.java](file:///c:/Users/MALV2025/Kho%20d%E1%BB%AF%20li%E1%BB%87u%20datalake/be/src/main/java/com/quangnt0000/be_modul/service/DataWH/WareApiService.java)):**
  Định nghĩa danh sách `AUDIT_FIELDS` và loại trừ khi chuyển đổi dữ liệu trả về cho client:
  ```java
  private static final Set<String> AUDIT_FIELDS = Set.of(
      "data_upload_id", "created_by", "created_at", "modified_by",
      "modified_at", "syncdate", "version", "maxdate", "tenant_id",
      "delete_flag", "is_deleted", "deleted_at"
  );
  ```

#### Bước 4: Kiểm thử build cục bộ
- Frontend: Chạy `npm run build` tại `fe-modul-report` -> **Thành công (dist build sạch, không lỗi TypeScript)**.
- Backend: Chạy `mvn compile` tại thư mục `be` -> **BUILD SUCCESS**.

---

## II. QUY TRÌNH BUILD VÀ TRIỂN KHAI BACKEND VÀ HỆ THỐNG LÊN SERVER

Hệ thống Data Lake Than Dương Huy triển khai theo mô hình Container hóa qua Docker & Docker Compose trên server staging `103.226.250.92`.

### 1. Kiến trúc triển khai trên Server
- **Server IP:** `103.226.250.92`
- **Reverse Proxy (Nginx):** Port `7112` (ánh xạ nội bộ tới port `8888`)
- **Backend (Spring Boot):** Container `duonghuy_report_backend_service`, ánh xạ port máy chủ `8116:8080`
- **Frontend (React/Vite):** Container `duonghuy_report_frontend_service`
- **Database (PostgreSQL 16):** Container `pg_duonghuy_report_2211`, dữ liệu mount tại `/mnt/hdd/duonghuy_report_postgres_data`
- **PgAdmin:** Container `pgadmin_duonghuy_report_2211`, port máy chủ `3917:80`
- **Thư mục triển khai trên server:** `/home/ecotel/data-lake/duonghuy/deployment/staging` (hoặc `/data/report/` tùy user cấu hình)

---

### 2. Phương thức 1: Triển khai tự động qua CI/CD GitHub Actions (Khuyến nghị)

Workflow tự động đã được cấu hình sẵn trong file `.github/workflows/deploy-staging.yml`.

#### Quy trình tự động:
1. Developer commit code và push lên nhánh `dev/duonghuy`:
   ```bash
   git add .
   git commit -m "fix: restore old report UI and fix company title for Duong Huy"
   git push origin dev/duonghuy
   ```
2. GitHub Actions tự động kích hoạt job `Deploy for staging version`:
   - Bước 1: Checkout repository và tạo file `.env` cho frontend chứa `VITE_API`.
   - Bước 2: Chạy `make staging`:
     - Tự động lấy tag phiên bản và commit hash: `VERSION=staging-<TAG>-<COMMIT_ID>`.
     - Build Docker images cho backend, frontend và reverse-proxy song song (`docker compose -f docker-compose-build.yaml build --parallel`).
     - Đăng nhập DockerHub bằng secret token (`DOCKER_HUB_ACCESS_TOKEN`).
     - Đẩy (push) các image mới lên DockerHub repository `ecoteldev/duonghuy_report_*`.
   - Bước 3: SSH vào VPS `103.226.250.92`:
     - Đồng bộ file cấu hình `deploy.env`, `staging-docker-compose.yaml`, `start-app.sh`.
     - Dừng container cũ: `docker compose -f staging-docker-compose.yaml down`.
     - Kéo image mới nhất về máy chủ: `docker compose -f staging-docker-compose.yaml pull`.
     - Khởi chạy phiên bản mới ở chế độ nền (detached mode) qua `./start-app.sh`.
     - Dọn dẹp image cũ không dùng: `docker image prune -f`.

---

### 3. Phương thức 2: Quy trình Build và Triển khai Thủ công trên Server

Trong trường hợp cần can thiệp trực tiếp hoặc không thông qua GitHub Actions:

#### Bước 2.1: Build Backend JAR (nếu build không dùng Docker)
Tại thư mục `be`:
```bash
# Biên dịch và đóng gói file JAR (bỏ qua unit tests để đóng gói nhanh)
mvn clean package -DskipTests

# File JAR sau khi build nằm tại: be/target/be-modul-0.0.1-SNAPSHOT.jar
```

#### Bước 2.2: Build Docker Image Backend trên máy local và Push lên Registry
Tại thư mục gốc dự án:
```bash
# 1. Đăng nhập DockerHub
docker login -u ecoteldev

# 2. Định nghĩa tag phiên bản
export REGISTRY=ecoteldev
export VERSION=staging-latest

# 3. Build riêng Backend image
docker build -t ${REGISTRY}/duonghuy_report_backend_img:${VERSION} ./be

# 4. Push Backend image lên DockerHub
docker push ${REGISTRY}/duonghuy_report_backend_img:${VERSION}
```

#### Bước 2.3: Thao tác trên VPS Server qua SSH
Đăng nhập vào VPS:
```bash
ssh ecotel@103.226.250.92 -p 22
```

Chuyển vào thư mục chứa cấu hình staging:
```bash
cd /home/ecotel/data-lake/duonghuy/deployment/staging
```

Cập nhật phiên bản image trong file `.env`:
```bash
# Đảm bảo file .env trỏ đúng image vừa build
# Ví dụ:
# REGISTRY=ecoteldev
# VERSION=staging-latest
nano .env
```

Thực hiện pull image mới và khởi động lại Backend:
```bash
# 1. Dừng backend service cũ
docker compose -f staging-docker-compose.yaml stop duonghuy_report_backend_service

# 2. Xóa container backend cũ
docker compose -f staging-docker-compose.yaml rm -f duonghuy_report_backend_service

# 3. Kéo image backend mới nhất về
docker compose -f staging-docker-compose.yaml pull duonghuy_report_backend_service

# 4. Khởi chạy lại backend service ở chế độ nền
docker compose -f staging-docker-compose.yaml up -d duonghuy_report_backend_service

# 5. Xem log khởi động của Backend
docker compose -f staging-docker-compose.yaml logs -f --tail=100 duonghuy_report_backend_service
```

---

### 4. Kiểm tra và xác minh sau khi triển khai

1. **Kiểm tra trạng thái các Containers:**
   ```bash
   docker ps
   ```
   Kết quả mong muốn: Container `duonghuy_report_backend_service`, `duonghuy_report_frontend_service`, `duonghuy_report_reverse_proxy_service` và `pg_duonghuy_report_2211` đều có trạng thái `Up (healthy)`.

2. **Kiểm tra log Backend:**
   ```bash
   docker logs -f --tail=100 duonghuy_report_backend_service
   ```
   Đảm bảo ứng dụng Spring Boot khởi động thành công với thông báo:
   `Started BeModulApplication in ... seconds`.

3. **Kiểm tra API kết nối:**
   ```bash
   curl -I http://103.226.250.92:7112/api/health # hoặc endpoint kiểm tra
   ```

4. **Kiểm tra giao diện Web:**
   - Mở trình duyệt truy cập: `http://103.226.250.92:7112/`
   - Đăng nhập tài khoản: `admin` / `123456`
   - Vào mục **Xem báo cáo** -> Chọn bất kỳ báo cáo nào:
     - Header hiển thị: **CÔNG TY THAN DƯƠNG HUY - TKV**
     - Thanh tìm kiếm: đúng giao diện cũ nguyên bản (Năm, Tháng, Ngày, Loại báo cáo, nút Xem).
     - Bảng dữ liệu: chỉ hiển thị các cột chỉ tiêu nghiệp vụ, không còn các cột audit hệ thống.
