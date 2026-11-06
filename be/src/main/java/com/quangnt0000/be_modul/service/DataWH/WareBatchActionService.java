package com.quangnt0000.be_modul.service.DataWH;

import com.quangnt0000.be_modul.dto.PageResponse;
import com.quangnt0000.be_modul.dto.WareBatchAction.TimeCountDto;
import com.quangnt0000.be_modul.dto.WareBatchAction.WareBatchActionResponse;
import com.quangnt0000.be_modul.dto.WareBatchAction.WareBatchActionSearch;
import com.quangnt0000.be_modul.modal.DataWH.WareBatchAction;
import com.quangnt0000.be_modul.repository.DataWH.WareBatchActionJdbc;
import com.quangnt0000.be_modul.repository.DataWH.WareBatchActionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WareBatchActionService  {
    private final WareBatchActionRepository wareBatchActionRepository;
    private final WareBatchActionJdbc wareBatchActionJdbc;
    public ResponseEntity<?> search(WareBatchActionSearch request) {
        Sort sort = request.getSort().equals("ASC") ? Sort.by(request.getSortBy()).ascending() : Sort.by(request.getSortBy()).descending();
        Pageable pageable = PageRequest.of(request.getPage(), request.getLimit(), sort);
        Page<WareBatchAction> wareBatchActions = wareBatchActionRepository.search(request.getActionName(), request.getTableName(), pageable);
        List<WareBatchActionResponse> wareBatchActionResponses = wareBatchActions.getContent().stream()
                .map(
                        item -> WareBatchActionResponse.builder()
                                .id(item.getId())
                                .actionName(item.getActionName())
                                .tableName(item.getTableName())
                                .createdAt(item.getCreatedAt())
                                .deleted(item.getDeleted())
                                .requestId(item.getRequest().getRequestId())
                                .build()
                )
                .toList();
        PageResponse response = PageResponse.builder()
                .page(request.getPage())
                .limit(request.getLimit())
                .totalElements(wareBatchActions.getSize())
                .totalPages(wareBatchActions.getTotalPages())
                .content(wareBatchActionResponses)
                .build();
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<?> dashboard() {
        Map<String, Object> response = wareBatchActionJdbc.execute();
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<?> cntTime(String time) {
        List<TimeCountDto> result;

        switch (time.toUpperCase()) {
            case "DAY" -> result = wareBatchActionJdbc.countByDay();
            case "MONTH" -> result = wareBatchActionJdbc.countByMonth();
            case "YEAR" -> result = wareBatchActionJdbc.countByYear();
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "time must be DAY | MONTH | YEAR"
            );
        }

        return ResponseEntity.ok(result);
    }

    public ResponseEntity<?> topTable() {
        List<TimeCountDto> result = wareBatchActionJdbc.topTable();
        return ResponseEntity.ok(result);
    }
}
