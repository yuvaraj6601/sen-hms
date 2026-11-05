package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.masters.dto.InvestigationRequest;
import com.hms.masters.dto.InvestigationResponse;
import com.hms.masters.enums.Status;
import com.hms.masters.service.InvestigationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Lab Masters — dedicated controller for lab-specific investigations.
 *
 * Internally reuses InvestigationService (same entity) but:
 *   • Restricts category choices to lab categories
 *   • Exposes lab-specific dropdown seed endpoints
 *
 * Frontend menu : Masters → Lab Masters
 * Base path     : /api/masters/lab-masters
 */
@RestController
@RequestMapping("/masters/lab-masters")
@RequiredArgsConstructor
public class LabMasterController {

    // ── Static reference data ─────────────────────────────────────────────────

    private static final List<String> LAB_CATEGORIES = List.of(
            "Emergency", "Haematology", "Clinical Pathology", "Biochemistry",
            "Endocrinology", "Cardiology", "Microbiology", "Serology", "Molecular",
            "Urine", "Stool", "Histopathology", "Cytology", "Radiology", "Others"
    );

    /**
     * Default subcategories per category.
     * These are suggestions — the frontend also lets users type a custom subcategory
     * and saves it, which then appears via the /subcategories endpoint.
     */
    private static final Map<String, List<String>> SUBCATEGORY_MAP = Map.ofEntries(
            Map.entry("Emergency",       List.of("ABG", "Cardiac Markers")),
            Map.entry("Clinical Pathology", List.of("Urine", "Stool / Motion",
                                                  "Body Fluids", "Semen Analysis",
                                                  "CSF Analysis", "Pregnancy Test")),
            Map.entry("Biochemistry",    List.of("Liver Function", "Kidney Function",
                                                  "Lipid Profile", "Diabetes", "Electrolytes",
                                                  "Thyroid", "Cardiac Markers", "Iron Studies")),
            Map.entry("Haematology",     List.of("Complete Blood Count", "Coagulation",
                                                  "ESR", "Blood Group & Cross Match",
                                                  "Peripheral Smear", "Reticulocyte Count")),
            Map.entry("Endocrinology",   List.of("Thyroid Profile", "Adrenal", "Pituitary",
                                                  "Sex Hormones", "Pancreatic")),
            Map.entry("Cardiology",      List.of("Cardiac Enzymes", "Lipid Panel",
                                                  "Coagulation Screen", "BNP / NT-proBNP")),
            Map.entry("Microbiology",    List.of("Culture & Sensitivity", "Gram Stain",
                                                  "AFB", "Fungal", "Parasitology")),
            Map.entry("Serology",        List.of("Viral Markers", "Autoimmune", "Widal",
                                                  "VDRL / RPR", "Pregnancy Tests")),
            Map.entry("Molecular",       List.of("PCR", "RT-PCR", "Gene Expression",
                                                  "Sequencing")),
            Map.entry("Urine",           List.of("Routine & Microscopy", "24-Hour Urine",
                                                  "Urine Culture", "Dipstick")),
            Map.entry("Stool",           List.of("Routine Examination", "Stool Culture",
                                                  "Occult Blood", "H. pylori Antigen")),
            Map.entry("Histopathology",  List.of("Biopsy", "FNAC", "Frozen Section")),
            Map.entry("Cytology",        List.of("Pap Smear", "Sputum Cytology",
                                                  "Body Fluid Cytology")),
            Map.entry("Radiology",       List.of("X-Ray", "Ultrasound", "CT", "MRI", "Echo")),
            Map.entry("Others",          List.of("Miscellaneous"))
    );

    private static final List<String> SAMPLE_TYPES = List.of(
            "Blood", "Serum", "Plasma", "Urine", "Stool",
            "Swab", "Sputum", "CSF", "Tissue", "FNAC", "Other"
    );

    private static final List<String> CONTAINER_TYPES = List.of(
            "EDTA (Purple)", "Plain / SST (Red/Gold)", "Fluoride (Grey)",
            "Citrate (Blue)", "Heparin (Green)", "Urine Cup", "Sterile Container", "Other"
    );

    private static final List<String> RESULT_TYPES = List.of(
            "NUMERIC", "TEXT", "POSITIVE_NEGATIVE", "DROPDOWN", "CULTURE_SENSITIVITY"
    );

    private static final List<String> TAT_OPTIONS = List.of(
            "1 hour", "2 hours", "4 hours", "6 hours",
            "Same day", "24 hours", "48 hours", "72 hours", "1 week"
    );

    private final InvestigationService service;

    // ── Reference data endpoints ──────────────────────────────────────────────

    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<String>>> getCategories() {
        return ResponseEntity.ok(ApiResponse.ok(LAB_CATEGORIES));
    }

    /**
     * Returns default subcategories for a given category.
     * Also merges any custom subcategories already saved in the database.
     */
    @GetMapping("/subcategories")
    public ResponseEntity<ApiResponse<List<String>>> getSubcategories(
            @RequestParam(required = false) String category) {
        List<String> defaults = (category != null && SUBCATEGORY_MAP.containsKey(category))
                ? SUBCATEGORY_MAP.get(category)
                : List.of();

        List<String> fromDb = service.getDistinctSubcategories(category);

        // Merge: defaults first, then any DB values not already in defaults
        java.util.LinkedHashSet<String> merged = new java.util.LinkedHashSet<>(defaults);
        merged.addAll(fromDb);
        return ResponseEntity.ok(ApiResponse.ok(List.copyOf(merged)));
    }

    @GetMapping("/sample-types")
    public ResponseEntity<ApiResponse<List<String>>> getSampleTypes() {
        return ResponseEntity.ok(ApiResponse.ok(SAMPLE_TYPES));
    }

    @GetMapping("/container-types")
    public ResponseEntity<ApiResponse<List<String>>> getContainerTypes() {
        return ResponseEntity.ok(ApiResponse.ok(CONTAINER_TYPES));
    }

    @GetMapping("/result-types")
    public ResponseEntity<ApiResponse<List<String>>> getResultTypes() {
        return ResponseEntity.ok(ApiResponse.ok(RESULT_TYPES));
    }

    @GetMapping("/tat-options")
    public ResponseEntity<ApiResponse<List<String>>> getTatOptions() {
        return ResponseEntity.ok(ApiResponse.ok(TAT_OPTIONS));
    }

    @GetMapping("/distinct-units")
    public ResponseEntity<ApiResponse<List<String>>> getDistinctUnits() {
        return ResponseEntity.ok(ApiResponse.ok(service.getDistinctUnits()));
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<InvestigationResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String subcategory,
            @RequestParam(required = false) String sampleType,
            @RequestParam(required = false) Status status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("name"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.searchLabMasters(
                        search, category, subcategory, sampleType, status, pageable))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<InvestigationResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<InvestigationResponse>> create(
            @Valid @RequestBody InvestigationRequest req) {
        validateLabCategory(req.getCategory());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<InvestigationResponse>> update(
            @PathVariable Long id, @Valid @RequestBody InvestigationRequest req) {
        validateLabCategory(req.getCategory());
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<InvestigationResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void validateLabCategory(String category) {
        if (category != null && !LAB_CATEGORIES.contains(category)) {
            throw new IllegalArgumentException(
                    "Invalid lab category: " + category +
                    ". Valid categories: " + LAB_CATEGORIES);
        }
    }
}
