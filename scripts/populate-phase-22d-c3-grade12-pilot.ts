import "dotenv/config";

import { populatePhase22dC3Grade12Pilot } from "@/services/phase-22d-c3-grade12-pilot.service";

const actorId = process.argv[2];

if (!actorId) {
  throw new Error("Usage: npx tsx scripts/populate-phase-22d-c3-grade12-pilot.ts <active-super-admin-id>");
}

populatePhase22dC3Grade12Pilot(actorId)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
