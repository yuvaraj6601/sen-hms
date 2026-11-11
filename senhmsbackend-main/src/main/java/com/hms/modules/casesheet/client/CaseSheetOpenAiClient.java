package com.hms.modules.casesheet.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hms.modules.casesheet.dto.CaseSheetDraftResponse;
import com.hms.modules.casesheet.dto.ObservationRequest;
import com.hms.modules.casesheet.dto.VitalSignRequest;
import com.hms.modules.casesheet.enums.ObservationType;
import com.hms.modules.casesheet.enums.RecordSource;
import com.hms.modules.prescription.client.OpenAiProperties;
import com.hms.modules.prescription.exception.OpenAiException;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Reads a scanned IP case sheet (history, examination, doctor's progress record,
 * vitals / I-O chart, nursing notes) with OpenAI vision. The API key is never logged.
 */
@Slf4j
public class CaseSheetOpenAiClient implements CaseSheetAiClient {

    /** Discharge-summary template — keys must stay exactly as the hospital format. */
    static final String DISCHARGE_TEMPLATE = """
            {"Patient Name":"","IP No":"","Age / Sex":"","UHID":"","Consultant":"","Icu Consultant":"",
             "Date of Admission":"","Time of Admission":"","Date of Discharge":"","Time of Discharge":"",
             "Drug Allergy":"","FINAL DIAGNOSIS":"","CHIEF COMPLAINTS":"","HISTORY OF PRESENT ILLNESS":"",
             "MEDICAL & PERSONAL HISTORY":{"Past Medical History":"","Surgical History":"","Personal & Family History":"","Allergies":""},
             "PHYSICAL EXAMINATION & VITAL SIGNS (At Admission)":{"General Condition":"",
               "Vital Signs":{"Blood Pressure (BP)":"","Pulse Rate (PR)":"","Respiratory Rate (RR)":"","SpO2":"","Capillary Blood Glucose (CBG)":""},
               "Systemic Examination":{"CVS":"","RS":"","Abdomen":"","CNS":""}},
             "INVESTIGATION":{
               "Hematology & Inflammatory Markers":{
                 "Complete Blood Count (CBC)":{"Hemoglobin":"","Total Leukocyte Count (TC)":"","Differential Count":"","Platelet Count":"","Smear Study":""},
                 "Inflammatory Marker":{"C-Reactive Protein (CRP)":""}},
               "Biochemistry & Renal/Liver Function Tests":{
                 "Blood Sugar & Renal Profile":{"Random Blood Sugar (RBS)":"","Blood Urea":"","Serum Creatinine":"","Lipid Profile":""},
                 "Liver Function Tests (LFT)":"",
                 "Serum Electrolytes & Blood Gas":{"Sodium (Na+)":"","Potassium (K+)":"","Chloride (Cl-)":"","Bicarbonate":"","Ionized Calcium":"","pH":""}},
               "Urine Complete Analysis":{"Physical Examination":"","Chemical Examination":"","Microscopic Examination":""},
               "Ultrasonogram (USG) Abdomen":{"Liver, Spleen, & Pancreas":"","Gallbladder":"","Kidneys":"","Urinary Bladder":"","Pelvis / Impression":""},
               "Electrocardiogram (ECG)":{"Rate & Rhythm":"","Intervals":"","Morphology":""}},
             "COMBINED DIAGNOSTIC IMPRESSION & LAB SUMMARY":"","HOSPITAL COURSE & CLINICAL PROGRESS":"",
             "TREATMENT GIVEN DURING HOSPITAL STAY":"","CONDITION AT DISCHARGE":"","DISCHARGE MEDICATIONS":"",
             "DISCHARGE ADVICE":{"Dietary & Hydration Guidelines":"","Medical & Chronic Disease Management":"","Personal & Urinary Hygiene":""},
             "FOLLOW-UP PLAN":{"Outpatient Clinic Review":"","Repeat Laboratory Testing":""},
             "RED FLAG WARNINGS":""}
            """;

    private static final String PAGE_PROMPT = """
            You transcribe ONE scanned page of a handwritten in-patient case sheet from Sen Hospital, Chennai.
            Work in three steps and reply with ONE JSON object only.

            STEP 1 — IDENTIFY THE PAGE. The printed title tells you the type:
              HISTORY | EXAMINATION | DOCTOR'S PROGRESS RECORD | VITALS CHART / I O CHART |
              IN PATIENT NURSING ASSESSMENT | NURSES REPORT | MEDICINE ORDER (drug chart, often scanned
              sideways — read it rotated) | LAB REPORT | OTHER.
            Read the printed header: DOA (date of admission) and patient name.

            STEP 2 — COUNT before you transcribe. For a VITALS CHART, count the time entries written in the
            "Date & Time" column (e.g. "7.00 am", "8.30 pm"). Each time = exactly one vitals row. A page usually
            holds 5-8 rows. Put that number in "timeRowsOnPage"; your "vitals" array MUST have that many rows
            from this chart.

            STEP 3 — TRANSCRIBE into this shape (empty arrays when the page holds no such data):
            {"pageType": string, "doa": "yyyy-MM-dd"|null, "timeRowsOnPage": int,
             "vitals": [ {"recordedAt": "yyyy-MM-ddTHH:mm", "pulse": int|null, "bloodPressure": "120/80"|null,
                 "respiratoryRate": int|null, "temperature": number|null, "drainage": string|null,
                 "bloodGlucose": number|null, "spo2": number|null, "aspiration": string|null,
                 "intake": string|null, "output": string|null, "remarks": string|null,
                 "weight": number|null, "height": number|null, "recordedBy": string|null} ],
             "observations": [ {"date": "yyyy-MM-dd", "time": "HH:mm", "doctorName": string,
                 "type": "ROUND|CONSULTATION|POST_OP|EMERGENCY|DISCHARGE_NOTE",
                 "chiefComplaint": string, "clinicalFindings": string|null,
                 "generalExamination": string|null, "systemicExamination": string|null,
                 "diagnosis": string, "plan": string|null, "advice": string|null, "notes": string|null} ],
             "medications": [ {"name": string, "dose": string|null, "route": string|null, "frequency": string|null} ]}

            VITALS CHART RULES (columns left → right: S.No | Date & Time | Pulse | BP | RR | Temp | DRAINAGE |
            CBG | SPO2 | ASPIRATION | INTAKE | OUTPUT | Remarks):
            - Read the table ROW BY ROW along the time entry; take each value from ITS column only — never shift
              a value into the neighbouring column.
            - Date: a date written in the Date & Time column ("15/10") applies to every row below it until the
              next date. Month and year come from the DOA. Times: "7.00 am" → "07:00", "12.30 pm" → "12:30",
              "12.00 am" → "00:00".
            - Numbers only, units stripped: pulse "92/mt" → 92, RR "22/mt" → 22, SpO2 "98%" → 98,
              temperature "97.6°F" → 97.6 (Fahrenheit; "N" or "afebrile" → null), CBG "417 mg/dl" → 417.
              BP as systolic/diastolic, e.g. "140/80".
            - intake / output: ONLY what is written in that row's INTAKE / OUTPUT cell, cleaned up
              ("Dinner taken + H2O 100 ml", "Urine passed 200 ml"). "+" alone means "continued" — use null.
              Handwriting that runs down across several rows belongs to the FIRST row it starts in — never
              copy the same text into the following rows. Output is almost always urine: read "Urine
              passed", not "wine"; common intake words: H2O / water, juice, NS, RL, DNS, milk, breakfast,
              lunch, dinner, Ryles tube (RT) feed.
            - TOTALS ARE NOT ROWS: an underlined subtotal (e.g. "700 ml") or a 24-hour summary
              ("24 hours I = 1450 ml, O = 1060 ml") goes in "remarks" of the row it is written beside, as
              "Total intake 700 ml" / "24-hr intake 1450 ml, output 1060 ml". Never create a row for it and
              never put it in intake / output.
            - recordedBy: the duty sister signing that shift (MORNING / AFTERNOON / NIGHT box), if legible.
            - The vital sets on HISTORY / EXAMINATION / NURSING ASSESSMENT pages (PR, BP, RR, SpO2, Temp, Ht, Wt,
              CBG) are ONE vitals row each, timed with the date / time written on that page.

            DOCTOR'S PROGRESS RECORD / HISTORY / EXAMINATION RULES:
            - One observation per dated note; the HISTORY + EXAMINATION sheets together are ONE observation
              of type CONSULTATION. "S/B Dr X", a signature or a seal gives doctorName.
            - chiefComplaint = "C/o" complaints; generalExamination = "O/E"; systemicExamination = "S/E"
              (CVS, RS, P/A, CNS); diagnosis = impression / provisional diagnosis (repeat the working diagnosis
              when none is written); advice = the ADVICE column; plan = plan of care.

            MEDICINE ORDER RULES: one entry per drug row, names copied exactly as written ("Inj. Emeset",
            "NS + MVI"); the history sheet's "Medication History" table counts too. Unclear names get "(?)".

            GENERAL: NURSES REPORT pages give no vitals, observations or medications — return empty arrays.
            Dates dd/mm/yy → yyyy-MM-dd ("26" → 2026); every date is on or after the DOA, normally within a few
            days — handwritten months are easy to misread ("10" as "06"), so trust the DOA's month and year.
            Copy what is written; illegible values get your best guess followed by "(?)" in text fields or null
            in number fields. Never invent values.
            """;

    private static final String DISCHARGE_PROMPT = """
            You are a senior consultant physician at Sen Hospital, Chennai, writing the final DISCHARGE SUMMARY
            for an in-patient. You receive (1) every page of the scanned, mostly handwritten case sheet as
            images and (2) EXTRACTED NOTES — observations and a vitals summary already transcribed from those
            pages. Use both; the images are the source of truth, the notes save you re-reading every row.

            OUTPUT: ONE JSON object that IS the discharge-summary template below — same keys, same nesting,
            same order, every value a string. Do not wrap it in another key, add keys or drop keys.

            HOW TO FILL EACH SECTION
            - Header (Patient Name, IP No, Age / Sex, UHID): from the printed page header ("68 Years / Female").
              Consultant: the signing doctor / seal (name with degrees). Icu Consultant: only if an ICU stay
              is documented, else "".
            - Date / Time of Admission: DOA in the header and the time on the history / examination sheet.
              Date / Time of Discharge: the discharge note, or the last dated entry in the case sheet.
            - Drug Allergy and Allergies: as written ("Nil" → "No known drug allergy").
            - FINAL DIAGNOSIS: the working / provisional diagnosis plus every known comorbidity, one line each.
            - CHIEF COMPLAINTS: each complaint with its duration.
            - HISTORY OF PRESENT ILLNESS: 3-5 sentences of clinical prose — age, sex, background illnesses,
              recent treatment, presenting symptoms and their course before admission.
            - MEDICAL & PERSONAL HISTORY: past medical (DM, HTN, CAD, asthma, cancers, current medicines),
              surgical (operations with years), personal & family history, allergies.
            - PHYSICAL EXAMINATION & VITAL SIGNS (At Admission): general condition (built, nourishment,
              consciousness, hydration, pallor, icterus, cyanosis, edema, lymph nodes); the FIRST recorded
              vitals with units ("180/100 mmHg", "130/min", "22/min", "99%", "mg/dL"); CVS, RS, abdomen, CNS.
            - INVESTIGATION: copy every lab / imaging / ECG value with units from lab reports in the pages.
              CBG readings go under Random Blood Sugar (RBS) with date and time. A test that is not in the
              case sheet stays "". NEVER invent a value.
            - COMBINED DIAGNOSTIC IMPRESSION & LAB SUMMARY: 1-3 sentences tying the findings together.
            - HOSPITAL COURSE & CLINICAL PROGRESS: day-by-day prose from the progress notes and nursing notes —
              specialist reviews, events, response to treatment, and the vitals trend (BP, pulse, SpO2,
              temperature ranges, CBG trend, intake / output) from admission to discharge.
            - TREATMENT GIVEN DURING HOSPITAL STAY: exactly the "Medications transcribed from the drug chart"
              list in EXTRACTED NOTES (plus any drug named in the progress notes), one per line with dose,
              route and frequency, names as written. Do NOT add any drug that is not in that list or on the
              pages — no "usual" drugs for the diagnosis (no PPI, anticoagulant, etc. unless written).
            - CONDITION AT DISCHARGE: consciousness, vitals, oral intake, ambulation on the last day.
            - DISCHARGE MEDICATIONS: as written in the discharge advice; if none is written, continue the
              patient's regular home medication (from the medication history) and say so.
            - DISCHARGE ADVICE, FOLLOW-UP PLAN, RED FLAG WARNINGS: specific to this patient's diagnoses
              (diabetic diet if diabetic, oncology follow-up for cancer, and so on) — practical, 1-3 lines each.

            STYLE: formal clinical English; expand abbreviations (K/C/O = known case of, C/o = complaints of,
            H/o = history of, S1S2+ = S1 S2 heard, BAE+ = bilateral air entry present, NFND = no focal
            neurological deficit, P/A = per abdomen). Dates dd/MM/yyyy with a 4-digit year ("14/10/2026"), times hh:mm AM/PM. Every narrative
            section must be filled when the case sheet holds anything relevant — only lab values may stay "".

            DISCHARGE-SUMMARY TEMPLATE:
            """ + DISCHARGE_TEMPLATE;

    /** Pages per extraction call — kept small so the model transcribes every row instead of summarising. */
    private static final int PAGES_PER_CALL = 1;
    private static final int PARALLEL_CALLS = 6;
    private static final float RENDER_DPI = 150f;

    private final RestClient http;
    private final OpenAiProperties props;
    private final ObjectMapper mapper = new ObjectMapper();

    public CaseSheetOpenAiClient(RestClient.Builder builder, OpenAiProperties props) {
        this.props = props;
        this.http = builder.baseUrl(props.baseUrl()).build();
    }

    @Override
    public CaseSheetDraftResponse extractCaseSheet(byte[] file, String filename, String contentType, LocalDate admissionDate) {
        if (props.apiKey() == null || props.apiKey().isBlank()) {
            throw new OpenAiException("OpenAI API key is not configured (set OPENAI_API_KEY)");
        }
        List<String> pages = toPageDataUris(file, contentType);
        log.info("[CASESHEET-AI] reading {} page(s) in chunks of {}", pages.size(), PAGES_PER_CALL);

        String anchor = " Take the month and year of every date from the DOA in the page header.";

        ExecutorService pool = Executors.newFixedThreadPool(PARALLEL_CALLS);
        try {
            List<Future<JsonNode>> chunks = new ArrayList<>();
            for (int i = 0; i < pages.size(); i += PAGES_PER_CALL) {
                List<String> slice = pages.subList(i, Math.min(i + PAGES_PER_CALL, pages.size()));
                String label = "Page " + (i + 1) + " of " + pages.size() + ". Follow the three steps." + anchor;
                chunks.add(pool.submit(() -> readPage(label, slice)));
            }

            CaseSheetDraftResponse draft = new CaseSheetDraftResponse();
            int failed = 0;
            Map<LocalDate, Integer> doaVotes = new java.util.HashMap<>();
            List<String> medications = new ArrayList<>();
            for (Future<JsonNode> f : chunks) {
                try {
                    JsonNode root = f.get();
                    LocalDate doa = date(text(root, "doa"));
                    if (doa != null) doaVotes.merge(doa, 1, Integer::sum);
                    root.path("observations").forEach(n -> draft.getObservations().add(toObservation(n)));
                    List<VitalSignRequest> pageRows = new ArrayList<>();
                    root.path("vitals").forEach(n -> pageRows.add(toVital(n)));
                    keepChronological(pageRows);
                    draft.getVitals().addAll(pageRows);
                    int expected = isVitalsChart(root) ? root.path("timeRowsOnPage").asInt(0) : 0;
                    if (expected > root.path("vitals").size()) {
                        log.warn("[CASESHEET-AI] {} page counted {} time rows but returned {} vitals",
                                text(root, "pageType"), expected, root.path("vitals").size());
                    }
                    root.path("medications").forEach(n -> {
                        String line = String.join(" ", java.util.stream.Stream.of(
                                text(n, "name"), text(n, "dose"), text(n, "route"), text(n, "frequency"))
                                .filter(java.util.Objects::nonNull).toList());
                        if (!line.isBlank() && !medications.contains(line)) medications.add(line);
                    });
                } catch (Exception ex) {
                    failed++;
                    log.warn("[CASESHEET-AI] a page chunk failed: {}", ex.getMessage());
                }
            }
            // DOA printed on the pages wins (majority vote); the app's admission date is the fallback.
            LocalDate docDoa = doaVotes.entrySet().stream().max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey).orElse(null);
            LocalDate anchorDate = docDoa != null ? docDoa : admissionDate;
            if (anchorDate != null) anchorDates(draft, anchorDate);
            dedupeAndSort(draft);

            // Discharge summary runs last so it can lean on what the page reads already transcribed.
            try {
                String context = "Write the discharge summary." + anchor + "\n\nEXTRACTED NOTES\n" + extractedNotes(draft)
                        + "\nMedications transcribed from the drug chart:\n" + (medications.isEmpty() ? "(none found)" : "- " + String.join("\n- ", medications));
                JsonNode ds = summaryNode(call(DISCHARGE_PROMPT, context, pages, 8000));
                if (ds == null) {
                    log.warn("[CASESHEET-AI] discharge summary reply had no template keys");
                } else {
                    draft.setDischargeSummary(fillTemplate((ObjectNode) ds));
                }
            } catch (Exception ex) {
                failed++;
                log.warn("[CASESHEET-AI] discharge summary call failed: {}", ex.getMessage());
            }
            if (failed == chunks.size() + 1) {
                throw new OpenAiException("Every case sheet read request failed");
            }
            log.info("[CASESHEET-AI] extracted observations={} vitals={} failedCalls={}",
                    draft.getObservations().size(), draft.getVitals().size(), failed);
            return draft;
        } finally {
            pool.shutdownNow();
        }
    }

    /**
     * A chart page is written top-to-bottom in time order. A row whose time goes backwards
     * (e.g. "12.30 pm" written after "11.00 pm") is past midnight — move it to the next day.
     */
    private static void keepChronological(List<VitalSignRequest> rows) {
        java.time.LocalDateTime prev = null;
        for (VitalSignRequest v : rows) {
            java.time.LocalDateTime t = v.getRecordedAt();
            if (t == null) continue;
            if (prev != null && t.isBefore(prev)) {
                java.time.LocalDateTime fixed = prev.toLocalDate().atTime(t.toLocalTime());
                if (fixed.isBefore(prev) && t.getHour() == 12) fixed = fixed.minusHours(12);   // "12.30 pm" meant 00:30
                if (fixed.isBefore(prev)) fixed = fixed.plusDays(1);
                v.setRecordedAt(fixed);
                t = fixed;
            }
            prev = t;
        }
    }

    /** Only a VITALS / I-O chart has countable time rows; times in notes or nurses' reports don't count. */
    private static boolean isVitalsChart(JsonNode root) {
        String type = text(root, "pageType");
        return type != null && type.toUpperCase().contains("VITAL");
    }

    /** One page read; if the model returns fewer vitals rows than it counted, ask once more for all of them. */
    private JsonNode readPage(String label, List<String> slice) {
        JsonNode root = call(PAGE_PROMPT, label, slice, 6000);
        int expected = isVitalsChart(root) ? root.path("timeRowsOnPage").asInt(0) : 0;
        int got = root.path("vitals").size();
        if (expected > got) {
            JsonNode retry = call(PAGE_PROMPT, label + " Last time you counted " + expected
                    + " time rows but returned only " + got + " vitals rows. Return ALL " + expected + " rows.", slice, 6000);
            if (retry.path("vitals").size() > got) return retry;
        }
        return root;
    }

    /** The model may return the template at the root or wrapped (e.g. {"dischargeSummary": {...}}). */
    private static JsonNode summaryNode(JsonNode root) {
        if (root == null || !root.isObject()) return null;
        if (root.has("FINAL DIAGNOSIS") || root.has("Patient Name")) return root;
        Iterator<JsonNode> it = root.elements();
        while (it.hasNext()) {
            JsonNode child = it.next();
            if (child.isObject() && (child.has("FINAL DIAGNOSIS") || child.has("Patient Name"))) return child;
        }
        return null;
    }

    /** Compact text of the transcribed observations + a vitals summary, handed to the discharge call. */
    private String extractedNotes(CaseSheetDraftResponse d) {
        StringBuilder sb = new StringBuilder("Observations (doctor's notes):\n");
        for (ObservationRequest o : d.getObservations()) {
            sb.append("- ").append(o.getDate()).append(' ').append(nz(o.getTime())).append(' ')
              .append(nz(o.getDoctorName())).append(" [").append(o.getType()).append("] C/o: ").append(nz(o.getChiefComplaint()))
              .append(" | O/E: ").append(nz(o.getGeneralExamination())).append(" | S/E: ").append(nz(o.getSystemicExamination()))
              .append(" | Dx: ").append(nz(o.getDiagnosis())).append(" | Plan: ").append(nz(o.getPlan()))
              .append(" | Advice: ").append(nz(o.getAdvice())).append(" | Notes: ").append(nz(o.getNotes())).append('\n');
        }
        List<VitalSignRequest> v = d.getVitals();
        sb.append("\nVitals: ").append(v.size()).append(" readings");
        if (!v.isEmpty()) {
            VitalSignRequest first = v.get(0), last = v.get(v.size() - 1);
            sb.append(" from ").append(first.getRecordedAt()).append(" to ").append(last.getRecordedAt()).append('\n')
              .append("First: ").append(vitalLine(first)).append('\n')
              .append("Last: ").append(vitalLine(last)).append('\n')
              .append(range("Pulse /min", v.stream().map(x -> x.getPulse() == null ? null : x.getPulse().doubleValue()).toList()))
              .append(range("RR /min", v.stream().map(x -> x.getRespiratoryRate() == null ? null : x.getRespiratoryRate().doubleValue()).toList()))
              .append(range("Temp F", v.stream().map(VitalSignRequest::getTemperature).toList()))
              .append(range("SpO2 %", v.stream().map(VitalSignRequest::getSpo2).toList()));
            sb.append("BP readings: ").append(String.join(", ", v.stream().map(VitalSignRequest::getBloodPressure)
                    .filter(java.util.Objects::nonNull).distinct().toList())).append('\n');
            for (VitalSignRequest x : v) {
                if (x.getBloodGlucose() != null) sb.append("CBG ").append(x.getBloodGlucose()).append(" mg/dL at ").append(x.getRecordedAt()).append('\n');
            }
            for (VitalSignRequest x : v) {
                if (x.getIntake() != null || x.getOutput() != null) {
                    sb.append("I/O ").append(x.getRecordedAt()).append(": in ").append(nz(x.getIntake()))
                      .append(" / out ").append(nz(x.getOutput())).append('\n');
                }
            }
        }
        return sb.toString();
    }

    private static String vitalLine(VitalSignRequest x) {
        return "BP " + nz(x.getBloodPressure()) + ", pulse " + x.getPulse() + ", RR " + x.getRespiratoryRate()
                + ", temp " + x.getTemperature() + " F, SpO2 " + x.getSpo2() + "%";
    }

    private static String range(String label, List<Double> values) {
        java.util.DoubleSummaryStatistics st = values.stream().filter(java.util.Objects::nonNull)
                .mapToDouble(Double::doubleValue).summaryStatistics();
        return st.getCount() == 0 ? "" : label + " range " + st.getMin() + "-" + st.getMax() + '\n';
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    /** PDF → one JPEG per page (scanned PDFs have no text layer); images pass through. */
    private List<String> toPageDataUris(byte[] file, String contentType) {
        if (!"application/pdf".equals(contentType)) {
            return List.of("data:" + contentType + ";base64," + Base64.getEncoder().encodeToString(file));
        }
        List<String> out = new ArrayList<>();
        try (PDDocument doc = Loader.loadPDF(file)) {
            PDFRenderer renderer = new PDFRenderer(doc);
            for (int i = 0; i < doc.getNumberOfPages(); i++) {
                BufferedImage img = renderer.renderImageWithDPI(i, RENDER_DPI, ImageType.RGB);
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                ImageIO.write(img, "jpg", bos);
                out.add("data:image/jpeg;base64," + Base64.getEncoder().encodeToString(bos.toByteArray()));
            }
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not open the PDF — is it a valid, unlocked file?");
        }
        if (out.isEmpty()) throw new IllegalArgumentException("The PDF has no pages");
        return out;
    }

    private JsonNode call(String system, String userText, List<String> images, int maxTokens) {
        List<Object> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", userText));
        for (String uri : images) {
            content.add(Map.of("type", "image_url", "image_url", Map.of("url", uri, "detail", "high")));
        }
        Map<String, Object> body = Map.of(
                "model", props.caseSheetModel(),
                "temperature", 0,
                "max_tokens", maxTokens,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", content)));
        String text;
        try {
            JsonNode res = http.post().uri("/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + props.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve().body(JsonNode.class);
            text = res == null ? null : res.path("choices").path(0).path("message").path("content").asText(null);
        } catch (RestClientException ex) {
            throw new OpenAiException("Case sheet request failed: " + ex.getMessage(), ex);
        }
        if (text == null || text.isBlank()) throw new OpenAiException("Case sheet read returned no content");
        try {
            JsonNode root = mapper.readTree(text);
            if (root == null || !root.isObject()) throw new OpenAiException("Model returned an unexpected shape");
            return root;
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new OpenAiException("Model returned invalid JSON", ex);
        }
    }

    private ObservationRequest toObservation(JsonNode n) {
        ObservationRequest o = new ObservationRequest();
        o.setDate(date(text(n, "date")));
        o.setTime(trim(text(n, "time"), 10));
        o.setDoctorName(trim(text(n, "doctorName"), 150));
        o.setType(obsType(text(n, "type")));
        o.setChiefComplaint(text(n, "chiefComplaint"));
        o.setClinicalFindings(text(n, "clinicalFindings"));
        o.setGeneralExamination(text(n, "generalExamination"));
        o.setSystemicExamination(text(n, "systemicExamination"));
        o.setDiagnosis(text(n, "diagnosis"));
        o.setPlan(text(n, "plan"));
        o.setAdvice(text(n, "advice"));
        o.setNotes(text(n, "notes"));
        o.setSource(RecordSource.AI_UPLOAD);
        return o;
    }

    private VitalSignRequest toVital(JsonNode n) {
        VitalSignRequest v = new VitalSignRequest();
        v.setRecordedAt(dateTime(text(n, "recordedAt")));
        v.setRecordedBy(trim(text(n, "recordedBy"), 150));
        v.setBloodPressure(trim(text(n, "bloodPressure"), 20));
        v.setPulse(intIn(n, "pulse", 0, 300));
        Double temp = num(n, "temperature");
        if (temp != null && temp < 45) temp = Math.round((temp * 9 / 5 + 32) * 10) / 10.0; // °C → °F
        v.setTemperature(temp != null && temp >= 90 && temp <= 115 ? temp : null);
        v.setSpo2(numIn(n, "spo2", 50, 100));
        v.setRespiratoryRate(intIn(n, "respiratoryRate", 0, 100));
        v.setWeight(numIn(n, "weight", 0, 500));
        v.setHeight(numIn(n, "height", 0, 300));
        v.setBloodGlucose(numIn(n, "bloodGlucose", 0, 2000));
        v.setDrainage(trim(text(n, "drainage"), 100));
        v.setAspiration(trim(text(n, "aspiration"), 100));
        v.setIntake(trim(text(n, "intake"), 255));
        v.setOutput(trim(text(n, "output"), 255));
        v.setRemarks(trim(text(n, "remarks"), 255));
        v.setSource(RecordSource.AI_UPLOAD);
        return v;
    }

    /**
     * Handwritten months are often misread (10 → 06). A stay is short, so any date outside
     * [admission − 1 day, admission + 60 days] keeps its day but takes the admission month / year
     * (next month when that day is already past).
     */
    private static void anchorDates(CaseSheetDraftResponse d, LocalDate adm) {
        for (ObservationRequest o : d.getObservations()) {
            if (o.getDate() != null) o.setDate(anchor(o.getDate(), adm));
        }
        for (VitalSignRequest v : d.getVitals()) {
            if (v.getRecordedAt() != null) {
                v.setRecordedAt(anchor(v.getRecordedAt().toLocalDate(), adm).atTime(v.getRecordedAt().toLocalTime()));
            }
        }
    }

    static LocalDate anchor(LocalDate date, LocalDate adm) {
        if (!date.isBefore(adm.minusDays(1)) && !date.isAfter(adm.plusDays(60))) return date;
        LocalDate first = adm.withDayOfMonth(1);
        for (int m = 0; m < 3; m++) {
            LocalDate month = first.plusMonths(m);
            if (date.getDayOfMonth() > month.lengthOfMonth()) continue;
            LocalDate candidate = month.withDayOfMonth(date.getDayOfMonth());
            if (!candidate.isBefore(adm.minusDays(1))) return candidate;
        }
        return date;
    }

    /**
     * A row with no vital value at all (e.g. "24 hour urine" / "I = 1450 ml") is an intake-output total,
     * not a reading — move its text into the previous row's remarks and drop it.
     */
    private static void foldTotalsRows(List<VitalSignRequest> vitals) {
        for (int i = vitals.size() - 1; i >= 0; i--) {
            VitalSignRequest v = vitals.get(i);
            boolean noReading = v.getPulse() == null && v.getBloodPressure() == null && v.getRespiratoryRate() == null
                    && v.getTemperature() == null && v.getSpo2() == null && v.getBloodGlucose() == null
                    && v.getWeight() == null && v.getHeight() == null;
            if (!noReading) continue;
            String text = String.join("; ", java.util.stream.Stream.of(
                    v.getIntake() == null ? null : "Intake " + v.getIntake(),
                    v.getOutput() == null ? null : "Output " + v.getOutput(),
                    v.getRemarks()).filter(java.util.Objects::nonNull).toList());
            if (i > 0 && !text.isBlank()) {
                VitalSignRequest prev = vitals.get(i - 1);
                String merged = prev.getRemarks() == null ? text : prev.getRemarks() + "; " + text;
                prev.setRemarks(trim(merged, 255));
            }
            vitals.remove(i);
        }
    }

    /** Scans often repeat a chart page — drop exact repeats and order chronologically. */
    private static void dedupeAndSort(CaseSheetDraftResponse d) {
        Set<String> seen = new HashSet<>();
        d.getVitals().removeIf(v -> !seen.add(v.getRecordedAt() + "|" + v.getBloodPressure() + "|" + v.getPulse()
                + "|" + v.getTemperature() + "|" + v.getSpo2()));
        d.getVitals().sort(Comparator.comparing(VitalSignRequest::getRecordedAt,
                Comparator.nullsLast(Comparator.naturalOrder())));
        foldTotalsRows(d.getVitals());
        Set<String> seenObs = new HashSet<>();
        d.getObservations().removeIf(o -> !seenObs.add(o.getDate() + "|" + o.getTime() + "|" + o.getChiefComplaint()));
        d.getObservations().sort(Comparator.comparing(ObservationRequest::getDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(ObservationRequest::getTime, Comparator.nullsLast(Comparator.naturalOrder())));
    }

    /** Guarantees every template key exists (model may drop some), keeping template order. */
    private JsonNode fillTemplate(ObjectNode fromModel) {
        try {
            ObjectNode template = (ObjectNode) mapper.readTree(DISCHARGE_TEMPLATE);
            merge(template, fromModel);
            return template;
        } catch (Exception ex) {
            return fromModel;
        }
    }

    private static void merge(ObjectNode target, JsonNode src) {
        Iterator<String> keys = target.fieldNames();
        List<String> names = new ArrayList<>();
        keys.forEachRemaining(names::add);
        for (String k : names) {
            JsonNode t = target.get(k);
            JsonNode s = src.get(k);
            if (s == null || s.isNull()) continue;
            if (t.isObject() && s.isObject()) merge((ObjectNode) t, s);
            else if (!t.isObject()) target.put(k, s.isTextual() ? s.asText() : s.toString());
        }
    }

    private static ObservationType obsType(String v) {
        if (v == null) return ObservationType.ROUND;
        try {
            return ObservationType.valueOf(v.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return ObservationType.ROUND;
        }
    }

    private static LocalDate date(String v) {
        try {
            return v == null ? null : LocalDate.parse(v.trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private static LocalDateTime dateTime(String v) {
        if (v == null) return null;
        try {
            return LocalDateTime.parse(v.trim().length() == 16 ? v.trim() + ":00" : v.trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private static Double num(JsonNode n, String f) {
        JsonNode v = n.get(f);
        if (v == null || v.isNull()) return null;
        if (v.isNumber()) return v.asDouble();
        String s = v.asText().replaceAll("[^0-9.]", "");
        try {
            return s.isEmpty() ? null : Double.parseDouble(s);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Double numIn(JsonNode n, String f, double min, double max) {
        Double d = num(n, f);
        return d != null && d >= min && d <= max ? d : null;
    }

    private static Integer intIn(JsonNode n, String f, int min, int max) {
        Double d = numIn(n, f, min, max);
        return d == null ? null : (int) Math.round(d);
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull()) return null;
        String s = v.asText().trim();
        return s.isEmpty() ? null : s;
    }

    private static String trim(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
