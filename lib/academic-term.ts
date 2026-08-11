export function hasThreeChronologicallyOrderedTerms(
  terms: ReadonlyArray<{ startDate: Date; endDate: Date }>,
) {
  return (
    terms.length === 3 &&
    terms.every(
      (term, index) =>
        index === 0 || terms[index - 1].endDate < term.startDate,
    )
  );
}
