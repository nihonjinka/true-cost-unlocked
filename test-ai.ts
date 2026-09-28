import fs from 'fs';
import { enhanceAnalysisWithAI } from './src/lib/analyzeWithAI.ts';
import { analyzeLocally } from './src/lib/analyzeLocally.ts';

const text = `
PERSONAL LOAN AGREEMENT - "EASY CASH NOW"
Congratulations! You have been pre-approved for our Easy Cash Now personal loan. Act within the next 24 hours to secure this exclusive offer. 
Loan Amount: $15,000
Base Interest Rate (APR): 8.99% (Subject to adjustment)
Loan Term: 60 months
Estimated Monthly Payment: $311.38
FEE SCHEDULE:
- Origination Fee: A one-time administrative fee of 4.5% of the total loan amount will be deducted from your disbursed funds.
- Account Maintenance: $15 per month for account processing.
- Early Repayment: Paying off this loan before the 60-month term ends will result in a prepayment penalty equal to 6 months of interest.
- Late Payment: $45 for any payment received after the 3rd of the month.
TERMS AND CONDITIONS:
1. Variable Rate Clause: The Lender reserves the right to increase the Base Interest Rate by up to 5% annually based on internal market assessments, without prior written notice to the Borrower.
2. Arbitration: By accepting these funds, the Borrower agrees to waive their right to join class action lawsuits against the Lender. All disputes will be resolved via mandatory binding arbitration chosen by the Lender.
3. Payment Allocation: Any partial payments made will first be applied to late fees, then to account maintenance fees, then to interest, and finally to the principal balance.
`;

async function test() {
  const local = analyzeLocally(text, 15000, 8.99, 60);
  const ai = await enhanceAnalysisWithAI(text, local);
  console.log("AI RESULT:", JSON.stringify({
    negotiationStrategy: ai.negotiationStrategy,
    legalLoopholes: ai.legalLoopholes,
    summary: ai.summary,
  }, null, 2));
}
test().catch(console.error);
