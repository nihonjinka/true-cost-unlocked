import { expect, it } from "vitest";
import { analyzeLocally, extractValuesFromText } from "@/lib/analyzeLocally";

it("resolves a numbered loan definition without duplicate principal choices", () => {
  const text = `LOAN AGREEMENT
1. Definitions
The "Loan" means $15,000 advanced by the Lender to the Borrower.
2. Repayment
The repayment term is 36 months. The fixed APR is 11.5%.
3. Charges
The origination fee is 3% of the Loan. A late fee of $25 applies after default.`;
  const extracted = extractValuesFromText(text);
  const result = analyzeLocally(text);
  expect(extracted.principalField).toMatchObject({ value: 15000, needsReview: false });
  expect(result.principal).toBe(15000);
  expect(result.rateField.value).toBe(11.5);
  expect(result.termField.value).toBe(36);
  expect(extracted.plausibilityConflicts).toEqual([]);
});
