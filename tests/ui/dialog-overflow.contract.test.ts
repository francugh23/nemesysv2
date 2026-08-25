import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("shared dialog popups constrain their viewport and preserve Base UI ownership", () => {
  const dialog = source("components/ui/dialog.tsx");
  const alertDialog = source("components/ui/alert-dialog.tsx");

  assert.match(dialog, /DialogPrimitive\.Root/);
  assert.match(dialog, /DialogPrimitive\.Popup[\s\S]*min-h-0[\s\S]*max-h-\[calc\(100dvh-2rem\)\][\s\S]*overflow-y-auto/);
  assert.match(alertDialog, /AlertDialogPrimitive\.Root/);
  assert.match(alertDialog, /AlertDialogPrimitive\.Popup[\s\S]*min-h-0[\s\S]*max-h-\[calc\(100dvh-2rem\)\][\s\S]*overflow-y-auto/);
});

test("FormDialog keeps its header visible while its body can shrink and scroll", () => {
  const formDialog = source("components/common/dialogs/form-dialog.tsx");

  assert.match(formDialog, /flex min-h-0[\s\S]*max-h-\[90dvh\][\s\S]*flex-col overflow-hidden/);
  assert.match(formDialog, /DialogHeader className="shrink-0"/);
  assert.match(formDialog, /<div className="min-h-0 flex-1 overflow-y-auto">\{children\}<\/div>/);
});

test("representative structured dialogs retain bounded scroll regions", () => {
  for (const relativePath of [
    "app/(protected)/dashboard/enrollment/components/enrollment-view-dialog.tsx",
    "app/(protected)/dashboard/academic-years/components/academic-year-view-dialog.tsx",
  ]) {
    const dialog = source(relativePath);
    assert.match(dialog, /flex max-h-\[92(?:d)?vh\][\s\S]*flex-col overflow-hidden/);
    assert.match(dialog, /ScrollArea className="min-h-0 flex-1"/);
  }
});
