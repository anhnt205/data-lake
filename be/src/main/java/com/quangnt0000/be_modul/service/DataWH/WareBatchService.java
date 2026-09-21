package com.quangnt0000.be_modul.service.DataWH;

import com.quangnt0000.be_modul.dto.PageResponse;
import com.quangnt0000.be_modul.dto.TWH_Get.GetRequest;
import com.quangnt0000.be_modul.dto.TWH_Push.PushRequest;
import com.quangnt0000.be_modul.dto.WareBatch.WareBatchApproveRequest;
import com.quangnt0000.be_modul.dto.WareBatch.WareBatchDetailResponse;
import com.quangnt0000.be_modul.dto.WareBatch.WareBatchPush;
import com.quangnt0000.be_modul.dto.WareBatch.WareBatchRejectRequest;
import com.quangnt0000.be_modul.dto.WareBatch.WareBatchRequest;
import com.quangnt0000.be_modul.dto.WareBatch.WareBatchResponse;
import com.quangnt0000.be_modul.dto.WareBatch.WareBatchSearch;
import com.quangnt0000.be_modul.dto.WareBatch.MyApprovalBatchResponse;
import com.quangnt0000.be_modul.enums.WareBatchEnum;
import com.quangnt0000.be_modul.modal.DataLake.User;
import com.quangnt0000.be_modul.modal.DataWH.WareBatch;
import com.quangnt0000.be_modul.modal.DataWH.WareBatchApproval;
import com.quangnt0000.be_modul.modal.DataWH.WareDataRow;
import com.quangnt0000.be_modul.modal.DataWH.WareMapping;
import com.quangnt0000.be_modul.modal.DataWH.WareTemplate;
import com.quangnt0000.be_modul.modal.DataWH.WareTemplateApprovalConfig;
import com.quangnt0000.be_modul.repository.DataLake.EmployeeRepository;
import com.quangnt0000.be_modul.repository.DataLake.UserRepository;
import com.quangnt0000.be_modul.repository.DataWH.*;
import com.quangnt0000.be_modul.service.S3Service;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@RequiredArgsConstructor
@Service
public class WareBatchService {
    private final WareBatchRepository wareBatchRepository;
    private final WareTemplateRepository wareTemplateRepository;
    private final WareDataRowRepository wareDataRowRepository;
    private final WareBatchJdbc wareBatchJdbc;
    private final WareApiService wareApiService;
    private final WareDataRowService wareDataRowService;
    private final WareMappingRepository wareMappingRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final WareApprovalConfigRepository approvalConfigRepository;
    private final WareBatchApprovalRepository batchApprovalRepository;
    private final WareBatchActionRepository batchActionRepository;
    private final S3Service s3Service;
    
    // FormulaEvaluator để xử lý công thức Excel
    private FormulaEvaluator formulaEvaluator;

    private static final Set<String> IGNORED_AUDIT_FIELDS = Set.of(
            "MODIFIED_BY", "CREATED_AT", "DATA_UPLOAD_ID",
            "MODIFIED_AT", "MAXDATE", "CREATED_BY", "SYNCDATE"
    );

    private static boolean isIgnoredScopeFilter(String fieldName) {
        if (fieldName == null || fieldName.trim().isEmpty()) {
            return true;
        }
        String trimmed = fieldName.trim();
        if (IGNORED_AUDIT_FIELDS.contains(trimmed.toUpperCase())) {
            return true;
        }
        // TYPE_DATA viết hoa không phải là cột scope_filter hợp lệ trên Vinacomin (Vinacomin dùng 'type_data' viết thường)
        if ("TYPE_DATA".equals(trimmed)) {
            return true;
        }
        return false;
    }

    @Transactional
    public ResponseEntity<?> addWareBatch(WareBatchRequest request) {
        WareTemplate wareTemplate = wareTemplateRepository.findById(request.getWareTemplateId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "template not found"));
        String employeeId = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "user not found"));

        // Lấy danh sách mapping trực tiếp từ repository để đảm bảo dữ liệu mới nhất (chỉ lấy mapping chưa xóa)
        List<WareMapping> wareMappings = wareMappingRepository.findByWareTemplate_IdAndDeletedFalseOrderByIdAsc(wareTemplate.getId());
        if (wareMappings == null || wareMappings.isEmpty()) {
            wareMappings = wareTemplate.getWareMappings().stream()
                    .filter(m -> !Boolean.TRUE.equals(m.getDeleted()))
                    .toList();
        }

        try {
            Workbook workbook = WorkbookFactory.create(request.getFile().getInputStream());
            // Khởi tạo FormulaEvaluator để xử lý công thức
            formulaEvaluator = workbook.getCreationHelper().createFormulaEvaluator();

            int startRowIndex = (wareTemplate.getStartRow() != null ? wareTemplate.getStartRow() : 1) - 1;
            int consecutiveEmptyRows = 0;
            int maxConsecutiveEmpty = 10;

            log.info("=== BẮT ĐẦU ĐỌC EXCEL BATCH ===");
            log.info("Template ID: {}, Tên: '{}', startRow cấu hình: {} (index POI: {})",
                    wareTemplate.getId(), wareTemplate.getName(), wareTemplate.getStartRow(), startRowIndex);
            log.info("Tổng số sheet trong file: {}", workbook.getNumberOfSheets());
            for (int s = 0; s < workbook.getNumberOfSheets(); s++) {
                log.info("  -> Sheet [{}]: '{}' (tổng số dòng: {})", s, workbook.getSheetName(s), workbook.getSheetAt(s).getLastRowNum() + 1);
            }

            // Tự động tìm sheet chứa dữ liệu báo cáo (ưu tiên Template_Import hoặc sheet có nhiều dòng nhất)
            Sheet sheet = null;
            int maxRows = -1;
            for (int s = 0; s < workbook.getNumberOfSheets(); s++) {
                Sheet curSheet = workbook.getSheetAt(s);
                int lastRow = curSheet.getLastRowNum();
                if (lastRow < 0 || "Kangatang".equalsIgnoreCase(curSheet.getSheetName())) {
                    continue;
                }
                if ("Template_Import".equalsIgnoreCase(curSheet.getSheetName()) ||
                        curSheet.getSheetName().toLowerCase().contains("template")) {
                    sheet = curSheet;
                    break;
                }
                if (lastRow > maxRows) {
                    maxRows = lastRow;
                    sheet = curSheet;
                }
            }
            if (sheet == null) {
                sheet = workbook.getSheetAt(0);
            }

            log.info("Đã chọn xử lý Sheet: '{}' (vị trí index: {}, tổng số dòng: {})",
                    sheet.getSheetName(), workbook.getSheetIndex(sheet), sheet.getLastRowNum() + 1);
            log.info("Tổng số cột mapping cấu hình: {}", wareMappings != null ? wareMappings.size() : 0);
            if (wareMappings != null) {
                for (WareMapping wm : wareMappings) {
                    log.info("  [Mapping] fieldName: '{}', fieldTitle: '{}', fieldType: '{}', cellAddress: '{}', fieldValue: '{}'",
                            wm.getFieldName(), wm.getFieldTitle(), wm.getFieldType(), wm.getCellAddress(), wm.getFieldValue());
                }
            }

            List<Map<String, Object>> rows = new ArrayList<>();

            for (int i = Math.max(0, startRowIndex); i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) {
                    consecutiveEmptyRows++;
                    if (consecutiveEmptyRows >= maxConsecutiveEmpty) {
                        log.info("Dừng đọc sheet tại dòng Excel {} do gặp liên tiếp {} dòng null", i + 1, consecutiveEmptyRows);
                        break;
                    }
                    continue; // Bỏ qua dòng null, tiếp tục quét dòng sau
                }

                if (isRowEmpty(row, wareMappings)) {
                    consecutiveEmptyRows++;
                    if (consecutiveEmptyRows >= maxConsecutiveEmpty) {
                        log.info("Dừng đọc sheet tại dòng Excel {} do gặp liên tiếp {} dòng trống", i + 1, consecutiveEmptyRows);
                        break;
                    }
                    continue; // Bỏ qua dòng trống, tiếp tục quét dòng sau thay vì dừng cả file
                }

                consecutiveEmptyRows = 0; // Reset đếm dòng trống khi gặp dòng có dữ liệu

                Map<String, Object> data = new HashMap<>();

                for (WareMapping mapping : wareMappings) {
                    Object value;

                    switch (mapping.getFieldType()) {
                        case "ROW":
                            int colIndex;
                            try {
                                colIndex = Integer.parseInt(mapping.getCellAddress().trim()) - 1;
                            } catch (Exception e) {
                                colIndex = 0;
                            }
                            Cell cellRow = row.getCell(colIndex);
                            value = (cellRow != null) ? parseCell(cellRow, mapping.getFieldValue()) : null;
                            break;

                        case "CELL":
                            String[] parts = mapping.getCellAddress().split("-");
                            if (parts.length == 2) {
                                try {
                                    int targetRowNum = Integer.parseInt(parts[0].trim()) - 1;
                                    int targetColNum = Integer.parseInt(parts[1].trim()) - 1;
                                    Row targetRow = sheet.getRow(targetRowNum);
                                    if (targetRow != null) {
                                        Cell targetCell = targetRow.getCell(targetColNum);
                                        value = (targetCell != null) ? parseCell(targetCell, mapping.getFieldValue()) : null;
                                    } else {
                                        value = mapping.getFieldValue();
                                    }
                                } catch (Exception e) {
                                    value = mapping.getFieldValue();
                                }
                            } else {
                                value = mapping.getFieldValue();
                            }
                            break;

                        case "TEXT":
                            value = mapping.getCellAddress();
                            break;

                        default:
                            value = mapping.getFieldValue();
                    }

                    data.put(mapping.getFieldName(), value);
                }

                rows.add(data);
                log.info("Đã trích xuất dòng Excel {}: {}", i + 1, data);
            }

            List<Map<String, Object>> validRows = rows.stream()
                    .filter(row -> !isDataRowEmpty(row))
                    .toList();

            log.info("Tổng số dòng trích xuất được: {}, số dòng hợp lệ: {}", rows.size(), validRows.size());

            if (validRows.isEmpty()) {
                String errorMsg = String.format(
                        "File báo cáo không có dữ liệu (startRow cấu hình: %d, sheet đang đọc: '%s' có %d dòng, số dòng trích xuất được: %d). Vui lòng kiểm tra lại dòng bắt đầu hoặc sheet chứa dữ liệu trong file.",
                        wareTemplate.getStartRow(), sheet.getSheetName(), sheet.getLastRowNum() + 1, rows.size()
                );
                log.warn(errorMsg);
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorMsg);
            }

            // Lưu WareBatch
            WareBatch batch = wareBatchRepository.save(WareBatch.builder()
                    .code("new")
                    .name(request.getName())
                    .description(request.getDescription())
                    .employee(user.getEmployee())
                    .wareTemplate(wareTemplate)
                    .reportYear(request.getReportYear())
                    .reportMonth(request.getReportMonth())
                    .reportDay(request.getReportDay())
                    .status(WareBatchEnum.Cho_Phe_Duyet)
                    .build());

            batch.setCode("BATCH" + batch.getId());

            // Lưu các WareDataRow
            List<WareDataRow> wareDataRows = new ArrayList<>();
            for (Map<String, Object> dataRow : validRows) {
                wareDataRows.add(WareDataRow.builder()
                        .data(dataRow)
                        .wareBatch(batch)
                        .build());
            }

            wareDataRowRepository.saveAll(wareDataRows);

            // Upload file excel goc len S3 de luu tru doi soat sau khi da doc du lieu
            if (request.getFile() != null && !request.getFile().isEmpty()) {
                try {
                    String s3Key = s3Service.uploadFile("warehouse-batch*" + batch.getId(), request.getFile()).getKey();
                    batch.setS3FileKey(s3Key);
                    wareBatchRepository.save(batch);
                } catch (Exception e) {
                    System.err.println("Failed to upload file to S3: " + e.getMessage());
                }
            }

            // Khởi tạo approval workflow - tạo snapshot từ WareApprovalConfig
            initializeApprovalWorkflow(batch);

            return ResponseEntity.status(HttpStatus.CREATED).body(batch.getId());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

//    private boolean isRowEmpty(Row row, List<WareMapping> mappings) {
//        for (WareMapping mapping : mappings) {
//            if ("ROW".equals(mapping.getFieldType())) {
//                try {
//                    int colIndex = Integer.parseInt(mapping.getCellAddress()) - 1;
//                    Cell cell = row.getCell(colIndex);
//
//                    if (cell != null && cell.getCellType() != CellType.BLANK) {
//                        if (cell.getCellType() == CellType.FORMULA) {
//                            if (!cell.getStringCellValue().trim().isEmpty()) {
//                                return false;
//                            }
//                        } else {
//                            return false;
//                        }
//                    }
//                } catch (Exception e) {
//                    throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
//                }
//            }
//        }
//        return true;
//    }

    private boolean isRowEmpty(Row row, List<WareMapping> mappings) {
        if (row == null || mappings == null) return true;
        for (WareMapping mapping : mappings) {
            if (!"ROW".equals(mapping.getFieldType())) continue;
            if (mapping.getCellAddress() == null || mapping.getCellAddress().trim().isEmpty()) continue;

            try {
                int colIndex = Integer.parseInt(mapping.getCellAddress().trim()) - 1;
                if (colIndex < 0) continue;
                Cell cell = row.getCell(colIndex);

                if (cell == null) continue;

                CellType type = cell.getCellType();
                if (type == CellType.FORMULA) {
                    type = cell.getCachedFormulaResultType();
                }

                switch (type) {
                    case STRING:
                        if (!cell.getStringCellValue().trim().isEmpty()) {
                            return false;
                        }
                        break;
                    case NUMERIC:
                    case BOOLEAN:
                        return false;
                    default:
                        break;
                }
            } catch (NumberFormatException ignored) {
                // Cell address không phải dạng số, bỏ qua kiểm tra
            } catch (Exception e) {
                log.warn("Lỗi khi kiểm tra cell rỗng tại mapping '{}': {}", mapping.getFieldName(), e.getMessage());
            }
        }
        return true;
    }

    private boolean isDataRowEmpty(Map<String, Object> rowData) {
        if (rowData == null || rowData.isEmpty()) {
            return true;
        }

        for (Object value : rowData.values()) {
            if (value == null) {
                continue;
            }
            if (value instanceof String strValue) {
                if (!strValue.trim().isEmpty()) {
                    return false;
                }
                continue;
            }
            return false;
        }

        return true;
    }




/**
     * Parse cell value với xử lý đầy đủ cho công thức và các kiểu dữ liệu
     * @param cell Cell cần parse
     * @param fieldType Kiểu dữ liệu mong muốn (STRING, NUMBER, BOOLEAN, INTEGER)
     * @return Object giá trị đã parse
     */
    private Object parseCell(Cell cell, String fieldType) {
        if (cell == null) {
            return null;
        }

        CellType cellType = cell.getCellType();

        // Xử lý ô có công thức
        if (cellType == CellType.FORMULA) {
            try {
                // Evaluate công thức để lấy giá trị đã tính
                CellValue cellValue = formulaEvaluator.evaluate(cell);
                if (cellValue == null) {
                    return null;
                }
                cellType = cellValue.getCellType();
                
                // Parse giá trị đã tính theo fieldType mong muốn
                return parseCellValueByType(cellValue, fieldType);
            } catch (Exception e) {
                // Nếu không evaluate được, thử lấy cached result
                try {
                    cellType = cell.getCachedFormulaResultType();
                    return parseDirectCellByType(cell, cellType, fieldType);
                } catch (Exception ex) {
                    return null;
                }
            }
        }

        // Xử lý ô thường (không có công thức)
        return parseDirectCellByType(cell, cellType, fieldType);
    }

    /**
     * Parse CellValue từ FormulaEvaluator
     */
    private Object parseCellValueByType(CellValue cellValue, String fieldType) {
        if (cellValue == null) {
            return null;
        }

        String typeUpper = (fieldType != null) ? fieldType.trim().toUpperCase() : "";

        switch (typeUpper) {
            case "STRING":
                switch (cellValue.getCellType()) {
                    case STRING:
                        String strValue = cellValue.getStringValue();
                        return (strValue == null || strValue.trim().isEmpty()) ? null : strValue.trim();
                    case NUMERIC:
                        double numValue = cellValue.getNumberValue();
                        if (numValue == Math.floor(numValue) && !Double.isInfinite(numValue)) {
                            return String.valueOf((long) numValue);
                        }
                        return String.valueOf(numValue);
                    case BOOLEAN:
                        return String.valueOf(cellValue.getBooleanValue());
                    case BLANK:
                        return null;
                    default:
                        return null;
                }

            case "NUMBER":
                if (cellValue.getCellType() == CellType.NUMERIC) {
                    return cellValue.getNumberValue();
                } else if (cellValue.getCellType() == CellType.STRING) {
                    try {
                        return Double.parseDouble(cellValue.getStringValue().trim());
                    } catch (NumberFormatException e) {
                        return null;
                    }
                }
                return null;

            case "INTEGER":
                if (cellValue.getCellType() == CellType.NUMERIC) {
                    return (int) cellValue.getNumberValue();
                } else if (cellValue.getCellType() == CellType.STRING) {
                    try {
                        return Integer.parseInt(cellValue.getStringValue().trim());
                    } catch (NumberFormatException e) {
                        return null;
                    }
                }
                return null;

            case "BOOLEAN":
                if (cellValue.getCellType() == CellType.BOOLEAN) {
                    return cellValue.getBooleanValue();
                } else if (cellValue.getCellType() == CellType.STRING) {
                    String str = cellValue.getStringValue().trim().toLowerCase();
                    return "true".equals(str) || "1".equals(str);
                } else if (cellValue.getCellType() == CellType.NUMERIC) {
                    return cellValue.getNumberValue() != 0;
                }
                return null;

            default:
                // Fallback tự động nhận diện theo kiểu của CellValue nếu fieldType chưa cấu hình
                switch (cellValue.getCellType()) {
                    case STRING:
                        String s = cellValue.getStringValue();
                        return (s == null || s.trim().isEmpty()) ? null : s.trim();
                    case NUMERIC:
                        double d = cellValue.getNumberValue();
                        if (d == Math.floor(d) && !Double.isInfinite(d)) {
                            return (long) d;
                        }
                        return d;
                    case BOOLEAN:
                        return cellValue.getBooleanValue();
                    default:
                        return null;
                }
        }
    }

    /**
     * Parse trực tiếp từ Cell (không có công thức)
     */
    private Object parseDirectCellByType(Cell cell, CellType cellType, String fieldType) {
        if (cell == null) {
            return null;
        }

        String typeUpper = (fieldType != null) ? fieldType.trim().toUpperCase() : "";

        switch (typeUpper) {
            case "STRING":
                switch (cellType) {
                    case STRING:
                        String strValue = cell.getStringCellValue();
                        return (strValue == null || strValue.trim().isEmpty()) ? null : strValue.trim();
                    case NUMERIC:
                        if (DateUtil.isCellDateFormatted(cell)) {
                            return cell.getLocalDateTimeCellValue().toString();
                        }
                        double numValue = cell.getNumericCellValue();
                        if (numValue == Math.floor(numValue) && !Double.isInfinite(numValue)) {
                            return String.valueOf((long) numValue);
                        }
                        return String.valueOf(numValue);
                    case BOOLEAN:
                        return String.valueOf(cell.getBooleanCellValue());
                    case BLANK:
                        return null;
                    default:
                        return null;
                }

            case "NUMBER":
                if (cellType == CellType.NUMERIC) {
                    return cell.getNumericCellValue();
                } else if (cellType == CellType.STRING) {
                    try {
                        return Double.parseDouble(cell.getStringCellValue().trim());
                    } catch (NumberFormatException e) {
                        return null;
                    }
                }
                return null;

            case "INTEGER":
                if (cellType == CellType.NUMERIC) {
                    return (int) cell.getNumericCellValue();
                } else if (cellType == CellType.STRING) {
                    try {
                        return Integer.parseInt(cell.getStringCellValue().trim());
                    } catch (NumberFormatException e) {
                        return null;
                    }
                }
                return null;

            case "BOOLEAN":
                if (cellType == CellType.BOOLEAN) {
                    return cell.getBooleanCellValue();
                } else if (cellType == CellType.STRING) {
                    String str = cell.getStringCellValue().trim().toLowerCase();
                    return "true".equals(str) || "1".equals(str);
                } else if (cellType == CellType.NUMERIC) {
                    return cell.getNumericCellValue() != 0;
                }
                return null;

            default:
                // Fallback tự động nhận diện theo kiểu của Cell nếu fieldType chưa cấu hình
                switch (cellType) {
                    case STRING:
                        String s = cell.getStringCellValue();
                        return (s == null || s.trim().isEmpty()) ? null : s.trim();
                    case NUMERIC:
                        if (DateUtil.isCellDateFormatted(cell)) {
                            return cell.getLocalDateTimeCellValue().toString();
                        }
                        double d = cell.getNumericCellValue();
                        if (d == Math.floor(d) && !Double.isInfinite(d)) {
                            return (long) d;
                        }
                        return d;
                    case BOOLEAN:
                        return cell.getBooleanCellValue();
                    default:
                        return null;
                }
        }
    }

    public ResponseEntity<?> get(WareBatchSearch request) {
        List<WareBatch> wareBatchList = wareBatchRepository.findByWareTemplate_IdOrderByCreatedAtDesc(request.getWareTemplateId());
        List<WareBatchResponse> wareBathResponses = wareBatchList.stream()
                .map(
                        item -> WareBatchResponse.builder()
                                .id(item.getId())
                                .code(item.getCode())
                                .name(item.getName())
                                .description(item.getDescription())
                            .s3FileKey(item.getS3FileKey())
                                .createdAt(item.getCreatedAt())
                                .updatedAt(item.getUpdatedAt())
                                .employeeName(item.getEmployee() != null ? item.getEmployee().getName() : null)
                                .wareBatchStatus(
                                        item.getStatus() != null ? item.getStatus().name() : null
                                )
                                .build()
                )
                .toList();
        return ResponseEntity.ok(wareBathResponses);
    }

    /**
     * API: Lấy detail của WareBatch
     * GET /wh-batch/{id}
     * Bao gồm thông tin status để xác định được phép push/edit hay không
     */
    public ResponseEntity<?> getWareBatchDetail(Integer wareBatchId) {
        String employeeId = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "user not found"));
        WareBatch wareBatch = wareBatchRepository.findById(wareBatchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "batch not found"));

        if (wareBatch.getDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Batch đã bị xóa");
        }

        boolean canApprove = false;
        
        Optional<WareBatchApproval> myApprovalOpt = batchApprovalRepository
                .findByWareBatchIdAndApproverId(wareBatchId, user.getEmployee().getId());
        
        if (myApprovalOpt.isPresent()) {
            WareBatchApproval myApproval = myApprovalOpt.get();
            
            if (wareBatch.getStatus() != WareBatchEnum.Tu_Choi_Phe_Duyet) {
                if (myApproval.getStatus() == WareBatchEnum.Cho_Phe_Duyet) {
                    List<WareBatchApproval> allBatchApprovals = batchApprovalRepository
                            .findByWareBatchIdOrderByApprovalOrder(wareBatchId);
                    
                    Integer currentApprovalOrder = allBatchApprovals.stream()
                            .filter(a -> a.getStatus() == WareBatchEnum.Cho_Phe_Duyet)
                            .map(WareBatchApproval::getApprovalOrder)
                            .min(Integer::compareTo)
                            .orElse(null);
                    
                    if (currentApprovalOrder != null && 
                        myApproval.getApprovalOrder().equals(currentApprovalOrder)) {
                        canApprove = true;
                    }
                }
            }
        }

        WareBatchDetailResponse response = WareBatchDetailResponse.builder()
                .id(wareBatch.getId())
                .code(wareBatch.getCode())
                .name(wareBatch.getName())
                .description(wareBatch.getDescription())
            .s3FileKey(wareBatch.getS3FileKey())
                .templateId(wareBatch.getWareTemplate().getId())
                .templateName(wareBatch.getWareTemplate().getName())
                .employeeId(wareBatch.getEmployee().getId())
                .employeeName(wareBatch.getEmployee().getName())
                .createdAt(wareBatch.getCreatedAt())
                .updatedAt(wareBatch.getUpdatedAt())
                .status(wareBatch.getStatus())
                .canApprove(canApprove)
                .build();

        return ResponseEntity.ok(response);
    }

    public ResponseEntity<?> search(WareBatchSearch request) {
        List<WareBatchResponse> wareBatchResponses = wareBatchJdbc.search(request);
        Integer count = wareBatchJdbc.count(request);
        PageResponse response = PageResponse.builder()
                .page(request.getPage())
                .limit(request.getLimit())
                .totalElements(count)
                .totalPages(count / request.getLimit())
                .content(wareBatchResponses)
                .build();
        return ResponseEntity.ok(response);
    }


    public ResponseEntity<?> push(WareBatchPush request) {
        WareBatch wareBatch = wareBatchRepository.findById(request.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "batch not found"));

        // Chỉ cho phép push khi WareBatch đã được phê duyệt hoàn tất
        if (wareBatch.getStatus() == WareBatchEnum.Tu_Choi_Phe_Duyet) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Batch đã bị từ chối, không thể push dữ liệu"
            );
        }

        if (wareBatch.getStatus() == WareBatchEnum.Cho_Phe_Duyet) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Batch chưa hoàn tất phê duyệt, không thể push dữ liệu"
            );
        }

        List<WareDataRow> wareDataRows = wareDataRowService.getByBatchId(request.getId());

        Integer templateId = wareBatch.getWareTemplate().getId();
        List<WareMapping> allMappings = wareMappingRepository.findByWareTemplate_IdAndDeletedFalseOrderByIdAsc(templateId);
        if (allMappings == null || allMappings.isEmpty()) {
            allMappings = wareBatch.getWareTemplate().getWareMappings().stream()
                    .filter(m -> !Boolean.TRUE.equals(m.getDeleted()))
                    .toList();
        }

        List<WareMapping> filters = allMappings.stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsScopFilter()))
                .filter(m -> !isIgnoredScopeFilter(m.getFieldName()))
                .toList();

        List<String> keyColumns = new ArrayList<>(allMappings.stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsKeyColumn()))
                .map(WareMapping::getFieldName)
                .filter(name -> name != null && !name.isBlank() && !isIgnoredScopeFilter(name))
                .distinct()
                .toList());
        if (!keyColumns.contains("ID")) {
            keyColumns.add("ID");
        }

        Map<String, Object> filter = new HashMap<>();
        if (!wareDataRows.isEmpty()) {
            WareDataRow firstRow = wareDataRows.get(0);
            Map<String, Object> rowData = firstRow.getData();

            if (rowData != null) {
                for (WareMapping m : filters) {
                    String key = m.getFieldName();
                    if (isIgnoredScopeFilter(key)) {
                        continue;
                    }
                    if (rowData.containsKey(key)) {
                        Object value = rowData.get(key);
                        if (value != null && !value.toString().trim().isEmpty()) {
                            filter.put(key, value);
                        }
                    }
                }
            }
        }

        WareTemplate wareTemplate = wareBatch.getWareTemplate();
        PushRequest body = PushRequest.builder()
                .table(wareTemplate.getTableCode())
                .keyColumns(keyColumns)
                .scopeFilter(filter)
                .rows(
                        wareDataRows.stream()
                                .map(row -> {
                                    Map<String, Object> data = new HashMap<>(row.getData());
                                    data.putIfAbsent("ID", row.getId());
                                    return data;
                                })
                                .toList()
                )
                .requestId(UUID.randomUUID().toString())
                .deleteMissing(request.getDeleteMissing())
                .changedBy(UUID.randomUUID().toString())
                .dataUploadId(UUID.randomUUID().toString())
                .build();
        try {
            ResponseEntity<?> response = wareApiService.push(body, wareBatch, request).block();
            if (response != null && response.getStatusCode().is2xxSuccessful()) {
                wareBatch.setStatus(WareBatchEnum.Da_Phe_Duyet);
                wareBatchRepository.save(wareBatch);
            }
            return response;
        }catch (Exception e){
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    public ResponseEntity<?> update(WareBatchRequest request) {
        WareBatch wareBatch = wareBatchRepository.findById(request.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "batch not found"));
        wareBatch.setName(request.getName());
        wareBatch.setDescription(request.getDescription());
        wareBatch.setReportYear(request.getReportYear());
        wareBatch.setReportMonth(request.getReportMonth());
        wareBatch.setReportDay(request.getReportDay());
        wareBatch = wareBatchRepository.save(wareBatch);
        return ResponseEntity.ok(wareBatch.getId());
    }

    public ResponseEntity<?> delete(Integer wareBatchId) {
        WareBatch wareBatch = wareBatchRepository.findById(wareBatchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "batch not found"));
        wareBatch.setDeleted(true);
        wareBatchRepository.save(wareBatch);
        return ResponseEntity.ok("deleted");
    }

    /**
     * Reject WareBatch theo quy tắc Sequential Approval
     * Chỉ người có approvalOrder nhỏ nhất còn PENDING mới được reject
     */
    @Transactional
    public ResponseEntity<?> rejectApproval(WareBatchRejectRequest request) {
        String employeeId = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "user not found"));

        WareBatch wareBatch = wareBatchRepository.findById(request.getWareBatchId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "batch not found"));

        if (wareBatch.getDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Batch đã bị xóa");
        }

        if (wareBatch.getStatus() != WareBatchEnum.Cho_Phe_Duyet) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Batch không ở trạng thái chờ phê duyệt. Trạng thái hiện tại: " + wareBatch.getStatus());
        }

        // Lấy tất cả approvals theo thứ tự
        List<WareBatchApproval> approvals = batchApprovalRepository
                .findByWareBatchIdOrderByApprovalOrder(request.getWareBatchId());

        if (approvals.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không có cấu hình phê duyệt cho batch này");
        }

        // Tìm approval đầu tiên còn PENDING (thứ tự nhỏ nhất)
        WareBatchApproval nextPendingApproval = approvals.stream()
                .filter(a -> a.getStatus() == WareBatchEnum.Cho_Phe_Duyet)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Không còn approval nào đang chờ duyệt"));

        // Validate: người reject phải là người ở thứ tự tiếp theo
        if (!nextPendingApproval.getApprover().getId().equals(user.getEmployee().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Bạn không có quyền từ chối ở thứ tự này. Người phê duyệt hiện tại: " +
                    nextPendingApproval.getApprover().getName());
        }

        // Reject: cập nhật status
        nextPendingApproval.setStatus(WareBatchEnum.Tu_Choi_Phe_Duyet);
        batchApprovalRepository.save(nextPendingApproval);

        // Cập nhật WareBatch sang REJECTED
        wareBatch.setStatus(WareBatchEnum.Tu_Choi_Phe_Duyet);
        wareBatchRepository.save(wareBatch);

        return ResponseEntity.ok("Từ chối phê duyệt thành công. Batch không thể push dữ liệu.");
    }

    /**
     * Approve WareBatch theo quy tắc Sequential Approval
     * Chỉ người có approvalOrder nhỏ nhất còn PENDING mới được approve
     */
    @Transactional
    public ResponseEntity<?> approve(WareBatchApproveRequest request) {
        String employeeId = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "user not found"));

        WareBatch wareBatch = wareBatchRepository.findById(request.getWareBatchId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "batch not found"));

        if (wareBatch.getDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Batch đã bị xóa");
        }

        if (wareBatch.getStatus() == WareBatchEnum.Tu_Choi_Phe_Duyet) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Batch đã bị từ chối, không thể phê duyệt");
        }

        if (wareBatch.getStatus() != WareBatchEnum.Cho_Phe_Duyet) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                    "Batch không ở trạng thái chờ phê duyệt. Trạng thái hiện tại: " + wareBatch.getStatus());
        }

        // Lấy tất cả approvals theo thứ tự
        List<WareBatchApproval> approvals = batchApprovalRepository
                .findByWareBatchIdOrderByApprovalOrder(request.getWareBatchId());

        if (approvals.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                    "Không có cấu hình phê duyệt cho batch này");
        }

        // Tìm approval đầu tiên còn PENDING (thứ tự nhỏ nhất)
        WareBatchApproval nextPendingApproval = approvals.stream()
                .filter(a -> a.getStatus() == WareBatchEnum.Cho_Phe_Duyet)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                        "Không còn approval nào đang chờ duyệt"));

        // Validate: người approve phải là người ở thứ tự tiếp theo
        if (!nextPendingApproval.getApprover().getId().equals(user.getEmployee().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, 
                    "Bạn không có quyền phê duyệt ở thứ tự này. Người phê duyệt hiện tại: " + 
                    nextPendingApproval.getApprover().getName());
        }

        // Approve: cập nhật status
        nextPendingApproval.setStatus(WareBatchEnum.Da_Phe_Duyet);
        batchApprovalRepository.save(nextPendingApproval);

        // Kiểm tra xem còn approval nào PENDING không
        boolean hasMorePending = approvals.stream()
                .anyMatch(a -> a.getStatus() == WareBatchEnum.Cho_Phe_Duyet && 
                               !a.getId().equals(nextPendingApproval.getId()));

        // Nếu không còn PENDING → cập nhật status của WareBatch
        if (!hasMorePending) {
            wareBatch.setStatus(WareBatchEnum.Da_Phe_Duyet);
            wareBatchRepository.save(wareBatch);
            return ResponseEntity.ok("Phê duyệt thành công. Tất cả các bước phê duyệt đã hoàn tất.");
        }

        return ResponseEntity.ok("Phê duyệt thành công. Đang chờ phê duyệt bước tiếp theo.");
    }

    public ResponseEntity<?> getMasterData(Integer batchId, GetRequest request) {
        WareBatch wareBatch = wareBatchRepository.findById(batchId)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.BAD_REQUEST, "batch not found")
                );

        Integer templateId = wareBatch.getWareTemplate().getId();
        List<WareMapping> allMappings = wareMappingRepository.findByWareTemplate_IdAndDeletedFalseOrderByIdAsc(templateId);
        if (allMappings == null || allMappings.isEmpty()) {
            allMappings = wareBatch.getWareTemplate().getWareMappings().stream()
                    .filter(m -> !Boolean.TRUE.equals(m.getDeleted()))
                    .toList();
        }

        List<String> mapFilters = allMappings.stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsScopFilter()))
                .map(WareMapping::getFieldName)
                .filter(name -> !isIgnoredScopeFilter(name))
                .toList();

        Map<String, Object> data =
                wareBatch.getWareDataRows().get(0).getData();

        Map<String, Object> filters = new HashMap<>();

        if (data != null) {
            for (String fieldName : mapFilters) {
                if (data.containsKey(fieldName)) {
                    Object value = data.get(fieldName);
                    if (value != null && !value.toString().trim().isEmpty()) {
                        filters.put(fieldName, value);
                    }
                }
            }
        }
        request.setFilters(filters);
        return wareApiService.getMasterData(request).block();
    }

    /**
     * API: Lấy danh sách WareBatch của người duyệt hiện tại
     * GET /wh-batch/my-approvals
     * Trả về TẤT CẢ batch mà user tham gia phê duyệt,
     * kèm theo đầy đủ context để FE quyết định hiển thị
     */
    public ResponseEntity<?> getMyApprovalBatches(String departmentId) {
        String employeeId = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "user not found"));

        // Lấy tất cả WareBatchApproval của user hiện tại
        List<WareBatchApproval> myApprovals = batchApprovalRepository
                .findByApproverId(user.getEmployee().getId());

        // Group theo WareBatch để xử lý
        Map<Integer, WareBatchApproval> batchIdToMyApproval = new HashMap<>();
        for (WareBatchApproval approval : myApprovals) {
            batchIdToMyApproval.put(approval.getWareBatch().getId(), approval);
        }

        // Tạo response list
        List<MyApprovalBatchResponse> responses = new ArrayList<>();

        for (WareBatchApproval myApproval : myApprovals) {
            WareBatch batch = myApproval.getWareBatch();

            // Filter theo departmentId nếu có
            if (departmentId != null && !departmentId.isEmpty()) {
                String batchDepartmentId = batch.getWareTemplate() != null 
                    && batch.getWareTemplate().getWareCategory() != null 
                    && batch.getWareTemplate().getWareCategory().getDepartment() != null
                    ? batch.getWareTemplate().getWareCategory().getDepartment().getId()
                    : null;
                
                if (!departmentId.equals(batchDepartmentId)) {
                    continue;
                }
            }

            // Lấy tất cả approvals của batch này để tính toán
            List<WareBatchApproval> allBatchApprovals = batchApprovalRepository
                    .findByWareBatchIdOrderByApprovalOrder(batch.getId());

            // Tính toán thông tin luồng phê duyệt
            Integer currentApprovalOrder = null;

            for (WareBatchApproval approval : allBatchApprovals) {
                if (approval.getStatus() == WareBatchEnum.Cho_Phe_Duyet) {
                    // Tìm thứ tự nhỏ nhất còn PENDING
                    if (currentApprovalOrder == null) {
                        currentApprovalOrder = approval.getApprovalOrder();
                        break;
                    }
                }
            }

            // Xác định canApprove
            boolean canApprove = false;

            if (batch.getStatus() != WareBatchEnum.Tu_Choi_Phe_Duyet) {
                if (myApproval.getStatus() == WareBatchEnum.Cho_Phe_Duyet) {
                    if (currentApprovalOrder != null && 
                        myApproval.getApprovalOrder().equals(currentApprovalOrder)) {
                        canApprove = true;
                    }
                }
            }

            // Kiểm tra isPushed
            boolean isPushed = batchActionRepository.existsByWareBatchId(batch.getId());
            
            // Build response
            MyApprovalBatchResponse response = MyApprovalBatchResponse.builder()
                    // Batch info
                    .batchId(batch.getId())
                    .batchCode(batch.getCode())
                    .batchName(batch.getName())
                    .batchDescription(batch.getDescription())
                    .createdAt(batch.getCreatedAt())
                    // Thời gian báo cáo
                    .reportYear(batch.getReportYear())
                    .reportMonth(batch.getReportMonth())
                    .reportDay(batch.getReportDay())
                    // Trạng thái batch
                    .batchStatus(batch.getStatus())
                    // Approval context của user hiện tại
                    .myApprovalId(myApproval.getId())
                    .myApprovalStatus(myApproval.getStatus())
                    .myApprovalOrder(myApproval.getApprovalOrder())
                    .currentApprovalOrder(currentApprovalOrder)
                    // Quyết định action
                    .canApprove(canApprove)
                    // Push status
                    .isPushed(isPushed)
                    .build();

            responses.add(response);
        }

        return ResponseEntity.ok(responses);
    }

    /**
     * Khởi tạo approval workflow khi tạo WareBatch
     * Copy snapshot từ WareApprovalConfig sang WareBatchApproval
     */
    private void initializeApprovalWorkflow(WareBatch wareBatch) {
        // Lấy danh sách approval config ACTIVE của WareTemplate, sắp xếp theo approvalOrder
        List<WareTemplateApprovalConfig> activeConfigs = approvalConfigRepository
                .findActiveConfigsByWareTemplateId(wareBatch.getWareTemplate().getId());

        if (activeConfigs.isEmpty()) {
            // Không có config nào thì không cần tạo approval
            return;
        }

        // Tạo snapshot: copy sang WareBatchApproval
        List<WareBatchApproval> batchApprovals = new ArrayList<>();
        for (WareTemplateApprovalConfig config : activeConfigs) {
            WareBatchApproval batchApproval = WareBatchApproval.builder()
                    .wareBatch(wareBatch)
                    .approver(config.getApprover())
                    .approvalOrder(config.getApprovalOrder())
                    .status(WareBatchEnum.Cho_Phe_Duyet)  // Trạng thái ban đầu
                    .build();
            batchApprovals.add(batchApproval);
        }

        // Lưu tất cả approvals
        batchApprovalRepository.saveAll(batchApprovals);
    }
}
