// EMI Calculation: EMI = (P * r * (1+r)^n) / ((1+r)^n - 1)
export function calculateEMI(principal: number, annualRate: number, tenureMonths: number) {
  if (principal <= 0 || tenureMonths <= 0) return { emi: 0, totalPayment: 0, totalInterest: 0 };
  if (annualRate === 0) {
    const emi = principal / tenureMonths;
    return { emi, totalPayment: principal, totalInterest: 0 };
  }

  const r = annualRate / 12 / 100;
  const n = tenureMonths;
  const factor = Math.pow(1 + r, n);
  const emi = (principal * r * factor) / (factor - 1);
  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;

  return { emi, totalPayment, totalInterest };
}

export interface AmortizationRow {
  month: number;
  emi: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
}

export type SupportedCurrency = "USD" | "INR" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "SGD" | "AED";

const DEFAULT_CURRENCY: SupportedCurrency = "USD";

const CURRENCY_LOCALE: Record<SupportedCurrency, string> = {
  USD: "en-US",
  INR: "en-IN",
  EUR: "en-IE",
  GBP: "en-GB",
  JPY: "ja-JP",
  CAD: "en-CA",
  AUD: "en-AU",
  SGD: "en-SG",
  AED: "en-AE",
};

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return Object.prototype.hasOwnProperty.call(CURRENCY_LOCALE, currency);
}

function normalizeCurrency(currency: string | undefined): SupportedCurrency {
  if (!currency) return DEFAULT_CURRENCY;
  return isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY;
}

export function generateAmortizationSchedule(principal: number, annualRate: number, tenureMonths: number): AmortizationRow[] {
  const { emi } = calculateEMI(principal, annualRate, tenureMonths);
  if (emi === 0) return [];

  const r = annualRate / 12 / 100;
  let balance = principal;
  const rows: AmortizationRow[] = [];

  for (let month = 1; month <= tenureMonths; month++) {
    const interestPaid = balance * r;
    const principalPaid = Math.min(emi - interestPaid, balance);
    balance = Math.max(balance - principalPaid, 0);
    rows.push({ month, emi, principalPaid, interestPaid, remainingBalance: balance });
  }

  return rows;
}

export function formatCurrency(amount: number, currency: SupportedCurrency = DEFAULT_CURRENCY): string {
  const safeCurrency = normalizeCurrency(currency);
  return new Intl.NumberFormat(CURRENCY_LOCALE[safeCurrency], {
    style: "currency",
    currency: safeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getCurrencySymbol(currency: SupportedCurrency = DEFAULT_CURRENCY): string {
  const safeCurrency = normalizeCurrency(currency);
  return (
    new Intl.NumberFormat(CURRENCY_LOCALE[safeCurrency], {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? "$"
  );
}

export function getCurrencyLocale(currency: SupportedCurrency = DEFAULT_CURRENCY): string {
  return CURRENCY_LOCALE[normalizeCurrency(currency)];
}

export const DEMO_TEXT = `CREDIT CARD AGREEMENT - PLATINUM REWARDS CARD

Annual Percentage Rate (APR): 24.99% variable, based on the Prime Rate.
Introductory APR: 0% for the first 12 months on purchases and balance transfers.
After the introductory period, the APR will revert to 24.99%.

PENALTY APR: 29.99%. This APR may be applied if you make a late payment.
We may apply the Penalty APR indefinitely.

ANNUAL FEE: $95 (waived for the first year).

BALANCE TRANSFER FEE: 3% of the amount transferred, minimum $5.
CASH ADVANCE FEE: 5% of the amount, minimum $10.
FOREIGN TRANSACTION FEE: 3% of each transaction in U.S. dollars.

LATE PAYMENT FEE: Up to $40.
RETURNED PAYMENT FEE: Up to $40.

MINIMUM PAYMENT: The greater of $25 or 1% of the outstanding balance plus interest and fees.

ACT NOW - LIMITED TIME OFFER! This exclusive rate won't last forever!
Don't miss out on this once-in-a-lifetime opportunity!
Save up to 80% compared to other cards! (compared to our highest rate tier)

Note: Making only the minimum payment will result in paying more in interest and will take longer to pay off the balance. We may change the terms at any time with 45 days notice. Promotional rates may be terminated early if any payment is missed.`;

export const DEMO_LOAN = {
  amount: 25000,
  rate: 24.99,
  duration: 36,
};
