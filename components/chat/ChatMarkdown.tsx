"use client";

import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { splitMarkdownWithTables } from "@/lib/chat/table";
import ChatDataTable from "./ChatDataTable";
import { mentionChildren } from "./ChatMentions";

interface Props {
  text: string;
  onSelectUsername?: (username: string) => void;
}

function MarkdownBody({
  text,
  onSelectUsername,
}: {
  text: string;
  onSelectUsername?: (username: string) => void;
}) {
  const wrap = (children: ReactNode) =>
    mentionChildren(children, onSelectUsername);

  const components: Components = {
    h1: ({ children }) => (
      <h1 className="mt-4 text-[17px] font-semibold tracking-tight text-white first:mt-0">
        {wrap(children)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-white first:mt-0">
        {wrap(children)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-3 text-sm font-semibold text-white/90 first:mt-0">
        {wrap(children)}
      </h3>
    ),
    p: ({ children }) => (
      <p className="mt-3 text-[15px] leading-7 text-white/80 first:mt-0">
        {wrap(children)}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{wrap(children)}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-white/85">{wrap(children)}</em>
    ),
    ul: ({ children }) => (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-white/80 first:mt-0 marker:text-white/35">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-white/80 first:mt-0 marker:text-white/35">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-0.5">{wrap(children)}</li>,
    hr: () => <hr className="my-4 border-white/10" />,
    blockquote: ({ children }) => (
      <blockquote className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[14px] leading-6 text-white/65 first:mt-0">
        {wrap(children)}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
      >
        {children}
      </a>
    ),
    code: ({ className, children }) => {
      const inline = !className;
      if (inline) {
        return (
          <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[12px] text-white/90">
            {children}
          </code>
        );
      }
      return (
        <code className="block overflow-x-auto whitespace-pre font-mono text-[12px] text-white/80">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 first:mt-0">
        {children}
      </pre>
    ),
  };

  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatMarkdown({ text, onSelectUsername }: Props) {
  const blocks = splitMarkdownWithTables(text);
  if (blocks.length === 1 && blocks[0].type === "markdown") {
    return (
      <MarkdownBody text={blocks[0].text} onSelectUsername={onSelectUsername} />
    );
  }
  return (
    <div className="space-y-3">
      {blocks.map((block, index) =>
        block.type === "table" ? (
          <ChatDataTable
            key={`md-table-${index}`}
            table={block.table}
            onSelectUsername={onSelectUsername}
          />
        ) : (
          <MarkdownBody
            key={`md-text-${index}`}
            text={block.text}
            onSelectUsername={onSelectUsername}
          />
        ),
      )}
    </div>
  );
}
