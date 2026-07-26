import type { ChangeReceipt } from "@greenlight/shared";
import { ChevronDown, MessagesSquare } from "lucide-react";
import { formatDateTime } from "../../formatters";

/**
 * Shows what the coding session that produced the change was asked to do.
 *
 * Only a verified link is read back, so anything rendered here belongs to the
 * session the commit trailer names. Three outcomes are kept distinct, because
 * collapsing them would let an unanswered question read as an empty session:
 * no panel at all when there is no verified session to describe, an explicit
 * note when the session ran with prompt export disabled, and the prompts
 * themselves when it did not.
 */
export function AiSessionPanel({ receipt }: { receipt: ChangeReceipt }) {
  const session = receipt.aiSession;
  if (!session) {
    return null;
  }

  const promptCount = session.prompts.length;

  return (
    <details className="evidence-disclosure">
      <summary>
        <span>
          <MessagesSquare size={18} aria-hidden="true" />
          <strong>What this session was asked to do</strong>
          <small>
            {session.promptsRecorded
              ? `${promptCount} prompt${promptCount === 1 ? "" : "s"} from the linked session`
              : "prompts were not recorded for this session"}
          </small>
        </span>
        <ChevronDown size={19} aria-hidden="true" />
      </summary>
      <div className="evidence-detail-stack">
        {session.sessionId
          ? (
            <p className="session-identity">
              Session <code>{session.sessionId}</code>
            </p>
          )
          : null}

        {session.promptsRecorded
          ? (
            <ol className="session-prompts">
              {session.prompts.map((prompt, index) => (
                <li key={`${prompt.at}-${index}`}>
                  {prompt.at
                    ? (
                      <time dateTime={prompt.at}>{formatDateTime(prompt.at)}</time>
                    )
                    : null}
                  <p>{prompt.text}</p>
                </li>
              ))}
            </ol>
          )
          : (
            <p>
              This session ran with prompt export disabled, so what it was asked
              to do was never recorded. The link to the session still holds.
            </p>
          )}
      </div>
    </details>
  );
}
