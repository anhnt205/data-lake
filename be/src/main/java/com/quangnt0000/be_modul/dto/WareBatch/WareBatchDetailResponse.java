package com.quangnt0000.be_modul.dto.WareBatch;

import com.quangnt0000.be_modul.enums.WareBatchEnum;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response DTO cho detail của WareBatch
 * Bao gồm thông tin đầy đủ để hiển thị và quyết định actions (upload, push, etc.)
 */
@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
public class WareBatchDetailResponse {
    
    // Thông tin cơ bản
    private Integer id;
    private String code;
    private String name;
    private String description;
    private String s3FileKey;
    
    // Template info
    private Integer templateId;
    private String templateName;
    
    // Người tạo
    private String employeeId;
    private String employeeName;
    
    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private WareBatchEnum status;
    
    private boolean canApprove;
    private Boolean isPushed;
}
