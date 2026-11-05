package com.hms.masters.repository;

import com.hms.masters.entity.Bed;
import com.hms.masters.entity.Bed.BedStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BedRepository extends JpaRepository<Bed, Long> {

    List<Bed> findByWard_Id(Long wardId);
    List<Bed> findByWard_IdAndStatus(Long wardId, BedStatus status);
    boolean existsByNumberAndWard_Id(String number, Long wardId);
    int countByWard_IdAndStatus(Long wardId, BedStatus status);
}
