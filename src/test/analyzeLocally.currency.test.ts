import { describe, expect, it } from "vitest";
import { analyzeLocally, extractValuesFromText } from "@/lib/analyzeLocally";

describe("extractValuesFromText currency parsing", () => {
  it("extracts INR amount with rupee symbol and Indian comma grouping", () => {
    const text = "Loan amount: ₹5,00,000. APR 12.5%. Term 48 months.";
    const values = extractValuesFromText(text);

    expect(values.loanAmount).toBe(500000);
    expect(values.interestRate).toBe(12.5);
    expect(values.tenureMonths).toBe(48);
  });

  it("extracts INR amount with lakh units", () => {
    const text = "Principal amount is INR 7.5 lakh at 11% interest for 5 years.";
    const values = extractValuesFromText(text);

    expect(values.loanAmount).toBe(750000);
    expect(values.interestRate).toBe(11);
    expect(values.tenureMonths).toBe(60);
  });

  it("keeps USD extraction behavior unchanged", () => {
    const text = "Credit amount: $25,000 APR 18% for 36 months.";
    const values = extractValuesFromText(text);

    expect(values.loanAmount).toBe(25000);
    expect(values.interestRate).toBe(18);
    expect(values.tenureMonths).toBe(36);
  });
});

describe("analyzeLocally currency output", () => {
  it("marks rupee text as INR and emits INR formatted summary", () => {
    const text = "Loan amount ₹3,50,000 at 12% APR for 24 months.";
    const result = analyzeLocally(text, 350000, 12, 24);

    expect(result.currencyCode).toBe("INR");
    expect(result.summary).toContain("₹");
  });

  it("marks dollar text as USD and emits dollar formatted summary", () => {
    const text = "Loan amount: $1,50,000 at 9.99% APR for 12 months.";
    const result = analyzeLocally(text, 150000, 9.99, 12);

    expect(result.currencyCode).toBe("USD");
    expect(result.summary).toContain("$");
  });

  it("marks euro text as EUR and emits euro formatted summary", () => {
    const text = "Loan amount: EUR 45,000 at 7.2% APR for 36 months.";
    const result = analyzeLocally(text, 45000, 7.2, 36);

    expect(result.currencyCode).toBe("EUR");
    expect(result.summary).toContain("€");
  });
});
