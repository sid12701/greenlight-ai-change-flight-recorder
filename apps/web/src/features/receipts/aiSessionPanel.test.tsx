import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ChangeReceipt } from "@greenlight/shared";
import { AiSessionPanel } from "./AiSessionPanel";

/**
 * The panel's whole job is keeping three answers apart: no session to describe,
 * a session that recorded nothing, and a session that recorded prompts. Any two
 * of those rendering the same way would let a receipt imply the session was
 * silent when the question was simply never asked.
 */
function receiptWith(aiSession: ChangeReceipt["aiSession"]): ChangeReceipt {
  return { aiSession } as ChangeReceipt;
}

describe("ai session panel", () => {
  afterEach(() => cleanup());

  it("renders nothing when there is no verified session to describe", () => {
    const { container } = render(<AiSessionPanel receipt={receiptWith(null)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says prompts were not recorded rather than showing an empty session", () => {
    render(
      <AiSessionPanel
        receipt={receiptWith({
          sessionId: "4e5784eb-c9f4-4f1d-94f2-bd91f213872b",
          prompts: [],
          promptsRecorded: false,
        })}
      />,
    );
    expect(screen.getByText(/prompts were not recorded/)).toBeInTheDocument();
    expect(screen.getByText(/prompt export disabled/)).toBeInTheDocument();
    // The link itself still stands; only the prompt text is absent.
    expect(screen.getByText(/4e5784eb-c9f4-4f1d-94f2-bd91f213872b/)).toBeInTheDocument();
  });

  it("shows the session's prompts in the order they were sent", () => {
    render(
      <AiSessionPanel
        receipt={receiptWith({
          sessionId: "0e8002c0-2eff-44c2-85e4-610253efc855",
          prompts: [
            { at: "2026-07-26T13:16:50.935Z", text: "add conn_max_lifetime to the pool" },
            { at: "2026-07-26T13:18:31.202Z", text: "now commit it" },
          ],
          promptsRecorded: true,
        })}
      />,
    );
    expect(screen.getByText("2 prompts from the linked session")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("add conn_max_lifetime to the pool");
    expect(items[1]).toHaveTextContent("now commit it");
  });

  it("counts a single prompt without pluralising", () => {
    render(
      <AiSessionPanel
        receipt={receiptWith({
          sessionId: null,
          prompts: [{ at: "2026-07-26T13:16:50.935Z", text: "only one" }],
          promptsRecorded: true,
        })}
      />,
    );
    expect(screen.getByText("1 prompt from the linked session")).toBeInTheDocument();
  });
});
