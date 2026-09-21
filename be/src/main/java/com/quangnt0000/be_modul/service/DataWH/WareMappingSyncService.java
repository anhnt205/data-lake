package com.quangnt0000.be_modul.service.DataWH;

import com.quangnt0000.be_modul.enums.DatabaseType;
import com.quangnt0000.be_modul.modal.Data.SyncConnectionConfig;
import com.quangnt0000.be_modul.modal.DataWH.WareMapping;
import com.quangnt0000.be_modul.modal.DataWH.WareTemplate;
import com.quangnt0000.be_modul.repository.SyncConnectionConfigRepository;
import com.quangnt0000.be_modul.repository.DataWH.WareMappingRepository;
import com.quangnt0000.be_modul.repository.DataWH.WareTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WareMappingSyncService {

    private final SyncConnectionConfigRepository syncConnectionConfigRepository;
    private final WareMappingRepository wareMappingRepository;
    private final WareTemplateRepository wareTemplateRepository;

    private static final Set<String> IGNORED_AUDIT_FIELDS = Set.of(
            "MODIFIED_BY", "CREATED_AT", "DATA_UPLOAD_ID",
            "MODIFIED_AT", "MAXDATE", "CREATED_BY", "SYNCDATE"
    );

    private static boolean isIgnoredField(String fieldName) {
        if (fieldName == null || fieldName.trim().isEmpty()) {
            return true;
        }
        String trimmed = fieldName.trim();
        return IGNORED_AUDIT_FIELDS.contains(trimmed.toUpperCase()) || "TYPE_DATA".equals(trimmed);
    }

    @Transactional
    public void syncMappings(WareTemplate template, String connectionId) {
        if (template == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Template cannot be null");
        }
        if (connectionId == null || connectionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Connection ID is empty, cannot synchronize mapping");
        }
        if (template.getTableCode() == null || template.getTableCode().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Template table code is empty, cannot synchronize mapping");
        }

        SyncConnectionConfig config = syncConnectionConfigRepository.findById(connectionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                        "Sync connection configuration not found with ID: " + connectionId));

        String driverClassName;
        String jdbcUrl;

        DatabaseType dbType = config.getDatabaseType();
        if (dbType == null) {
            dbType = DatabaseType.POSTGRESQL;
        }

        switch (dbType) {
            case POSTGRESQL:
                driverClassName = "org.postgresql.Driver";
                jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s", config.getHost(), config.getPort(), config.getDatabaseName());
                break;
            case MYSQL:
                driverClassName = "com.mysql.cj.jdbc.Driver";
                jdbcUrl = String.format("jdbc:mysql://%s:%d/%s?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true", 
                        config.getHost(), config.getPort(), config.getDatabaseName());
                break;
            case SQLSERVER:
                driverClassName = "com.microsoft.sqlserver.jdbc.SQLServerDriver";
                jdbcUrl = String.format("jdbc:sqlserver://%s:%d;databaseName=%s;encrypt=true;trustServerCertificate=true", 
                        config.getHost(), config.getPort(), config.getDatabaseName());
                break;
            case ORACLE:
                driverClassName = "oracle.jdbc.OracleDriver";
                jdbcUrl = String.format("jdbc:oracle:thin:@//%s:%d/%s", config.getHost(), config.getPort(), config.getDatabaseName());
                break;
            default:
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported database type: " + dbType);
        }

        log.info("Connecting to 3rd party DB: {} to sync template and mappings for table_code: {}", jdbcUrl, template.getTableCode());

        try {
            Class.forName(driverClassName);
            DriverManager.setLoginTimeout(config.getTimeoutSeconds() != null ? config.getTimeoutSeconds() : 10);
            
            try (Connection conn = DriverManager.getConnection(jdbcUrl, config.getUsername(), config.getPassword())) {
                // 1. Query remote template info
                String templateQuery = dbType == DatabaseType.POSTGRESQL 
                        ? "SELECT id, name, description, start_row, table_name, excel_file_key FROM public.ware_template WHERE table_code = ? AND deleted = false"
                        : "SELECT id, name, description, start_row, table_name, excel_file_key FROM ware_template WHERE table_code = ? AND deleted = false";

                Integer remoteTemplateId = null;
                try (PreparedStatement ps = conn.prepareStatement(templateQuery)) {
                    ps.setString(1, template.getTableCode());
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            remoteTemplateId = rs.getInt("id");
                            
                            // Update local template attributes
                            template.setName(rs.getString("name"));
                            template.setDescription(rs.getString("description"));
                            template.setStartRow(rs.getObject("start_row") != null ? rs.getInt("start_row") : template.getStartRow());
                            template.setTableName(rs.getString("table_name"));
                            template.setExcelFileKey(rs.getString("excel_file_key"));
                            wareTemplateRepository.save(template);
                            
                            log.info("Found remote template in 3rd party DB with remote ID: {} and updated local template metadata.", remoteTemplateId);
                        } else {
                            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                                    "No active template found in the 3rd-party database with table_code: " + template.getTableCode());
                        }
                    }
                }

                // 2. Query remote mappings
                List<RemoteMappingInfo> remoteMappings = new ArrayList<>();
                
                // Try full columns selection query first
                String fullMappingQuery = dbType == DatabaseType.POSTGRESQL
                        ? "SELECT cell_address, field_name, field_title, field_type, field_value, is_key_column, is_scop_filter, is_summable, role, aggregate_type FROM public.ware_mapping WHERE ware_template_id = ? AND deleted = false"
                        : "SELECT cell_address, field_name, field_title, field_type, field_value, is_key_column, is_scop_filter, is_summable, role, aggregate_type FROM ware_mapping WHERE ware_template_id = ? AND deleted = false";

                try (PreparedStatement ps = conn.prepareStatement(fullMappingQuery)) {
                    ps.setInt(1, remoteTemplateId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            remoteMappings.add(new RemoteMappingInfo(
                                    rs.getString("cell_address"),
                                    rs.getString("field_name"),
                                    rs.getString("field_title"),
                                    rs.getString("field_type"),
                                    rs.getString("field_value"),
                                    rs.getBoolean("is_key_column"),
                                    rs.getBoolean("is_scop_filter"),
                                    rs.getObject("is_summable") != null ? rs.getBoolean("is_summable") : false,
                                    rs.getString("role") != null ? rs.getString("role") : "DIMENSION",
                                    rs.getString("aggregate_type") != null ? rs.getString("aggregate_type") : "NONE"
                            ));
                        }
                    }
                } catch (SQLException e) {
                    log.warn("Failed to query mappings with all columns (possibly older schema version on 3rd-party DB). Retrying with basic columns fallback.", e);
                    
                    // Fallback to basic columns query
                    String basicMappingQuery = dbType == DatabaseType.POSTGRESQL
                            ? "SELECT cell_address, field_name, field_title, field_type, field_value, is_key_column, is_scop_filter FROM public.ware_mapping WHERE ware_template_id = ? AND deleted = false"
                            : "SELECT cell_address, field_name, field_title, field_type, field_value, is_key_column, is_scop_filter FROM ware_mapping WHERE ware_template_id = ? AND deleted = false";

                    remoteMappings.clear();
                    try (PreparedStatement ps = conn.prepareStatement(basicMappingQuery)) {
                        ps.setInt(1, remoteTemplateId);
                        try (ResultSet rs = ps.executeQuery()) {
                            while (rs.next()) {
                                remoteMappings.add(new RemoteMappingInfo(
                                        rs.getString("cell_address"),
                                        rs.getString("field_name"),
                                        rs.getString("field_title"),
                                        rs.getString("field_type"),
                                        rs.getString("field_value"),
                                        rs.getBoolean("is_key_column"),
                                        rs.getBoolean("is_scop_filter"),
                                        false,
                                        "DIMENSION",
                                        "NONE"
                                ));
                            }
                        }
                    }
                }

                // 3. Sync mappings into local DB
                List<WareMapping> localMappings = wareMappingRepository.findByWareTemplate_IdOrderByIdAsc(template.getId());
                Map<String, WareMapping> localMap = localMappings.stream()
                        .collect(Collectors.toMap(m -> m.getFieldName().toLowerCase(), m -> m, (a, b) -> a));

                List<WareMapping> toSave = new ArrayList<>();
                Set<String> remoteFields = new HashSet<>();

                for (RemoteMappingInfo remote : remoteMappings) {
                    if (remote.fieldName == null || remote.fieldName.isBlank()) continue;
                    
                    String fieldNameKey = remote.fieldName.toLowerCase();
                    remoteFields.add(fieldNameKey);

                    boolean isScope = Boolean.TRUE.equals(remote.isScopFilter) && !isIgnoredField(remote.fieldName);
                    boolean isKey = Boolean.TRUE.equals(remote.isKeyColumn) && !isIgnoredField(remote.fieldName);

                    WareMapping localMapping = localMap.get(fieldNameKey);
                    if (localMapping != null) {
                        // Update existing mapping
                        localMapping.setCellAddress(remote.cellAddress);
                        localMapping.setFieldName(remote.fieldName);
                        localMapping.setFieldTitle(remote.fieldTitle);
                        localMapping.setFieldType(remote.fieldType);
                        localMapping.setFieldValue(remote.fieldValue);
                        localMapping.setIsKeyColumn(isKey);
                        localMapping.setIsScopFilter(isScope);
                        localMapping.setIsSummable(remote.isSummable);
                        localMapping.setRole(remote.role);
                        localMapping.setAggregateType(remote.aggregateType);
                        localMapping.setDeleted(false);
                        toSave.add(localMapping);
                    } else {
                        // Create new mapping
                        localMapping = WareMapping.builder()
                                .cellAddress(remote.cellAddress)
                                .fieldName(remote.fieldName)
                                .fieldTitle(remote.fieldTitle)
                                .fieldType(remote.fieldType)
                                .fieldValue(remote.fieldValue)
                                .isKeyColumn(isKey)
                                .isScopFilter(isScope)
                                .isSummable(remote.isSummable)
                                .role(remote.role)
                                .aggregateType(remote.aggregateType)
                                .wareTemplate(template)
                                .deleted(false)
                                .build();
                        toSave.add(localMapping);
                    }
                }

                // Soft-delete local mappings that do not exist in remote mappings
                for (WareMapping local : localMappings) {
                    if (!remoteFields.contains(local.getFieldName().toLowerCase())) {
                        local.setDeleted(true);
                        toSave.add(local);
                    }
                }

                if (!toSave.isEmpty()) {
                    wareMappingRepository.saveAll(toSave);
                }
                
                log.info("Successfully synchronized {} mapping fields for template {}", remoteMappings.size(), template.getId());
            }
        } catch (ClassNotFoundException e) {
            log.error("JDBC Driver class not found: {}", driverClassName, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Required JDBC driver not available: " + driverClassName);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to sync mapping from 3rd party database", e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Database synchronization error: " + e.getMessage());
        }
    }

    @Transactional
    public void pushMappings(WareTemplate template, String connectionId) {
        if (template == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Template cannot be null");
        }
        if (connectionId == null || connectionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Connection ID is empty, cannot push mapping");
        }
        if (template.getTableCode() == null || template.getTableCode().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Template table code is empty, cannot push mapping");
        }

        SyncConnectionConfig config = syncConnectionConfigRepository.findById(connectionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                        "Sync connection configuration not found with ID: " + connectionId));

        String driverClassName;
        String jdbcUrl;

        DatabaseType dbType = config.getDatabaseType();
        if (dbType == null) {
            dbType = DatabaseType.POSTGRESQL;
        }

        switch (dbType) {
            case POSTGRESQL:
                driverClassName = "org.postgresql.Driver";
                jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s", config.getHost(), config.getPort(), config.getDatabaseName());
                break;
            case MYSQL:
                driverClassName = "com.mysql.cj.jdbc.Driver";
                jdbcUrl = String.format("jdbc:mysql://%s:%d/%s?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true", 
                        config.getHost(), config.getPort(), config.getDatabaseName());
                break;
            case SQLSERVER:
                driverClassName = "com.microsoft.sqlserver.jdbc.SQLServerDriver";
                jdbcUrl = String.format("jdbc:sqlserver://%s:%d;databaseName=%s;encrypt=true;trustServerCertificate=true", 
                        config.getHost(), config.getPort(), config.getDatabaseName());
                break;
            case ORACLE:
                driverClassName = "oracle.jdbc.OracleDriver";
                jdbcUrl = String.format("jdbc:oracle:thin:@//%s:%d/%s", config.getHost(), config.getPort(), config.getDatabaseName());
                break;
            default:
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported database type: " + dbType);
        }

        log.info("Connecting to 3rd party DB: {} to push template and mappings for table_code: {}", jdbcUrl, template.getTableCode());

        try {
            Class.forName(driverClassName);
            DriverManager.setLoginTimeout(config.getTimeoutSeconds() != null ? config.getTimeoutSeconds() : 10);
            
            try (Connection conn = DriverManager.getConnection(jdbcUrl, config.getUsername(), config.getPassword())) {
                conn.setAutoCommit(false);
                try {
                    // 1. Check if template exists on remote DB
                    String checkQuery = dbType == DatabaseType.POSTGRESQL
                            ? "SELECT id FROM public.ware_template WHERE table_code = ? AND deleted = false"
                            : "SELECT id FROM ware_template WHERE table_code = ? AND deleted = false";
                    
                    Integer remoteTemplateId = null;
                    try (PreparedStatement ps = conn.prepareStatement(checkQuery)) {
                        ps.setString(1, template.getTableCode());
                        try (ResultSet rs = ps.executeQuery()) {
                            if (rs.next()) {
                                remoteTemplateId = rs.getInt("id");
                            }
                        }
                    }

                    if (remoteTemplateId != null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                                "Biểu mẫu với mã bảng (table_code) '" + template.getTableCode() + "' đã tồn tại trên hệ thống trung tâm.");
                    }

                    // 2. Insert new template
                    String insertQuery = dbType == DatabaseType.POSTGRESQL
                            ? "INSERT INTO public.ware_template (code, name, description, start_row, table_name, table_code, excel_file_key, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, false, NOW(), NOW())"
                            : "INSERT INTO ware_template (code, name, description, start_row, table_name, table_code, excel_file_key, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";
                    
                    try (PreparedStatement ps = conn.prepareStatement(insertQuery, java.sql.Statement.RETURN_GENERATED_KEYS)) {
                        ps.setString(1, "new");
                        ps.setString(2, template.getName());
                        ps.setString(3, template.getDescription());
                        if (template.getStartRow() != null) {
                            ps.setInt(4, template.getStartRow());
                        } else {
                            ps.setNull(4, java.sql.Types.INTEGER);
                        }
                        ps.setString(5, template.getTableName());
                        ps.setString(6, template.getTableCode());
                        ps.setString(7, template.getExcelFileKey());
                        
                        ps.executeUpdate();
                        try (ResultSet rs = ps.getGeneratedKeys()) {
                            if (rs.next()) {
                                remoteTemplateId = rs.getInt(1);
                            } else {
                                throw new SQLException("Creating template failed, no ID obtained.");
                            }
                        }
                    }

                    // 3. Update the temporary "new" code
                    String updateCodeQuery = dbType == DatabaseType.POSTGRESQL
                            ? "UPDATE public.ware_template SET code = ? WHERE id = ?"
                            : "UPDATE ware_template SET code = ? WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(updateCodeQuery)) {
                        ps.setString(1, "W-TMP" + remoteTemplateId);
                        ps.setInt(2, remoteTemplateId);
                        ps.executeUpdate();
                    }

                    // 4. Get local mappings
                    List<WareMapping> localMappings = wareMappingRepository.findByWareTemplate_IdOrderByIdAsc(template.getId());

                    // 7. Insert mappings (Try full schema first, fall back to basic schema if it fails)
                    String fullMappingInsert = dbType == DatabaseType.POSTGRESQL
                            ? "INSERT INTO public.ware_mapping (cell_address, field_name, field_title, field_type, field_value, is_key_column, is_scop_filter, is_summable, role, aggregate_type, ware_template_id, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, NOW(), NOW())"
                            : "INSERT INTO ware_mapping (cell_address, field_name, field_title, field_type, field_value, is_key_column, is_scop_filter, is_summable, role, aggregate_type, ware_template_id, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";

                    java.sql.Savepoint mappingSavepoint = conn.setSavepoint("mapping_savepoint");
                    try (PreparedStatement ps = conn.prepareStatement(fullMappingInsert)) {
                        for (WareMapping m : localMappings) {
                            if (m.getDeleted() != null && m.getDeleted()) continue;
                            ps.setString(1, m.getCellAddress());
                            ps.setString(2, m.getFieldName());
                            ps.setString(3, m.getFieldTitle());
                            ps.setString(4, m.getFieldType() != null ? m.getFieldType() : "ROW");
                            ps.setString(5, m.getFieldValue());
                            ps.setBoolean(6, m.getIsKeyColumn() != null ? m.getIsKeyColumn() : false);
                            ps.setBoolean(7, m.getIsScopFilter() != null ? m.getIsScopFilter() : false);
                            ps.setBoolean(8, m.getIsSummable() != null ? m.getIsSummable() : false);
                            ps.setString(9, m.getRole() != null ? m.getRole() : "DIMENSION");
                            ps.setString(10, m.getAggregateType() != null ? m.getAggregateType() : "NONE");
                            ps.setInt(11, remoteTemplateId);
                            ps.addBatch();
                        }
                        ps.executeBatch();
                    } catch (SQLException e) {
                        log.warn("Failed to push mappings with all columns (possibly older schema version on 3rd-party DB). Rolling back to savepoint and retrying with basic columns fallback.", e);
                        try {
                            conn.rollback(mappingSavepoint);
                        } catch (SQLException rollbackEx) {
                            log.error("Failed to rollback mapping savepoint", rollbackEx);
                        }
                        
                        String basicMappingInsert = dbType == DatabaseType.POSTGRESQL
                                ? "INSERT INTO public.ware_mapping (cell_address, field_name, field_title, field_type, field_value, is_key_column, is_scop_filter, ware_template_id, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, NOW(), NOW())"
                                : "INSERT INTO ware_mapping (cell_address, field_name, field_title, field_type, field_value, is_key_column, is_scop_filter, ware_template_id, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";

                        try (PreparedStatement ps = conn.prepareStatement(basicMappingInsert)) {
                            for (WareMapping m : localMappings) {
                                if (m.getDeleted() != null && m.getDeleted()) continue;
                                ps.setString(1, m.getCellAddress());
                                ps.setString(2, m.getFieldName());
                                ps.setString(3, m.getFieldTitle());
                                ps.setString(4, m.getFieldType() != null ? m.getFieldType() : "ROW");
                                ps.setString(5, m.getFieldValue());
                                ps.setBoolean(6, m.getIsKeyColumn() != null ? m.getIsKeyColumn() : false);
                                ps.setBoolean(7, m.getIsScopFilter() != null ? m.getIsScopFilter() : false);
                                ps.setInt(8, remoteTemplateId);
                                ps.addBatch();
                            }
                            ps.executeBatch();
                        }
                    }

                    conn.commit();
                    log.info("Successfully pushed template and {} mapping fields to remote database", localMappings.size());
                } catch (Exception e) {
                    conn.rollback();
                    throw e;
                }
            }
        } catch (ClassNotFoundException e) {
            log.error("JDBC Driver class not found: {}", driverClassName, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Required JDBC driver not available: " + driverClassName);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to push mapping to 3rd party database", e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Database synchronization error: " + e.getMessage());
        }
    }


    private static class RemoteMappingInfo {
        private final String cellAddress;
        private final String fieldName;
        private final String fieldTitle;
        private final String fieldType;
        private final String fieldValue;
        private final boolean isKeyColumn;
        private final boolean isScopFilter;
        private final boolean isSummable;
        private final String role;
        private final String aggregateType;

        public RemoteMappingInfo(String cellAddress, String fieldName, String fieldTitle, String fieldType, 
                                 String fieldValue, boolean isKeyColumn, boolean isScopFilter, 
                                 boolean isSummable, String role, String aggregateType) {
            this.cellAddress = cellAddress;
            this.fieldName = fieldName;
            this.fieldTitle = fieldTitle;
            this.fieldType = fieldType;
            this.fieldValue = fieldValue;
            this.isKeyColumn = isKeyColumn;
            this.isScopFilter = isScopFilter;
            this.isSummable = isSummable;
            this.role = role;
            this.aggregateType = aggregateType;
        }
    }
}
