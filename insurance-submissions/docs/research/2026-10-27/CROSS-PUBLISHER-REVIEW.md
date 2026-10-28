# Underwriting Desk — comparison of primary application sources

Reviewed 27 October 2026 (America/Toronto). Research only. No project code, database, deployment, prospects or external communications changed.

## Result and limits

The access problem is resolved for the two primary publishers used here. **Eighteen actual PDFs** were retrieved from Cansure's public application directory and Markel Canada's public resource directory, checked as PDFs, downloaded, and examined at the cited pages/fields. The source ledger includes direct links, form/edition information, physical page counts, SHA-256 hashes, and applicability cautions. A current public link demonstrates availability, not that the form is the edition accepted today for a particular Ontario risk.

The replacement **evidence-review matrix covers all 67 original question groups**. Forty-nine rows contain relevant field evidence from both publishers, often only for some subfields. Nine rows have no obtained primary-field evidence; the remaining rows have one-publisher or specialty evidence. These counts do not mean 49 universally required or fully validated questions. Each row states observed support, unresolved portions, and whether to keep, change or refer the proposal. No insurer acceptance or implementation is authorized.

The sources are **two publishers**, not eighteen separate insurers or independently verified market programs. Cansure publishes MGA/program applications. Markel's documents include Canada/Lloyd's wording, but the actual quoting capacity and current program must be confirmed. Most sources are generic Canadian rather than Ontario-only; M09 expressly concerns Ontario Building Code work but still needs current legal/program-use confirmation.

The evidence supports a useful common intake, conditional exposure modules and separate specialty packs. It does not support using every field from every application for every prospect.

## Source ledger summary

All links were accessed 27 October 2026. Full locators, file identity and limitations are in `cross-publisher-source-ledger.csv`.

| ID | Publisher / actual document | Printed edition or code | Important scope limitation |
|---|---|---|---|
| C01 | [Cansure — Commercial General Liability](https://cansure.com/wp-content/uploads/2021/09/Commercial-General-Liabililty-Application.pdf) | A022.1 (12/17) | Generic CGL; accepted current edition unconfirmed |
| C02 | [Cansure — Contractors Liability](https://cansure.com/wp-content/uploads/2021/09/Contractors-Liability-Application.pdf) | A028.1 (12/17) | Contractor-specific general questions |
| C03 | [Cansure — Commercial Property/Liability](https://cansure.com/wp-content/uploads/2021/09/Commercial-Property-Liabililty.pdf) | A023.1 (07/15) | Old edition still publicly linked |
| C04 | [Cansure — PROSURE Professionals](https://cansure.com/wp-content/uploads/2021/09/Professionals-Application.pdf) | A085.3 (04/21) | Generic professionals; incomplete text in some fields |
| C05 | [Cansure — Plumbing & HVAC Contractors](https://cansure.com/wp-content/uploads/2021/09/Plumbing-and-HVAC-Contractor-Application.pdf) | A157.2 (06/21) | Relevant trade supplement; do not generalize all its thresholds |
| C06 | [Cansure — Rented Dwelling](https://cansure.com/wp-content/uploads/2021/09/Rented-Dwelling-Application.pdf?ver=A094.2) | A094.2 (12/24) | Dwelling rental; not a complete mixed-commercial/large-habitational form |
| C07 | [Cansure — Short Term Rental Questionnaire](https://cansure.com/wp-content/uploads/2021/09/Short-Term-and-AirBNB-Rental-Questionnaire.pdf) | A181.1 (Mar 2026) | Personal/commercial context; inconsistent printed page numbering |
| C08 | [Cansure — Commercial Property Supplement](https://cansure.com/wp-content/uploads/2021/09/Commercial-Property-Supplement.pdf) | A025.1 (12/17) | Explicitly tied to an Inland Marine package application |
| C09 | [Cansure — Product Liability](https://cansure.com/wp-content/uploads/2021/09/Product-Liability-Application.pdf) | A083.1 (01/18) | Roles differ: manufacturer/importer/distributor/retailer |
| M01 | [Markel — Commercial (General) Liability](https://content.markel.com/api/public/content/commercial-general-liability-application) | COM-GL/COM-CGL; footer 103112 | **Explicitly says not to use for contracting or manufacturing** |
| M02 | [Markel — Contractors](https://content.markel.com/api/public/content/contractors-application) | CONTRACTORS; footer 103112 | Use its contractor fields instead of M01 for this comparison |
| M03 | [Markel — Contractors Equipment](https://content.markel.com/api/public/content/contractors-equipment-application) | CONTRACTORS EQUIP APP; footer 1O3112 | Equipment use/rental/transit hazards are conditional |
| M04 | [Markel — Errors and Omissions / Professional Liability](https://content.markel.com/api/public/content/errors-and-omissions-professional-liability-application) | MISCE&O APP; footer 1O3112 | Miscellaneous professions, not every regulated profession |
| M05 | [Markel — Property](https://content.markel.com/api/public/content/property-application) | PROPERTY.APP; footer 1O3112 | Restaurant/cooking section conditional; source-specific photos |
| M06 | [Markel — Property Program Statement of Values](https://content.markel.com/api/public/content/property-statement-of-values) | STATEMENT OF VALUES - PROP; footer 1O3112 | Stated-amount co-insurance program, not universal initial quote gate |
| M07 | [Markel — Property Managers Supplement](https://content.markel.com/api/public/content/supplemental-application-for-property-managers) | PROPERTY MGRS; footer 103112 | **An E&O supplement**, not a generic landlord-property application |
| M08 | [Markel — Architects and Engineers Professional Liability](https://content.markel.com/api/public/content/architects-and-engineers-professional-liability-insurance-application) | A&E APP; footer 103112 | Separate engineering/architecture/project/environmental sections |
| M09 | [Markel — Designers under Bill 124](https://content.markel.com/api/public/content/professional-liability-insurance-for-designers-under-bill-24-application) | 124-A&E-E; footer 103112 | PDF title says Bill 124 although URL slug says bill-24; Ontario Building Code-specific, current applicability unconfirmed |

The Markel footer code is recorded literally, **not decoded into a publication date**. No unambiguous edition date was found in these cited Markel forms. Cansure's `/2021/09/` URL directory is also not an edition date: the served rental documents print 2024/2026. Preserve actual printed metadata and flag uncertainty.

## Findings that materially change the proposed intake

### 1. Limited vehicle screening can belong in a CGL path; a full auto schedule does not follow automatically

C01 physical PDF p4 asks about employees regularly using their own vehicles for company business. M02 p4 Q19 and M01 p7 Q15 distinguish regular/occasional personal-car use and hired/contracted vehicle costs. C09 p7 Part11 asks similar ancillary-use information. These sections do not request full VIN or licence schedules.

**Recommendation:** keep G04 as a short sourced ancillary-exposure screen where that exposure/form is relevant. Explain its purpose to the broker. Do not interpret Yes as client instruction to purchase commercial auto or open detailed driver/VIN collection. Actual commercial-auto applications remain unvalidated in this pass.

### 2. Contractor professional duties need discovery even before E&O is selected

M02 p3 Q12 explicitly asks consultant work, design work, staff design qualifications and whether designers/consultants carry E&O. C05 pp2–3 asks detailed trade activities and specialist operations. Thus T05 is no longer merely an unsupported hypothetical screen.

**Recommendation:** ask what the contractor actually does, then let the broker confirm appropriate cover/referral. Do not automatically label a design exposure covered by CGL or E&O. M08/M09 illustrate why a specialist profession/role may need a different form.

### 3. Claims history must retain different scopes and periods

C01 p2 and C05 p4 use a five-year loss history. M04 p4 Q16a asks claims **ever** known against specified parties/predecessors; Q16b separately asks potential claims/circumstances, while Q17 uses five years for professional discipline. M02 p4 Q18 requests claims and possible incidents without specifying a five-year ceiling in that question.

**Recommendation:** do not use the app's general five-year claims prompt as the sole E&O/history screen. Each relevant period, party scope and known-circumstance question needs its source. No period should be invented where the obtained form does not state it. C04 p8 §5.3a is visibly incomplete in the published PDF; get a corrected/current copy before asserting its full wording.

### 4. Tenancy, insured interests, value basis and supporting evidence are different concepts

C01 p4 and M01 p3 Q8–9 distinguish owned/rented premises. C03 p4, M05 p3 Q6 and M06 p2 distinguish several interests and value categories. C04 p6 Part4 is expressly conditional on requesting property/BI; its p7 §4.4 describes rebuilding/replacement-cost amounts. M06 p1 separates ACV/replacement basis and records valuation date/preparer.

**Recommendation:** keep an address-linked interests table: building, contents, tenant improvements, stock, rental income/BI and relevant parties. A tenant contents request can need building-hazard facts without requiring the tenant to insure the building. None of the cited sections establishes a universal rule that every property risk needs an independent external appraisal. Do not confuse absent basis, pending report, a market-specific report requirement and broker-documented evidence.

M06 includes particular policy timing/co-insurance instructions; they must not become a universal client-submit or initial-quote rule.

### 5. Ordinary resale, import/private label and manufacturing are different product roles

C09 pp2–4, §1.5/1.9/2.3/3.1–3.2, identifies roles, imports, sales mix, packaging/labels, installation and territories. Its pp5–6 add product safety/testing/traceability/complaint information. M01 p1 explicitly excludes manufacturing from that general CGL application.

**Recommendation:** retain a short product-role screen and expand only relevant details. An ordinary retailer should not receive all manufacturer quality-control questions automatically. Online-sales, food, regulated-products and specialist retail packs still need dedicated validation. A general property/CGL comparison is not a complete retail-sector submission specification.

### 6. Owner-landlord, short-term rental operator and property manager for others require different branches

C06 p3 asks unit occupancy, owner proximity, inspection and tenancy information. C07 pp2–3 asks platforms, guest screening, management, services/events, rental income and licensing. M07 p1 Q2–5 and p2 Q6–12 is explicitly attached to an E&O application and asks management fees, owners, affiliated property, trust accounts, retained records and insurance responsibilities.

**Recommendation:** separate the roles. Do not impose property-manager professional-liability/trust-account questions on every individual landlord. Mixed-use/large-habitational risks, vacancy and renovation still need suitable specialist forms. C07's local-licensing/strata questions do not themselves prove Ontario legal requirements or eligibility.

### 7. Equipment needs separate values and use, not just one total

M03 p4 Q12 requests equipment age, model/serial, replacement cost and actual cash value; Q13 asks loss payees and whether the requested amount represents the whole schedule. Its pp2–3 asks special transport/use, leasing with/without operators and maintenance.

**Recommendation:** retain repeatable equipment records with explicit basis and conditional rental/transit/use follow-ups. Arithmetic reconciliation is a useful engineering check. A total or value/limit difference is not automatically evidence of unacceptable coverage; show the broker the discrepancy and the client's request. Theft/storage detail still needs a matched source rather than assumptions.

### 8. Source instructions affect required attachments and who supplies them

C05 pp2–3 requests particular contract examples; p4 requests available insurer loss reports. C07 p3 requests a completed CSIO application and risk photos alongside its questionnaire. M05 p4 specifies photos and broker-only comments; M07 p2 Q12 requests financial statements for the property-management E&O supplement.

**Recommendation:** maintain a source-specific request checklist with owner, status and purpose. A broker-only declaration does not become a client question. Publisher-specific attachment wording must not become a universal requirement for all classes. Preliminary client submission with explicit gaps remains separate from completing/signing a particular insurer application.

## What the replacement matrix means

`question-matrix-CROSS-PUBLISHER.csv` preserves the original IDs and adds exact source/page/field locators, observed support, second-publisher findings, recommendation, publisher-comparison status, and remaining gaps. Full requirement claims should never be generated from the source-ID count alone. A field can have partial evidence while some subfields remain unsupported.

- **Common pre-market candidates:** activities, company experience, revenue periods, workforce, locations, territories, requested terms, history and relevant contracts have support in appropriate forms from both publishers. The exact granularity and wording differ.
- **Exposure-triggered candidates:** actual contractor hazards/design/subcontracting, product roles, rental type, property interests and equipment use should branch from operations/selected coverage.
- **Carrier/program-specific overlays:** prescribed project-example counts, particular contract/photo attachments, preset limits, special-work wording, program value/co-insurance instructions and profession-specific supplements retain source/edition scope.
- **Product/broker judgment:** private invitations, typed Unknown, client partial submission, reminder preferences and task ownership are product requirements rather than insurer form fields. They still need safe design and appropriate broker review.

No whole group is removed solely because it did not appear in these forms. Unsupported detailed questions are referred for evidence, and inapplicable market-specific detail is removed from the universal client path. This avoids mistaking a limited search for proof that information is never needed.

## Remaining source gaps and broker-supplied materials

These gaps do not mean the forms are necessarily nonpublic. Ask for appropriately shareable broker copies if a portal or public access prevents retrieval.

1. **Current accepted Ontario editions/program instructions** for the specific markets Julian will use. Public directory links and footer codes do not settle this.
2. **Corrected Cansure professional application** where §5.3a and other lines are incomplete; do not reconstruct missing insurer wording.
3. **Actual commercial-auto and driver materials:** vehicle classes, field requirements, record/abstract periods, authorizations, nonstandard identifiers and liability/physical-damage branches. All seven auto groups remain unsourced by actual auto applications here.
4. **Profession-specific forms** for the intended first professional clients: accountants/bookkeepers, IT/MSP/software, management consultants, health/legal/financial services as applicable. A&E and property-management forms provide examples, not substitutes.
5. **Specialist property/BI:** appropriate mixed-use/large habitational, vacancy/renovation and full BI/dependency valuation worksheets. General sum-insured fields do not validate a calculation method.
6. **Product/retail specialties and customer-property cover:** relevant food/regulated-goods/import/private-label, bailee/care-custody-control and installation materials matched to actual operations.
7. **Any real portal-only submission checklist or unpublished program instructions**, only if the broker confirms they exist and can be shared. De-identified underwriter follow-up examples would help test whether the intake closes common information gaps.

No confidential client information or driver identifiers are needed for this source-validation work.

## First contractor CGL pack to validate

**Recommend Ontario HVAC service/repair, CGL-only, as the first evidence-led pack.** This revises the earlier painting proposal because an actual trade-specific plumbing/HVAC form is now available (C05), alongside C02 and M02 contractor forms. The recommendation is about available evidence and scope; it is not an eligibility/coverage determination.

Candidate core for broker validation:

1. U01–U11 common facts and terms, with U12 as the product's explicit unknown/gap register.
2. T01/T07/T08: actual service/trade and customer-sector mix, new work versus repair, licences/jurisdictions, projects and workforce/experience.
3. Short conditional screens for subcontractors, gas/boiler/refrigeration/specialty systems, rooftop/height/trenching, hazardous materials, hot work, design/consultants, snow removal and work outside the stated territory. Use C05/C02/M02 locators; do not generalize their thresholds or treat an unsupported activity as automatically acceptable.
4. G01–G02 requested CGL/tenant-liability terms and operational/premises context. G03 customer-property details remain a specific source gap. G04 can be a narrowly explained ancillary personal/hired-vehicle screen supported by M02 Q19; it does not open full auto schedules.
5. Source-specific contracts/loss records as broker tasks. Keep the client able to hand off with honest unknowns. Completing a later insurer declaration is a separate action.

Keep full commercial auto, property values, equipment schedules and E&O policy-continuity modules hidden unless those coverages are separately requested or a documented specialist follow-up warrants broker review. The pack needs current-edition confirmation, a licensed Ontario broker's question review, and scenario testing before implementation is proposed. Painting/decorating remains a later source-validation candidate; no painter-specific supplemental was established here.

## Research artifacts and next stage

- `Cross-Publisher-Underwriting-Review.xlsx`: the 67-row evidence-review matrix, 18-source ledger and review notes.
- `question-matrix-CROSS-PUBLISHER.csv`: machine-readable recommendations and field/page citations.
- `cross-publisher-source-ledger.csv`: publisher, title, code/edition status, URL, jurisdiction caution, access date and hashes.
- `Cross-Publisher-Research.zip`: the current report, workbook/CSVs and original source PDFs for verification.

No code change or deployment is requested or authorized by this report. Next review should approve a precise first pack/workflow scope, with the current-edition and specialist gaps visible. A later coding stage can use Sol High; the source decisions and broker review should be retained as versioned evidence rather than overwritten by implementation assumptions.
