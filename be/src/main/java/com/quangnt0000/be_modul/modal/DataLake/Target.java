package com.quangnt0000.be_modul.modal.DataLake;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
@Entity
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
public class Target {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;

    String name;
    String code;
    String unit;
    BigDecimal value;
    YearMonth month;

    @OneToMany(mappedBy = "target")
    @Builder.Default
    private List<TargetReport> reports = new ArrayList<>();

    @ManyToOne
    @JoinColumn(name = "departmentId")
    Department department;

    String parentId;

    @Builder.Default
    Boolean deleted = false;

    @Converter(autoApply = true)
    public static class YearMonthConverter
            implements AttributeConverter<YearMonth, Integer> {

        @Override
        public Integer convertToDatabaseColumn(YearMonth ym) {
            if (ym == null) {
                return null;
            }

            return ym.getYear() * 100 + ym.getMonthValue();
        }

        @Override
        public YearMonth convertToEntityAttribute(Integer value) {
            if (value == null) {
                return null;
            }

            return YearMonth.of(
                    value / 100,
                    value % 100
            );
        }
    }
}
