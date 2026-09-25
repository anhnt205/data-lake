package com.quangnt0000.be_modul.service.DataWH;

import com.quangnt0000.be_modul.dto.TWH_Get.GetResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(name = "vinacomin-api", url = "https://Apidatabi.vinacomin.vn/")
public interface VinacominApiClient {

    @GetMapping("/v1/master-data")
    GetResponse getMasterData(
            @RequestParam("table") String table,

            @RequestParam("filters") String filters,

            @RequestParam(value = "columns", required = false) List<String> columns,
            @RequestParam(value = "order_by", required = false) List<String> orderBy,

            @RequestParam("limit") Integer limit,
            @RequestParam("offset") Integer offset,

            @RequestHeader("Authorization") String authorization
    );
}
