ALTER TABLE "ShsTermResultRevision" RENAME CONSTRAINT "ShsTermResultRevision_actor_fkey" TO "ShsTermResultRevision_revisedById_fkey";
ALTER TABLE "ShsTermResultRevision" RENAME CONSTRAINT "ShsTermResultRevision_predecessor_fkey" TO "ShsTermResultRevision_predecessorRevisionId_fkey";
ALTER TABLE "ShsTermResultRevision" RENAME CONSTRAINT "ShsTermResultRevision_result_fkey" TO "ShsTermResultRevision_shsTermResultId_fkey";
ALTER INDEX "ShsTermResultRevision_result_sequence_idx" RENAME TO "ShsTermResultRevision_shsTermResultId_sequence_idx";
ALTER INDEX "ShsTermResultRevision_result_sequence_key" RENAME TO "ShsTermResultRevision_shsTermResultId_sequence_key";
