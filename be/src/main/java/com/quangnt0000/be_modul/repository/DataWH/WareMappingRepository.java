package com.quangnt0000.be_modul.repository.DataWH;

import com.quangnt0000.be_modul.modal.DataWH.WareMapping;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WareMappingRepository extends JpaRepository<WareMapping, Integer> {
    List<WareMapping> findByWareTemplate_IdOrderByIdAsc(Integer wareTemplateId);

    List<WareMapping> findByWareTemplate_IdAndDeletedFalseOrderByIdAsc(Integer wareTemplateId);



    @Query("SELECT wm FROM WareMapping wm " +
            "WHERE wm.deleted = false " +
            "AND CAST(wm.fieldName AS string) LIKE CONCAT('%', :keyword, '%')" +
            "AND wm.wareTemplate.id = :wareTemplateId"
    )
    Page<WareMapping> search(@Param("keyword") String keyword,
                             @Param("wareTemplateId") Integer wareTemplateId,
                             Pageable pageable);
}
