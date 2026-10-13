import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AICounterOfferEmail } from "@/components/AICounterOfferEmail";
import { analyzeLocally } from "@/lib/analyzeLocally";

const generate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analyzeWithAI", () => ({ generateCounterOfferDraft: generate, hasActionableFindings: () => true }));
vi.mock("@/components/TerminalCard", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
const context = () => analyzeLocally("Personal loan amount: $5,000. APR: 7%. Term: 24 months.");
afterEach(() => { cleanup(); generate.mockReset(); });

describe("email state", () => {
  it("shows a draft arriving after the insight panel was mounted", () => {
    const baseline = context();
    const { rerender } = render(<AICounterOfferEmail context={baseline} />);
    expect(screen.getByRole("button", { name: /copy email/i })).toBeDisabled();
    rerender(<AICounterOfferEmail context={{ ...baseline, aiCounterOfferEmail: "Please narrow the data-sharing permission." }} />);
    expect(screen.getByText("Please narrow the data-sharing permission.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy email/i })).toBeEnabled();
  });

  it("does not let a previous document's draft replace a new document's draft", async () => {
    let resolve!: (value: { aiCounterOfferEmail: string }) => void;
    generate.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const baseline = context();
    const { rerender } = render(<AICounterOfferEmail context={baseline} />);
    fireEvent.click(screen.getByRole("button", { name: /new draft/i }));
    rerender(<AICounterOfferEmail context={{ ...baseline, id: "next-document", aiCounterOfferEmail: "Current document draft" }} />);
    await act(async () => resolve({ aiCounterOfferEmail: "Stale document draft" }));
    expect(screen.getByText("Current document draft")).toBeInTheDocument();
    expect(screen.queryByText("Stale document draft")).not.toBeInTheDocument();
  });

  it("keeps an existing draft while showing a failed retry's actual reason", async () => {
    generate.mockRejectedValueOnce(new Error("AI provider credits are exhausted."));
    render(<AICounterOfferEmail context={{ ...context(), aiCounterOfferEmail: "Existing useful draft" }} />);
    fireEvent.click(screen.getByRole("button", { name: /new draft/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("credits are exhausted"));
    expect(screen.getByText("Existing useful draft")).toBeInTheDocument();
  });
});
