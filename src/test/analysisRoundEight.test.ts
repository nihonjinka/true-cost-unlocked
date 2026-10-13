import { describe, expect, it } from "vitest";
import { analyzeLocally } from "@/lib/analyzeLocally";
import { classifyPolarity, collectRuleFindings, detectCostsGeneric, extractRateCandidates, segmentClauses } from "@/lib/analysisEngine";
import type { DocumentType } from "@/lib/analysisContext";

const catalogFindings = (text: string) => collectRuleFindings(text, [], "unknown" as DocumentType, [], false);

describe("Round 8: legal clause segmentation and concept slots", () => {
  it.each([
    ["7. Late Charge. The borrower owes 5.25% of the installment after a missed due date.", "5.25%"],
    ["(b) Fees: The charge is 2.75% of principal; the U.S. lender may collect it at signing.", "2.75%"],
    ["Section 7.2.1 Repossession. The creditor may retake secured goods without prior notice.", "without prior notice"],
  ])("keeps a full clause across headings, abbreviations and decimals", (text, key) => {
    const clauses = segmentClauses(text);
    expect(clauses.some((clause) => clause.text.includes(key))).toBe(true);
    expect(clauses.every((clause) => !/^\s*(?:\d+(?:\.\d+)*[.)]|\([a-z]\))/i.test(clause.text))).toBe(true);
  });

  const concepts: Array<{ category: string; variants: string[] }> = [
    { category: "collateral_recovery", variants: [
      "After default, the lender may seize the vehicle without first notifying the borrower.",
      "The creditor can take possession of secured property without advance warning after a breach.",
      "Upon nonpayment, the finance company may retake collateral with no prior notice to the customer.",
    ] },
    { category: "balloon_risk", variants: [
      "At maturity, the lender has no duty to refinance the remaining balance.",
      "The creditor is not required to extend the loan when the final amount comes due.",
      "The provider is under no obligation to renew or replace the facility at its end date.",
    ] },
    { category: "renewal_rollover", variants: [
      "On renewal, the outstanding principal remains unchanged.",
      "A rollover extends the debt without lowering the amount borrowed.",
      "When extended, the loan balance does not decrease.",
    ] },
    { category: "cross_default", variants: [
      "A breach of another agreement constitutes default under this facility.",
      "Failure to pay a separate loan is an event of default here.",
      "Any default under another account may trigger remedies in this contract.",
    ] },
    { category: "acceleration", variants: [
      "After an event of default, the lender may accelerate all amounts owing.",
      "Following breach, the remaining balance becomes immediately due.",
      "The creditor may declare the full amount payable at once after nonpayment.",
    ] },
  ];
  for (const concept of concepts) {
    it.each(concept.variants)(`detects ${concept.category} by its concept slots: %s`, (text) => {
      expect(catalogFindings(text).some((finding) => finding.category === concept.category)).toBe(true);
    });
  }
});

describe("Round 8: scoped polarity and conditional exclusions", () => {
  it.each([
    ["No annual fee applies to the account.", "annual fee", "negated"],
    ["There is no charge for paying the balance early.", "charge", "negated"],
    ["The lender may seize collateral without notice if a payment is missed.", "seize", "conditional"],
  ] as const)("classifies the concept's local polarity", (text, target, expected) => {
    const start = text.toLowerCase().indexOf(target);
    expect(classifyPolarity(text, start, start + target.length)).toBe(expected);
  });

  it.each([
    "No annual charge applies during the first year; a $90 annual charge applies afterward.",
    "The yearly fee is waived for 12 months, then a $75 fee is due each year.",
    "For the first 24 months there is no account fee; beginning in month 25 the fee is $60 annually.",
  ])("keeps a later fee as a conditional term: %s", (text) => {
    const result = analyzeLocally(text);
    expect(result.findings.some((finding) => finding.category === "conditional_term")).toBe(true);
  });
});

describe("Round 8: payment schedules and stated disclosures", () => {
  it.each([
    { text: "Installment loan. Principal: $8,000. Thirty-five monthly payments of $133.33 are followed by one final payment of $8,133.33. Total of payments: $12,799.88.", count: 36, total: 12799.88 },
    { text: "Loan amount: $9,000. Eleven interest-only monthly payments of $90 are followed by one balloon payment of $9,090 at maturity.", count: 12, total: 10080 },
    { text: "Short-term loan. Principal advanced: $4,000. One payment of $4,200 is due after 90 days.", count: 1, total: 4200 },
  ])("extracts segment amounts and count quantities", ({ text, count, total }) => {
    const result = analyzeLocally(text);
    expect(result.installmentSchedule?.count).toBe(count);
    expect(result.installmentSchedule?.total).toBeCloseTo(total, 2);
  });

  it("uses the stated single-payment total for the net-proceeds APR and flags schedule disagreement", () => {
    const result = analyzeLocally("Short-term loan. Principal: $1,000. One payment of $1,100 is due after 30 days. Total of payments: $1,200.");
    expect(result.installmentSchedule?.total).toBe(1100);
    expect(result.installmentSchedule?.statedTotal).toBe(1200);
    expect(result.installmentSchedule?.totalMatchesStated).toBe(false);
    expect(result.effectiveAPR).toBeCloseTo(((1200 - 1000) / 1000) * (365 / 30) * 100, 6);
    expect(result.findings.some((finding) => finding.id === "stated_schedule_total_mismatch")).toBe(true);
  });

  it.each([
    "The facility has 36 monthly installments; principal is $10,000.",
    "A balance of $7,500 is repaid in 24 monthly payments.",
    "There are 18 payments per year and the loan amount is $6,000.",
  ])("never treats a count as payment money: %s", (text) => {
    const result = analyzeLocally(text);
    expect(result.statedEMI.value).toBeNull();
    expect(result.installmentSchedule).toBeNull();
  });

  it.each([
    "Disclosure: Principal $8,000; APR 8%; term 24 months; payment $400; total $9,600.",
    "The amount financed is $12,000. Annual percentage rate: 9%. Repayment term: 36 months. The stated installment is $500; total of payments: $18,000.",
    "Principal: $5,000. Interest rate: 6%. Term: 12 months. Monthly payment: $450. Total of payments: $5,600.",
  ])("retains mismatches between stated and modeled figures", (text) => {
    const result = analyzeLocally(text);
    expect(result.findings.some((finding) => finding.category === "mismatch"), JSON.stringify({ principal: result.principal, rate: result.rateField.value, term: result.termField.value, payment: result.statedEMI.value, schedule: result.installmentSchedule, total: result.totalPayment, findings: result.findings.map((finding) => [finding.category, finding.label, finding.explanation]) })).toBe(true);
  });

  it.each([
    "Adjustable-rate mortgage. Principal: 200000. Initial APR: 4%. The rate adjusts after 60 months. First adjustment is capped at 2%; lifetime cap is 6%. Term: 360 months.",
    "Home loan. Amount financed: 180000. Starting APR: 3.5%. At 60 months the rate resets. Initial adjustment limit: 1.5%; maximum lifetime rate cap: 5.5%. Repayment term: 360 months.",
    "Mortgage note. Loan amount: 240000. Initial rate: 5%. The first adjustment occurs after 48 months, with an initial increase cap of 2% and a lifetime rate cap of 7%. Term: 240 months.",
  ])("models the capped first reset on the remaining balance: %s", (text) => {
    const result = analyzeLocally(text);
    expect(result.rateField.type).toBe("adjustable");
    const reset = result.rateScenarios?.find((scenario) => scenario.type === "adjustable" && scenario.provenance === "computed");
    expect(reset).toBeDefined();
    expect(reset?.annualRate).toBeGreaterThan(result.rateField.value ?? 0);
    expect(reset?.payment).toBeGreaterThan(0);
    expect(reset?.provenance).toBe("computed");
  });
});

describe("Round 8: fee math, credit cards and score calibration", () => {
  it.each([
    "Origination fee of $100 plus $18 tax, $118 in total.",
    "Processing fee: $250, plus tax of $45, making $295 altogether.",
    "The setup charge is $80 plus $14 sales tax; the total fee is $94.",
  ])("counts a stated fee tax component once: %s", (text) => {
    const fee = detectCostsGeneric(text, null, null, null).findings.find((finding) => finding.category === "upfront_fee");
    expect(fee?.taxAmount).toBeGreaterThan(0);
    expect(fee?.totalImpact).toBeCloseTo((fee?.amount ?? 0) + (fee?.taxAmount ?? 0), 2);
  });

  it.each([
    "Credit card agreement. Purchase APR 21.4%; cash advance APR 29.9%; balance transfer APR 18.2%; penalty APR 31.4%. Minimum payment is the greater of $25 or 2% of balance.",
    "Revolving account. APR for purchases 19.5%, APR on cash advances 28%, APR on balance transfers 17%. Pay at least $35 or 3% of the outstanding balance, whichever is larger.",
    "Card terms: 22% on purchases, 30% on cash advances, 16% for transferred balances, and a 32% penalty APR. The minimum due is 2.5% of the balance or $20, whichever is more.",
  ])("separates card APR roles and does not request loan principal or term", (text) => {
    const rates = extractRateCandidates(text);
    expect(rates.some((rate) => rate.role === "purchase")).toBe(true);
    expect(rates.some((rate) => rate.role === "cash_advance")).toBe(true);
    expect(rates.some((rate) => rate.role === "balance_transfer")).toBe(true);
    const result = analyzeLocally(text);
    expect(result.docType.type).toBe("credit_card");
    expect(result.principalField.value).toBeNull();
    expect(result.termField.value).toBeNull();
    expect(result.minimumPaymentRule?.percentOfBalance).not.toBeNull();
    expect(result.minimumPaymentRule?.floor).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it.each([
    "The rate follows Prime + 2.5%, currently 8.25%.",
    "Interest is based on the benchmark plus 3%, and the current rate is 9%.",
    "The variable rate is index + 1.75%; today it stands at 7.5%.",
  ])("reads a stated current base without promoting the margin to APR", (text) => {
    const values = extractRateCandidates(text).map((candidate) => candidate.value);
    expect(values).toHaveLength(1);
    expect(values[0]).toBeGreaterThan(5);
  });

  it("keeps the required score ordering without document-type priors", () => {
    const texts = [
      "PERSONAL LOAN AGREEMENT. Principal $10,000. Fixed APR 8%. Term 36 months.",
      "CREDIT CARD AGREEMENT. Purchase APR 19.9%. Minimum payment is 2% of balance or $25.",
      "STUDENT LOAN AGREEMENT. Amount financed $12,000. Fixed APR 5%. Term 48 months.",
      "PERSONAL LOAN KFS. Principal $9,000. APR 8%. Total of payments $10,200.",
      "Adjustable-rate loan. The rate can change with the benchmark; the initial APR is 7%.",
      "Balloon note. The borrower is not required to refinance the remaining balance at maturity.",
      "Title loan. After default, the lender can seize the vehicle without any prior notice.",
      "Guaranteed loan approval. Send an advance release fee by gift card before funds are sent; do not tell your bank.",
    ];
    const scores = texts.map((text) => analyzeLocally(text).riskScore);
    expect(scores.slice(0, 4).every((score) => score <= 20)).toBe(true);
    expect(scores[4]).toBeGreaterThanOrEqual(25);
    expect(scores[4]).toBeLessThanOrEqual(45);
    expect(scores[4]).toBeLessThan(scores[5]);
    expect(scores[5]).toBeGreaterThanOrEqual(45);
    expect(scores[5]).toBeLessThanOrEqual(65);
    expect(scores[6]).toBeGreaterThanOrEqual(80);
    expect(scores[6]).toBeLessThanOrEqual(92);
    expect(scores[7]).toBeGreaterThanOrEqual(93);
  });
});
