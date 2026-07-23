import { useState } from "react";
import type { ChangeReceipt } from "@greenlight/shared";

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
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-xl font-semibold">Safe action</h2>
      <p className="font-mono text-sm">{receipt.actions.revertCommand}</p>
      <button
        type="button"
        className="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900"
        onClick={copyRevert}
      >
        Copy revert command
      </button>
      {copied ? <p className="mt-2 text-sm text-emerald-300">Copied to clipboard.</p> : null}
      {copyError ? <p className="mt-2 text-sm text-amber-200">Clipboard blocked. Select the command manually.</p> : null}
    </section>
  );
}
