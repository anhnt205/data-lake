package com.quangnt0000.be_modul.dto.WareBatch;

import com.quangnt0000.be_modul.enums.WareBatchEnum;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
public class WareBatchSearch {
    @Builder.Default
    private Integer page = 0;
    @Builder.Default
    private Integer limit = 10;
    @Builder.Default
    private String keyword = null;
    @Builder.Default
    private Integer wareTemplateId = null;
    @Builder.Default
    private List<String> departmentIds = null;
    @Builder.Default
    private WareBatchEnum status = null;
    @Builder.Default
    private Boolean isPushed = null;
}
