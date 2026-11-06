package com.quangnt0000.be_modul.dto.TargetReport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
public class TargetReportResponse {
    String id;
    String targetId;

    String targetName;
    String code;
    String unit;
    BigDecimal value;

    Integer productionOrderId;
    LocalDate productionDate;

    Integer totalDays;

    BigDecimal targetPerDay;

    Integer shiftDone;
    Integer shiftPlus;
    Integer shiftRemain;

    BigDecimal targetPerDayRemain;
    BigDecimal performDone;

    BigDecimal monthLyCumulative;
    BigDecimal donePercent;

    @Builder.Default
    List<TargetReportResponse> children = new ArrayList<>(); // target con
}
