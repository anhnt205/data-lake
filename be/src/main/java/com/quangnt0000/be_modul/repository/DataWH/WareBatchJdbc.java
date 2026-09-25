package com.quangnt0000.be_modul.repository.DataWH;

import com.quangnt0000.be_modul.dto.WareBatch.WareBatchResponse;
import com.quangnt0000.be_modul.dto.WareBatch.WareBatchSearch;
import com.quangnt0000.be_modul.dto.WareCategory.WareCategoryResponse;
import com.quangnt0000.be_modul.dto.dashboard.DashboardRequest;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
public class WareBatchJdbc {
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public List<WareBatchResponse> search(WareBatchSearch request) {
        StringBuilder sql = new StringBuilder(
                """
                    SELECT 
                        wb.id AS id,
                        wb.code AS code,
                        wt.table_code AS tableCode,
                        wt.table_name AS reportName,
                        wb.description AS description,
                        wb.s3_file_key AS s3_file_key,
                        wb.created_at AS created_at,
                        wb.updated_at AS updated_at,
                        e.name AS employee_name,
                        wb.status AS ware_batch_status,
                        wb.report_year AS report_year,
                        wb.report_month AS report_month,
                        wb.report_day AS report_day,
                        CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM ware_batch_action wba
                                WHERE wba.ware_batch_id = wb.id
                                  AND (wba.deleted = false OR wba.deleted IS NULL)
                                  AND (COALESCE(wba.inserted, 0) > 0 OR COALESCE(wba.updated, 0) > 0)
                            )
                            THEN 'true'
                            ELSE 'false'
                        END AS is_pushed
                    FROM ware_batch wb
                    LEFT JOIN employee e ON wb.employee_id = e.id
                    LEFT JOIN ware_template wt ON wb.ware_template_id = wt.id
                    LEFT JOIN ware_category wc ON wt.ware_category_id = wc.id
                    LEFT JOIN department d ON wc.department_id = d.id
                    WHERE wb.deleted = false
                """
        );
        List<Object> params = new ArrayList<>();
        if (request.getKeyword() != null) {
            sql.append(" and (wb.name like ? or wb.code like ? ) ");
            params.add("%" + request.getKeyword() + "%");
            params.add("%" + request.getKeyword() + "%");
        }

        if (request.getWareTemplateId() != null) {
            sql.append(" and wb.ware_template_id = ? ");
            params.add(request.getWareTemplateId());
        }

        if (request.getDepartmentIds() != null && !request.getDepartmentIds().isEmpty()) {
            sql.append(" and d.id IN (");
            for (int i = 0; i < request.getDepartmentIds().size(); i++) {
                sql.append("?");
                if (i < request.getDepartmentIds().size() - 1) {
                    sql.append(",");
                }
                params.add(request.getDepartmentIds().get(i));
            }
            sql.append(") ");
        }

        if (request.getStatus() != null) {
            sql.append(" and wb.status = ? ");
            params.add(request.getStatus().name());
        }

        if (request.getIsPushed() != null) {
            if (request.getIsPushed()) {
                sql.append("""
                     and EXISTS (
                         SELECT 1
                         FROM ware_batch_action wba
                         WHERE wba.ware_batch_id = wb.id
                           AND (wba.deleted = false OR wba.deleted IS NULL)
                           AND (COALESCE(wba.inserted, 0) > 0 OR COALESCE(wba.updated, 0) > 0)
                     ) 
                """);
            } else {
                sql.append("""
                     and NOT EXISTS (
                         SELECT 1
                         FROM ware_batch_action wba
                         WHERE wba.ware_batch_id = wb.id
                           AND (wba.deleted = false OR wba.deleted IS NULL)
                           AND (COALESCE(wba.inserted, 0) > 0 OR COALESCE(wba.updated, 0) > 0)
                     ) 
                """);
            }
        }

        int limit = request.getLimit();
        int offset = request.getPage() * request.getLimit();

        sql.append(" ORDER BY wb.created_at DESC");

        sql.append(" LIMIT ").append(limit).append(" OFFSET ").append(offset);
        return jdbcTemplate.query(sql.toString(),
                params.toArray(),
                new BeanPropertyRowMapper<>(WareBatchResponse.class)
        );
    }

    public Integer count(WareBatchSearch request) {
        StringBuilder sql = new StringBuilder(
                """
                    SELECT 
                        count(*)
                    FROM ware_batch wb
                    LEFT JOIN employee e ON wb.employee_id = e.id
                    LEFT JOIN ware_template wt ON wb.ware_template_id = wt.id
                    LEFT JOIN ware_category wc ON wt.ware_category_id = wc.id
                    LEFT JOIN department d ON wc.department_id = d.id
                    WHERE wb.deleted = false
                """
        );
        List<Object> params = new ArrayList<>();
        if (request.getKeyword() != null) {
            sql.append(" and (wb.name like ? or wb.code like ? ) ");
            params.add("%" + request.getKeyword() + "%");
            params.add("%" + request.getKeyword() + "%");
        }

        if (request.getWareTemplateId() != null) {
            sql.append(" and wb.ware_template_id = ? ");
            params.add(request.getWareTemplateId());
        }

        if (request.getDepartmentIds() != null && !request.getDepartmentIds().isEmpty()) {
            sql.append(" and d.id IN (");
            for (int i = 0; i < request.getDepartmentIds().size(); i++) {
                sql.append("?");
                if (i < request.getDepartmentIds().size() - 1) {
                    sql.append(",");
                }
                params.add(request.getDepartmentIds().get(i));
            }
            sql.append(") ");
        }

        if (request.getStatus() != null) {
            sql.append(" and wb.status = ? ");
            params.add(request.getStatus().name());
        }

        if (request.getIsPushed() != null) {
            if (request.getIsPushed()) {
                sql.append("""
                     and EXISTS (
                         SELECT 1
                         FROM ware_batch_action wba
                         WHERE wba.ware_batch_id = wb.id
                           AND (wba.deleted = false OR wba.deleted IS NULL)
                           AND (COALESCE(wba.inserted, 0) > 0 OR COALESCE(wba.updated, 0) > 0)
                     ) 
                """);
            } else {
                sql.append("""
                     and NOT EXISTS (
                         SELECT 1
                         FROM ware_batch_action wba
                         WHERE wba.ware_batch_id = wb.id
                           AND (wba.deleted = false OR wba.deleted IS NULL)
                           AND (COALESCE(wba.inserted, 0) > 0 OR COALESCE(wba.updated, 0) > 0)
                     ) 
                """);
            }
        }

        return jdbcTemplate.queryForObject(sql.toString(), Integer.class, params.toArray());
    }

    
    public List<WareBatchResponse> getWareBatches(DashboardRequest request) {
        StringBuilder sql = new StringBuilder(
                """
                    SELECT 
                        wb.id AS id,
                        wb.code AS code,
                        wt.table_code AS tableCode,
                        wt.table_name AS reportName,
                        wb.description AS description,
                        wb.s3_file_key AS s3_file_key,
                        wb.created_at AS created_at,
                        wb.updated_at AS updated_at,
                        wb.status AS wareBatchStatus,
                        wb.report_year AS report_year,
                        wb.report_month AS report_month,
                        wb.report_day AS report_day
                    FROM ware_batch wb
                    LEFT JOIN ware_template wt ON wb.ware_template_id = wt.id
                    LEFT JOIN ware_category wc ON wt.ware_category_id = wc.id
                    LEFT JOIN department d ON wc.department_id = d.id
                    WHERE wb.deleted = false
                """
        );
        List<Object> params = new ArrayList<>();
        if (request.getDepartmentId() != null) {
            sql.append(" and d.id = ? ");
            params.add(request.getDepartmentId());
        }

        if (request.getReportType() != null) {
            sql.append(" and wc.report_type = ? ");
            params.add(request.getReportType());
        }

        if (request.getReportYear() != null) {
            sql.append(" and wb.report_year = ? ");
            params.add(request.getReportYear());
        }

        if (request.getReportMonth() != null) {
            sql.append(" and wb.report_month = ? ");
            params.add(request.getReportMonth());
        }

        if (request.getReportDay() != null) {
            sql.append(" and wb.report_day = ? ");
            params.add(request.getReportDay());
        }
        System.out.println("SQL: " + sql);
        return jdbcTemplate.query(sql.toString(),
                params.toArray(),
                new BeanPropertyRowMapper<>(WareBatchResponse.class)
        );
    }
}
