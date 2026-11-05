package com.hms.modules.contact.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.contact.dto.ContactRequest;
import com.hms.modules.contact.dto.ContactResponse;
import com.hms.modules.contact.enums.ContactType;
import com.hms.modules.contact.service.ContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService service;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<ContactResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ContactType type,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("name"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, type, pageable))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ContactResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ContactResponse>> create(
            @Valid @RequestBody ContactRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ContactResponse>> update(
            @PathVariable Long id, @Valid @RequestBody ContactRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Deleted successfully", null));
    }
}
