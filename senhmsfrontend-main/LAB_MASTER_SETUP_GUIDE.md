# Lab Master Setup Guide — SEN Hospital

This guide shows exactly what to fill in for each field when adding a test in **Masters → Lab Masters**.
8 real tests are documented, covering every result type the system supports.

---

## How Result Types Work

| Result Type | When to use | Entry at result time |
|---|---|---|
| **NUMERIC** | Single number (Blood Sugar, Creatinine) | Type the number |
| **TEXT** | Narrative / descriptive result (Smear Study, Urine Routine) | Multi-line textarea |
| **POSITIVE_NEGATIVE** | Yes/No tests (Pregnancy, HbsAg, Mantoux) | Type Positive / Negative |
| **DROPDOWN** | Fixed options (Blood Group: A+, B+, O+ ...) | Pick from dropdown |
| **CULTURE_SENSITIVITY** | C&S with antibiogram (Urine C&S, Blood C&S) | Organism + S/I/R grid |
| **Parameters grid** | Multi-parameter panels (CBC, LFT, Lipid Profile) | One row per parameter |

> The Parameters grid is not a result type — it works alongside any result type.
> Set result type to NUMERIC and add parameter rows for CBC, LFT, etc.

---

## Test 1 — Complete Blood Count (CBC)
**Type: Multi-parameter NUMERIC panel**

### Basic Tab
| Field | Value |
|---|---|
| Test Name | Complete Blood Count (CBC) |
| Category | Haematology |
| Price | ₹250 |
| Status | Active |

### Sample Tab
| Field | Value |
|---|---|
| Sample Type | Blood |
| Container | EDTA (Purple) |
| Sample Volume | 3 mL |
| Fasting Required | No — not required |

### Reporting Tab
| Field | Value |
|---|---|
| TAT | 1 hour |
| Result Type | NUMERIC |
| Unit | *(leave blank — each parameter has its own unit)* |
| Normal / Reference Range | *(leave blank — each parameter has its own range)* |
| Age-banded ranges | ☐ No |

**Parameters Grid** (add one row per parameter):

| Group | Sub-group | Parameter | Unit | Normal Range | ♂ Min | ♂ Max | ♀ Min | ♀ Max | Child Min | Child Max |
|---|---|---|---|---|---|---|---|---|---|---|
| HAEMATOLOGY | | HAEMOGLOBIN | g/dL | Male:14-16 / Female:12-15 | 14 | 16 | 12 | 15 | 11 | 14 |
| HAEMATOLOGY | | PCV | % | Male:40-45 / Female:35-45 | 40 | 45 | 35 | 45 | 36 | 42 |
| HAEMATOLOGY | | RBC COUNT | million/cumm | Male:4.5-5.5 / Female:3.8-4.8 | 4.5 | 5.5 | 3.8 | 4.8 | 3.5 | 5.0 |
| HAEMATOLOGY | | TOTAL COUNT (TC) | Cells/cumm | 4500-11000 | 4500 | 11000 | 4500 | 11000 | 5000 | 14500 |
| DIFFERENTIAL COUNT | | NEUTROPHILS | % | 40-75 | 40 | 75 | 40 | 75 | 40 | 75 |
| DIFFERENTIAL COUNT | | LYMPHOCYTES | % | 20-40 | 20 | 40 | 20 | 40 | 25 | 50 |
| DIFFERENTIAL COUNT | | EOSINOPHILS | % | 01-06 | 1 | 6 | 1 | 6 | 1 | 6 |
| DIFFERENTIAL COUNT | | MONOCYTES | % | 01-06 | 1 | 6 | 1 | 6 | 1 | 6 |
| HAEMATOLOGY | | MCV | fL | 80-100 | 80 | 100 | 80 | 100 | 70 | 90 |
| HAEMATOLOGY | | MCH | pg | 27-34 | 27 | 34 | 27 | 34 | 24 | 32 |
| HAEMATOLOGY | | MCHC | % | 32-36 | 32 | 36 | 32 | 36 | 30 | 36 |
| HAEMATOLOGY | | PLATELET COUNT | Lakhs/cumm | 1.5-4.5 | 1.5 | 4.5 | 1.5 | 4.5 | 1.5 | 4.5 |
| HAEMATOLOGY | | ESR (1/2 hr) | mm | 0-20 | 0 | 15 | 0 | 20 | 0 | 10 |

---

## Test 2 — Liver Function Test (LFT)
**Type: Multi-parameter NUMERIC panel**

### Basic Tab
| Field | Value |
|---|---|
| Test Name | Liver Function Test (LFT) |
| Category | Biochemistry |
| Price | ₹400 |

### Sample Tab
| Field | Value |
|---|---|
| Sample Type | Serum |
| Container | Plain / SST (Red/Gold) |
| Sample Volume | 3 mL |
| Fasting Required | No — not required |

### Reporting Tab
| Field | Value |
|---|---|
| TAT | 2 hours |
| Result Type | NUMERIC |

**Parameters Grid:**

| Group | Sub-group | Parameter | Unit | Normal Range | Nml Min | Nml Max |
|---|---|---|---|---|---|---|
| LIVER FUNCTION | | TOTAL BILIRUBIN | mg/dL | 0.2-1.2 | 0.2 | 1.2 |
| LIVER FUNCTION | | DIRECT BILIRUBIN | mg/dL | 0.0-0.4 | 0 | 0.4 |
| LIVER FUNCTION | | INDIRECT BILIRUBIN | mg/dL | 0.1-0.8 | 0.1 | 0.8 |
| LIVER FUNCTION | | SGOT (AST) | U/L | 10-40 | 10 | 40 |
| LIVER FUNCTION | | SGPT (ALT) | U/L | 7-56 | 7 | 56 |
| LIVER FUNCTION | | ALKALINE PHOSPHATASE | U/L | 44-147 | 44 | 147 |
| LIVER FUNCTION | | GAMMA GT | U/L | Male:11-50 / Female:7-32 | | |
| LIVER FUNCTION | | TOTAL PROTEINS | g/dL | 6.0-8.3 | 6.0 | 8.3 |
| LIVER FUNCTION | | ALBUMIN | g/dL | 3.5-5.0 | 3.5 | 5.0 |
| LIVER FUNCTION | | GLOBULIN | g/dL | 2.0-3.5 | 2.0 | 3.5 |
| LIVER FUNCTION | | A/G RATIO | | 1.0-2.5 | 1.0 | 2.5 |

---

## Test 3 — Blood Sugar Fasting
**Type: Single NUMERIC with critical values**

### Basic Tab
| Field | Value |
|---|---|
| Test Name | Blood Sugar Fasting |
| Category | Biochemistry |
| Price | ₹60 |

### Sample Tab
| Field | Value |
|---|---|
| Sample Type | Serum |
| Container | Fluoride (Grey) |
| Sample Volume | 2 mL |
| Fasting Required | Yes — fasting required |
| Patient Instructions | 8–12 hours fasting. Plain water allowed. No smoking. |

### Reporting Tab
| Field | Value |
|---|---|
| TAT | 1 hour |
| Result Type | NUMERIC |
| Unit | mg/dL |
| Normal / Reference Range | 70-110 |
| Normal Min | 70 |
| Normal Max | 110 |
| Critical Low | 50 |
| Critical High | 400 |
| Age-banded ranges | ☐ No |

---

## Test 4 — HbA1C
**Type: Single NUMERIC with multi-line interpretive range**

### Basic Tab
| Field | Value |
|---|---|
| Test Name | HbA1C |
| Category | Biochemistry |
| Price | ₹350 |

### Sample Tab
| Field | Value |
|---|---|
| Sample Type | Blood |
| Container | EDTA (Purple) |
| Sample Volume | 2 mL |
| Fasting Required | No — not required |
| Patient Instructions | No fasting required. Collect at any time. |

### Reporting Tab
| Field | Value |
|---|---|
| TAT | Same day |
| Result Type | NUMERIC |
| Unit | % |
| Age-banded ranges | ☐ No |
| Normal / Reference Range | *(type exactly as below — each line prints separately)* |

**Type this into the Normal Range textarea (press Enter between lines):**
```
Non Diabetic : 4.5 - 6.0
Good control : 6.1 - 7.0
Fair Control : 7.1 - 8.0
Poor Control : >= 8.0
```

> The system prints each line as a separate row in the Normal Values column,
> exactly as seen on the Apollo / SEN Hospital physical reports.

---

## Test 5 — NTproBNP
**Type: Single NUMERIC with age-banded ranges**

### Basic Tab
| Field | Value |
|---|---|
| Test Name | NTproBNP |
| Category | Cardiology |
| Price | ₹1800 |

### Sample Tab
| Field | Value |
|---|---|
| Sample Type | Serum |
| Container | Plain / SST (Red/Gold) |
| Sample Volume | 2 mL |

### Reporting Tab
| Field | Value |
|---|---|
| TAT | 4 hours |
| Result Type | NUMERIC |
| Unit | pg/ml |
| Age-banded ranges | ☑ **Yes — tick this checkbox** |

**Age Band Grid** (fill in after ticking the checkbox):

| From (yrs) | To (yrs) | Normal Range Text |
|---|---|---|
| 18 | 44 | < 115 pg/ml |
| 45 | 54 | < 172 pg/ml |
| 55 | 64 | < 263 pg/ml |
| 65 | 74 | < 349 pg/ml |
| 75 | *(leave blank = 75+)* | < 738 pg/ml |

> When entering a result, the system automatically shows the correct band for
> the patient's age and flags the result as abnormal if it exceeds the threshold.

---

## Test 6 — Blood Group & Rh Type
**Type: DROPDOWN**

### Basic Tab
| Field | Value |
|---|---|
| Test Name | Blood Group & Rh Type |
| Category | Haematology |
| Price | ₹80 |

### Sample Tab
| Field | Value |
|---|---|
| Sample Type | Blood |
| Container | EDTA (Purple) |
| Sample Volume | 2 mL |

### Reporting Tab
| Field | Value |
|---|---|
| TAT | 1 hour |
| Result Type | DROPDOWN |
| Dropdown Options | A Positive, A Negative, B Positive, B Negative, AB Positive, AB Negative, O Positive, O Negative |

> Type each option and press Enter or comma to add it to the tag list.

---

## Test 7 — Urine Routine & Microscopy
**Type: TEXT (multi-line narrative)**

### Basic Tab
| Field | Value |
|---|---|
| Test Name | Urine Routine & Microscopy |
| Category | Clinical Pathology |
| Price | ₹80 |

### Sample Tab
| Field | Value |
|---|---|
| Sample Type | Urine |
| Container | Urine Cup |
| Sample Volume | 10 mL (mid-stream) |
| Fasting Required | No — not required |
| Patient Instructions | Collect mid-stream urine in the sterile container provided. |

### Reporting Tab
| Field | Value |
|---|---|
| TAT | 1 hour |
| Result Type | TEXT |
| Normal / Reference Range | *(leave blank — narrative result)* |

> At result entry time, the lab tech types the full narrative in the auto-growing
> textarea, e.g.:
> ```
> Colour       : Yellow
> Appearance   : Clear
> Reaction (pH): 6.0
> Specific Gravity: 1.015
> Protein      : Nil
> Sugar        : Nil
> Ketones      : Nil
> RBC          : 0-2 / HPF
> Pus Cells    : 2-4 / HPF
> Epithelial Cells: Present
> Casts        : Nil
> ```
> Each line prints with pre-wrap formatting on the report.

---

## Test 8 — Urine Culture & Sensitivity
**Type: CULTURE_SENSITIVITY**

### Basic Tab
| Field | Value |
|---|---|
| Test Name | Urine Culture & Sensitivity |
| Category | Microbiology |
| Price | ₹350 |

### Sample Tab
| Field | Value |
|---|---|
| Sample Type | Urine |
| Container | Sterile Container |
| Sample Volume | 10 mL (mid-stream, first morning) |
| Fasting Required | No — not required |
| Patient Instructions | Collect first morning mid-stream urine in the sterile container. Do not contaminate. |
| Special Instructions | Process within 2 hours of collection. |

### Reporting Tab
| Field | Value |
|---|---|
| TAT | 48 hours |
| Result Type | **CULTURE_SENSITIVITY** |

### Parameters Grid — pre-configure the antibiotic panel
Add one row per antibiotic. The **Parameter name becomes the antibiotic name** in the S/I/R grid at result entry.

| Group | Sub-group | Parameter | Unit | Normal Range |
|---|---|---|---|---|
| ANTIBIOTICS | | Amoxicillin | | |
| ANTIBIOTICS | | Amoxicillin-Clavulanate | | |
| ANTIBIOTICS | | Ampicillin | | |
| ANTIBIOTICS | | Ciprofloxacin | | |
| ANTIBIOTICS | | Norfloxacin | | |
| ANTIBIOTICS | | Nitrofurantoin | | |
| ANTIBIOTICS | | Ceftriaxone | | |
| ANTIBIOTICS | | Cefuroxime | | |
| ANTIBIOTICS | | Gentamicin | | |
| ANTIBIOTICS | | Amikacin | | |
| ANTIBIOTICS | | Co-trimoxazole | | |
| ANTIBIOTICS | | Piperacillin-Tazobactam | | |
| ANTIBIOTICS | | Imipenem | | |
| ANTIBIOTICS | | Meropenem | | |

> At result entry time, the lab enters:
> - **Organism**: e.g. `E. coli`
> - **Colony Count**: e.g. `> 10⁵ CFU/mL`
> - **Gram Stain**: e.g. `Gram Negative Bacilli`
> - **S / I / R** toggle for each antibiotic
> - **Comment**: e.g. `ESBL producer suspected. Treat as per sensitivity.`
>
> The printed report shows a bordered antibiogram table with
> S in green, R in red, I in amber.

---

## Quick Reference — Which fields to fill for each result type

| Field | NUMERIC | TEXT | POS/NEG | DROPDOWN | C&S | Multi-param |
|---|---|---|---|---|---|---|
| Unit | ✅ | — | — | — | — | Per param |
| Normal Range (textarea) | ✅ | — | — | — | — | Per param |
| Age-banded checkbox | If needed | — | — | — | — | — |
| Critical Low / High | If needed | — | — | — | — | Per param |
| Dropdown Options | — | — | — | ✅ | — | — |
| Parameters Grid | Optional | — | — | — | Antibiotics | ✅ |

---

*Last updated: October 2026 · SEN Hospital HMS*
