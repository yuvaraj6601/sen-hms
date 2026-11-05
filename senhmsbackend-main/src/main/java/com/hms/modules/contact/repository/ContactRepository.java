package com.hms.modules.contact.repository;

import com.hms.modules.contact.entity.Contact;
import com.hms.modules.contact.enums.ContactType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    @Query("""
        SELECT c FROM Contact c
        WHERE (:search IS NULL
               OR LOWER(c.name) LIKE LOWER(CONCAT('%',:search,'%'))
               OR c.phone LIKE CONCAT('%',:search,'%')
               OR LOWER(c.email) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(c.organization) LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:type IS NULL OR c.type = :type)
    """)
    Page<Contact> search(@Param("search") String search,
                         @Param("type") ContactType type,
                         Pageable pageable);
}
