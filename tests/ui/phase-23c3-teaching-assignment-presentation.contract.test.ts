import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

test("Teaching Assignment scope controls use human-readable selected labels and practical widths", async () => {
  const [page, matrix, form] = await Promise.all([
    read("app/(protected)/dashboard/assignments/page.tsx"),
    read(
      "app/(protected)/dashboard/assignments/components/assignment-matrix.tsx",
    ),
    read(
      "app/(protected)/dashboard/assignments/components/subject-assignment-form.tsx",
    ),
  ]);

  assert.match(page, /<SelectValue>\s*Grade \{gradeLevel\}\s*<\/SelectValue>/);
  assert.match(page, /selectedTerm\?\.name \?\? "Selected Term"/);
  assert.match(page, /className="w-full min-w-32"/);
  assert.match(page, /className="w-full min-w-48"/);
  assert.match(matrix, /className="w-full min-w-44 sm:w-52"/);
  assert.match(matrix, /className="w-full min-w-64 sm:w-80"/);
  assert.match(matrix, /All Teachers/);
  assert.match(matrix, /Unassigned/);
  assert.match(
    matrix,
    /bulkTeacher\s*\? teacherLabel\(bulkTeacher\)\s*:\s*"Choose Teacher"/,
  );
  assert.match(form, /employeeNumber\s*\?\s*`\$\{teacher\.employeeNumber\} ·/);
  assert.match(form, /label: `Grade \$\{section\.gradeLevel\} ·/);
  assert.match(form, /label: `\$\{scope\.subjectCode\} ·/);
  assert.doesNotMatch(page, /<select/);
  assert.doesNotMatch(matrix, /<select/);
});

test("Teaching Assignment matrix keeps actions contextual and secondary information compact", async () => {
  const matrix = await read(
    "app/(protected)/dashboard/assignments/components/assignment-matrix.tsx",
  );

  assert.match(matrix, /Coverage summary/);
  assert.match(matrix, /coverage\.protectedScopes > 0/);
  assert.match(matrix, /coverage\.startedUnassignedScopes > 0/);
  assert.match(
    matrix,
    /Matches \$\{matchingTerms\.map\(\(term\) => `T\$\{term\.academicTermPosition\}`\)/,
  );
  assert.match(matrix, /secondaryStatus/);
  assert.match(matrix, /Teacher Load \(informational\)/);
  assert.match(matrix, /Missing Coverage/);
  assert.match(
    matrix,
    /All displayed assignment scopes are covered|No missing assignment scopes for this displayed context/,
  );
  assert.match(matrix, /Copy source: \{copySource\.offering\.subjectCode\}/);
  assert.match(matrix, /max-h-\[90dvh\][\s\S]*flex-col overflow-hidden/);
  assert.match(matrix, /ScrollArea className="min-h-0 flex-1/);
});
