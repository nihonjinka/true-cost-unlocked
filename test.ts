import { enhanceAnalysisWithAI } from './src/lib/analyzeWithAI';
import { analyzeLocally } from './src/lib/analyzeLocally';
import { extractValuesFromText } from './src/lib/analyzeLocally';

// Mock import.meta.env
global.import = { meta: { env: { VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY } } } as any;

const text = `EXCLUSIVE VIP PREMIER CREDIT AGREEMENT

Hurry! This limited time offer expires soon and won't last. Act now to secure your funds!

You have been approved for a personal credit limit of $15,000.
The annual percentage rate (APR) is 18.5%, which is a variable rate tied to the Prime Rate.
Repayment duration is 48 months.

FEES:
- We charge an upfront documentation fee of $150.
- A platform usage fee of $10 applies monthly.
- Late payment fee: up to $45.
- If you pay off your balance early, a prepayment penalty of 3% applies.

IMPORTANT TERMS:
We reserve the right to modify the terms at any time.
If you miss a payment, a penalty APR of 28.99% will apply indefinitely.
Minimum payment is the greater of $30 or 2% of the balance.
Save up to 50% compared to our standard tier! Don't miss out!`;

const extracted = extractValuesFromText(text);
const local = analyzeLocally(text, extracted.loanAmount || 0, extracted.interestRate || 0, extracted.tenureMonths || 0);

enhanceAnalysisWithAI(text, local).then(res => {
  console.log("FINAL RESULT:", JSON.stringify(res, null, 2));
}).catch(console.error);
