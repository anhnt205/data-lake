package com.quangnt0000.be_modul.repository.DataLake;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
@SuppressWarnings("unused")
public class DepartmentJdbc {
    private final JdbcTemplate jdbcTemplate;


}
