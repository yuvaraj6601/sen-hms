package com.hms.modules.settings.repository;

import com.hms.modules.settings.entity.HospitalSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface HospitalSettingsRepository extends JpaRepository<HospitalSettings, Long> {

    /** Always returns the first (and only) settings record. */
    @Query("SELECT s FROM HospitalSettings s ORDER BY s.id ASC LIMIT 1")
    Optional<HospitalSettings> findFirst();
}
