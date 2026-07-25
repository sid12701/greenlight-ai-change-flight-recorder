import { useState } from "react";
import type { ChangeReceipt } from "@greenlight/shared";
import { Check, Copy, RotateCcw } from "lucide-react";

export function Actions({ receipt }: { receipt: ChangeReceipt }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyRevert() {
    try {
      await navigator.clipboard.writeText(receipt.actions.revertCommand);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <section className="safe-action">
      <div className="safe-action-heading">
        <span className="section-icon" aria-hidden="true"><RotateCcw size={19} /></span>
        <div>
          <p className="section-kicker">Operator control</p>
          <h2>Safe action</h2>
        </div>
      </div>
      <div className="command-row">
        <code>{receipt.actions.revertCommand}</code>
        <button
          type="button"
          className="copy-button"
          onClick={copyRevert}
        >
          {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
          {copied ? "Copied" : "Copy revert command"}
        </button>
      </div>
      <p className="safe-action-note">
        Reverts remain a human decision. GreenLight exposes the safest command;
        it does not execute it.
      </p>
      <div aria-live="polite">
        {copied ? <p className="action-feedback action-feedback--good">Copied to clipboard.</p> : null}
        {copyError ? <p className="action-feedback action-feedback--warn">Clipboard blocked. Select the command manually.</p> : null}
      </div>
    </section>
  );
}
