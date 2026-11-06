package com.quangnt0000.be_modul.service.Common;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.io.Serializable;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CommonService {
    public <REQ, ENTITY, ID extends Serializable> Map<ID, ENTITY> fetchEntityMap(
            List<REQ> requests,
            Function<REQ, ID> idExtractor,
            Function<Set<ID>, List<ENTITY>> entityFetcher,
            Function<ENTITY, ID> entityIdExtractor) {

        Set<ID> requestedIds = requests.stream()
                .map(idExtractor)
                .collect(Collectors.toSet());

        List<ENTITY> entities = entityFetcher.apply(requestedIds);

        Set<ID> foundIds = entities.stream()
                .map(entityIdExtractor)
                .collect(Collectors.toSet());

        requestedIds.removeAll(foundIds);

        if (!requestedIds.isEmpty()) {
            throw new EntityNotFoundException(
                    "Entities not found for ids: " + requestedIds
            );
        }

        return entities.stream()
                .collect(Collectors.toMap(entityIdExtractor, e -> e));
    }
}
