import "dotenv/config";

import { populateProvisionalDepedReferenceCatalog } from "@/services/deped-reference-catalog.service";

const actorId = process.argv[2];

if (!actorId) {
  throw new Error("Usage: npx tsx scripts/populate-phase-20b-deped-catalog.ts <active-user-id>");
}

populateProvisionalDepedReferenceCatalog(actorId)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
