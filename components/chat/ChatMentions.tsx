import { Children, type ReactNode } from "react";

const MENTION = /(@[A-Za-z0-9._]+)/g;

export function MentionText({
  text,
  onSelectUsername,
}: {
  text: string;
  onSelectUsername?: (username: string) => void;
}) {
  const chunks = text.split(MENTION);
  return (
    <>
      {chunks.map((chunk, index) => {
        if (chunk.startsWith("@") && chunk.length > 1 && onSelectUsername) {
          const username = chunk.slice(1);
          return (
            <button
              key={`${chunk}-${index}`}
              type="button"
              className="font-medium text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
              onClick={() => onSelectUsername(username)}
            >
              {chunk}
            </button>
          );
        }
        return <span key={`${chunk}-${index}`}>{chunk}</span>;
      })}
    </>
  );
}

export function mentionChildren(
  children: ReactNode,
  onSelectUsername?: (username: string) => void,
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return (
        <MentionText text={child} onSelectUsername={onSelectUsername} />
      );
    }
    return child;
  });
}
