# Phase 21C: SSHS Curriculum Term Applicability

## Scope And Outcome

Phase 21C corrects the Phase 20B provisional DepEd SSHS catalog so active Subject Offerings exist only when official DepEd evidence establishes their exact applicability to the configured 2026-2027 three-Term Academic Year. It does not redesign SSHS, infer school scheduling, promote curriculum, or change student-selection semantics.

## Official Evidence

The approved evidence boundary remains:

- [DepEd DO 017, s. 2026: Strengthened Senior High School Curriculum](https://www.deped.gov.ph/wp-content/uploads/DO-017-s.-2026-%E2%80%93-Strengthened-Senior-High-School-Curriculum.pdf)
- [DepEd DM 012, s. 2026: Full Implementation of the Strengthened Senior High School Curriculum in SY 2026-2027](https://www.deped.gov.ph/wp-content/uploads/DM-12-s.-2026_Full-Implementation-of-the-Strengthened-Senior-High-School-Curriculum-in-School-Year-2026-2027.pdf)
- [DepEd DM 036, s. 2026: Pilot Implementation of SSHS for Grade 12 in SY 2026-2027](https://www.deped.gov.ph/wp-content/uploads/DM_s2026_036r-UPDATED.pdf)
- [DepEd Strengthened SHS Program curriculum-guide catalog](https://www.deped.gov.ph/strengthened-shs-program/)

The official catalog requires public schools to use the three-term calendar and publishes separate semestral and three-term guides. The three-term Budget of Work establishes these decisions:

- The six Grade 11 Core guides identify First, Second, and Third Term content. [Effective Communication](https://www.deped.gov.ph/wp-content/uploads/Effective-Communication-2.pdf) and [General Mathematics](https://www.deped.gov.ph/wp-content/uploads/General-Mathematics-2.pdf) are representative official guides with explicit three-Term sections.
- Grade 11 TechPro BOW guides state that each TechPro elective is completed within three terms when delivered in Grade 11. [Grade 11 Computer Systems Servicing](https://www.deped.gov.ph/wp-content/uploads/G11-Computer-Systems-Servicing.pdf) is the representative official guide.
- Grade 12 TechPro BOW guides state that each TechPro elective is completed within one term when delivered in Grade 12 and provide a singular Term Plan. [Grade 12 Computer Systems Servicing](https://www.deped.gov.ph/wp-content/uploads/G12-Computer-Systems-Servicing-1.pdf) is the representative official guide.
- No approved source assigns a universal Term 1, Term 2, or Term 3 to a Grade 12 TechPro elective. The one-Term duration is known, but its exact configured Term remains a school scheduling decision and is not inferred.
- Academic Elective references remain unresolved because their official guides do not establish one universal configured-Term assignment for this school.

## Source-To-Term Decisions

The exact catalog decisions are:

| Catalog group | Entries | Configured applicability |
| --- | ---: | --- |
| Grade 11 Core | 6 | Term 1, Term 2, and Term 3 |
| Grade 11 TechPro | 44 | Term 1, Term 2, and Term 3 |
| Grade 12 TechPro pilot | 44 | One Term; exact Term 1/2/3 unresolved |
| Grade 11 Academic Electives | 77 | Unresolved; no Offering |

The 44 unresolved Grade 12 TechPro subjects are:

- Aesthetic Services (Beauty Care); Caregiving (Adult Care); Caregiving (Child Care); Hairdressing Services
- Agricultural Crops Production; Agro-Entrepreneurship; Aquaculture; Fish Capture; Food Processing; Organic Agriculture Production; Poultry Production - Chicken; Ruminants Production; Swine Production
- Garments Artisanry; Handicrafts (Weaving)
- Driving and Automotive Servicing; Motorcycle and Small Engine Servicing
- Carpentry; Construction Operation; Manual Metal Arc Welding; Technical Drafting
- Animation; Illustration; Visual Graphic Design
- Bakery Operations; Events Management Services; Food and Beverage Operation; Hotel Operation - Front Office Services; Hotel Operation - Housekeeping Services; Kitchen Operations; Tourism Services
- Broadband Installation; Computer Programming (.NET Technology); Computer Programming (Java); Computer Programming (Oracle Database); Computer Systems Servicing; Contact Center Services
- Domestic Refrigeration and Air Conditioning Servicing; Electrical Installation and Maintenance; Electronic Products Assembly and Servicing; Photovoltaic Systems Installation
- Marine Engineering at the Support Level; Marine Transportation at the Support Level; Ships Catering Services

The live DepEd catalog also exposes four Grade 12 guides that were not part of the Phase 20B catalog: Automotive Servicing (Electrical Repair), Automotive Servicing (Engine and Chassis Repairs), Commercial Air Conditioning Installation and Servicing, and Mechatronics. Phase 21C does not expand the reference catalog; adding new Subjects requires a separately reviewed catalog update.

## Catalog Reconciliation

- `ONE_CONFIGURED_TERM_UNRESOLVED` records the known Grade 12 one-Term duration without inventing a Term ordinal.
- Grade 12 TechPro definitions remain provisional references and no longer request automatic Offering creation.
- Population reconciles stale reference applicability and exact Grade 11 Term sets idempotently.
- Only an unreferenced active provisional Grade 12 Offering matching the exact legacy Phase 20B signature is retired: catalog provenance and all three configured Terms.
- Retirement removes the unsupported Offering-Term joins and soft-archives the Offering while retaining its Subject, Academic Year, grade, snapshots, SSHS classification, cluster, provenance, and audit history.
- A school-configured one-Term provisional Offering does not match the legacy signature and is preserved for the existing approval workflow.
- `SCHOOL_APPROVED` Offerings and any Offering with Student Subject Enrollment history are never rewritten by catalog population. When their Terms would otherwise require reconciliation, they are reported as unresolved operational configuration.
- Catalog reconciliation and school approval lock the same Subject Offering row before re-reading its lifecycle, so approval cannot race Term replacement or retirement.
- Reference corrections and Offering retirement are audited in the same service-owned transaction.

Deployments apply the enum migration first, then run the actor-attributed idempotent reconciliation with `npx tsx scripts/reconcile-phase-21c-shs-term-applicability.ts <active-user-id>`. The data correction intentionally remains in the audited service instead of anonymous migration SQL.

The applied 2026-2027 reconciliation updated 44 Grade 12 references, archived 44 unreferenced provisional Grade 12 Offerings, removed 132 unsupported Offering-Term joins, and created 88 audit records. No operational conflicts existed.

## Student And JHS Safety

- Student selection still returns only active `SCHOOL_APPROVED` Offerings for the Enrollment Academic Year and grade.
- Submitted Terms must belong to the selected Offering, and the exact selected Terms are copied into immutable Student Subject Enrollment snapshots.
- Changed selections continue to preserve replaced history; catalog reconciliation does not rewrite active or replaced snapshots.
- PostgreSQL continues to block provisional Offering materialization.
- Grade 7-10 JHS Subjects, full-three-Term Offerings, and derivation remain unchanged.
- Legacy Semester behavior remains unchanged.

## UI

The existing provisional reference table now distinguishes **One term; exact configured Term unresolved** from **All configured terms** and **Not specified by DepEd**. No Curriculum table/form redesign or Academic Term selector correction was included.

## Verification

- Seven focused Phase 21C tests cover exact Grade 11 applicability, Grade 12 pilot applicability, unresolved entries, shared approval/reconciliation locking, exact-signature Grade 11 repair, safe legacy retirement, preservation of deliberate school configuration and approved history, idempotency, duplicate prevention, exact future Term copying, and provisional materialization blocking.
- The complete repository suite passes 130 tests with two pre-existing environment-guarded tests skipped.
- Targeted ESLint, `npx tsc --noEmit`, Prisma validation/generation/migration status, migration drift, `git diff --check`, and the production build pass.
- The read-only safety audit confirms unchanged hashes for 32 JHS Subjects, 32 JHS Offerings, 20 Student Subject Enrollments, 3 Enrollments, Grades, and Subject Assignments; zero student snapshot corruption, active Offering duplicates, Offering/Term Academic Year mismatches, or malformed SSHS contexts.
- Authenticated browser verification remains pending for the updated reference-table label.
