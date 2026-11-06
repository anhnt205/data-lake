package com.quangnt0000.be_modul.service.DataWH;

import com.quangnt0000.be_modul.dto.WareTemplate.TableOption;
import com.quangnt0000.be_modul.dto.WareTemplate.WareTemplateRequest;
import com.quangnt0000.be_modul.dto.WareTemplate.WareTemplateResponse;
import com.quangnt0000.be_modul.dto.WareTemplate.WareTemplateSearch;
import com.quangnt0000.be_modul.modal.DataWH.WareCategory;
import com.quangnt0000.be_modul.modal.DataWH.WareTemplate;
import com.quangnt0000.be_modul.repository.DataWH.WareCategoryRepository;
import com.quangnt0000.be_modul.repository.DataWH.WareTemplateRepository;
import com.quangnt0000.be_modul.repository.DataWH.WareApprovalConfigRepository;
import com.quangnt0000.be_modul.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RequiredArgsConstructor
@Service
public class WareTemplateService {
    private final WareTemplateRepository wareTemplateRepository;
    private final WareCategoryRepository wareCategoryRepository;
    private final WareApprovalConfigRepository wareApprovalConfigRepository;
    private final S3Service s3Service;

    @Transactional
    public ResponseEntity<?> add(WareTemplateRequest request) {
        WareCategory wareCategory = wareCategoryRepository.findById(request.getWareCategoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "category not found"));

        String excelFileKey = null;
        if (request.getExcelFile() != null && !request.getExcelFile().isEmpty()) {
            excelFileKey = s3Service.uploadFile("warehouse-template", request.getExcelFile()).getKey();
        }

        WareTemplate wareTemplate = WareTemplate.builder()
                .code("new")
                .name(request.getName())
                .description(request.getDescription())
                .tableName(request.getTableName())
                .tableCode(request.getTableCode())
                .startRow(request.getStartRow())
                .excelFileKey(excelFileKey)
                .wareCategory(wareCategory)
                .build();
        wareTemplate = wareTemplateRepository.save(wareTemplate);
        wareTemplate.setCode("W-TMP" + wareTemplate.getId());
        return ResponseEntity.ok(wareTemplate.getId());
    }

    public ResponseEntity<?> delete(Integer templateId) {

        WareTemplate wareTemplate = wareTemplateRepository.findById(templateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "template not found"));
        wareTemplateRepository.delete(wareTemplate);
        return ResponseEntity.ok("Deleted template");
    }


    public ResponseEntity<?> getAll(WareTemplateSearch request) {
        List<WareTemplate> wareTemplates = wareTemplateRepository.findByWareCategory_IdOrderByNameAsc(request.getWareCategoryId());
        List<WareTemplateResponse> responses = wareTemplates.stream().map(
                wareTemplate -> {
                    boolean hasConfig = !wareApprovalConfigRepository
                            .findByWareTemplateIdOrderByApprovalOrder(wareTemplate.getId())
                            .isEmpty();
                    return WareTemplateResponse.builder()
                            .id(wareTemplate.getId())
                            .code(wareTemplate.getCode())
                            .name(wareTemplate.getName())
                            .description(wareTemplate.getDescription())
                            .tableName(wareTemplate.getTableName())
                            .tableCode(wareTemplate.getTableCode())
                            .excelFileKey(wareTemplate.getExcelFileKey())
                            .startRow(wareTemplate.getStartRow())
                            .createdAt(wareTemplate.getCreatedAt())
                            .updatedAt(wareTemplate.getUpdatedAt())
                            .hasApprovalConfig(hasConfig)
                            .build();
                }
        ).toList();
        return ResponseEntity.ok(responses);
    }

    public ResponseEntity<?> getById(Integer templateId) {
        WareTemplate wareTemplate = wareTemplateRepository.findByIdAndDeletedFalse(templateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "template not found"));
        WareTemplateResponse wareTemplateResponse = WareTemplateResponse.builder()
                .id(wareTemplate.getId())
                .code(wareTemplate.getCode())
                .name(wareTemplate.getName())
                .description(wareTemplate.getDescription())
                .tableName(wareTemplate.getTableName())
                .tableCode(wareTemplate.getTableCode())
                .excelFileKey(wareTemplate.getExcelFileKey())
                .startRow(wareTemplate.getStartRow())
                .createdAt(wareTemplate.getCreatedAt())
                .updatedAt(wareTemplate.getUpdatedAt())
                .build();
        return ResponseEntity.ok(wareTemplateResponse);
    }

    public ResponseEntity<?> update(WareTemplateRequest request) {
        WareTemplate wareTemplate = wareTemplateRepository.findById(request.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "template not found"));
        wareTemplate.setName(request.getName());
        wareTemplate.setDescription(request.getDescription());
        wareTemplate.setTableName(request.getTableName());
        wareTemplate.setTableCode(request.getTableCode());
        wareTemplate.setStartRow(request.getStartRow());
        if (request.getExcelFile() != null && !request.getExcelFile().isEmpty()) {
            String excelFileKey = s3Service.uploadFile("warehouse-template", request.getExcelFile()).getKey();
            wareTemplate.setExcelFileKey(excelFileKey);
        }
        wareTemplate = wareTemplateRepository.save(wareTemplate);
        return ResponseEntity.ok(wareTemplate.getId());
    }

    public ResponseEntity<?> getTableOption(String keyword) {
        if (keyword == null || keyword.isEmpty()) {
            keyword = "";
        }
        List<TableOption> tableOptions = wareTemplateRepository.getTableOption(keyword);
        return ResponseEntity.ok(tableOptions);
    }

    public ResponseEntity<Resource> exportExcel(Integer templateId) {
        WareTemplate wareTemplate = wareTemplateRepository.findByIdAndDeletedFalse(templateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "template not found"));

        if (wareTemplate.getExcelFileKey() == null || wareTemplate.getExcelFileKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "template has no excel file");
        }

        return s3Service.getFileV3(wareTemplate.getExcelFileKey());
    }
}
