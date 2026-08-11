import type { getSubjectOfferingsAction } from "@/actions/subject-offering.action";

export type SubjectOfferingListItem = Awaited<
  ReturnType<typeof getSubjectOfferingsAction>
>["items"][number];
