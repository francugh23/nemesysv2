import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { findAcademicTermsByAcademicYear } from "../../repositories/academic-term.repository";
import { findAcademicYears } from "../../repositories/academic-year.repository";

test("2026-2027 contains the approved inclusive Academic Term calendar", async () => {
  const [academicYear] = await findAcademicYears(
    { search: "2026-2027" },
    { skip: 0, take: 1 },
    [{ label: "asc" }],
  );

  assert.ok(academicYear);

  const terms = await findAcademicTermsByAcademicYear(academicYear.id);

  assert.deepEqual(
    terms.map((term) => ({
      name: term.name,
      position: term.position,
      startDate: term.startDate.toISOString().slice(0, 10),
      endDate: term.endDate.toISOString().slice(0, 10),
    })),
    [
      {
        name: "Term 1",
        position: 1,
        startDate: "2026-06-08",
        endDate: "2026-09-15",
      },
      {
        name: "Term 2",
        position: 2,
        startDate: "2026-09-16",
        endDate: "2026-12-18",
      },
      {
        name: "Term 3",
        position: 3,
        startDate: "2027-01-04",
        endDate: "2027-04-08",
      },
    ],
  );
});
