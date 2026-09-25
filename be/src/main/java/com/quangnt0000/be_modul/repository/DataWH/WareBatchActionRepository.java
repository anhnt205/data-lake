package com.quangnt0000.be_modul.repository.DataWH;

import com.quangnt0000.be_modul.modal.DataLake.Department;
import com.quangnt0000.be_modul.modal.DataWH.WareBatchAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WareBatchActionRepository extends JpaRepository<WareBatchAction, Integer> {
    @Query("""
        SELECT wba
        FROM WareBatchAction wba
        WHERE
            LOWER(wba.actionName) LIKE LOWER(CONCAT('%', :actionName, '%'))
            AND LOWER(wba.tableName) LIKE LOWER(CONCAT('%', :tableName, '%'))
    """)
    Page<WareBatchAction> search(
            @Param("actionName") String actionName,
            @Param("tableName") String tableName,
            Pageable pageable
    );
    
    @Query("""
        SELECT CASE WHEN COUNT(wba) > 0 THEN true ELSE false END
        FROM WareBatchAction wba
        WHERE wba.wareBatch.id = :wareBatchId
          AND (wba.deleted = false OR wba.deleted IS NULL)
          AND (COALESCE(wba.inserted, 0) > 0 OR COALESCE(wba.updated, 0) > 0)
    """)
    boolean existsByWareBatchId(@Param("wareBatchId") Integer wareBatchId);

}
