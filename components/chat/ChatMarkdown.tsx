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
      <h1 className="mt-4 text-[17px] font-semibold tracking-tight text-[#161A17] first:mt-0">
        {wrap(children)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-[#161A17] first:mt-0">
        {wrap(children)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-3 text-sm font-semibold text-[#161A17]/90 first:mt-0">
        {wrap(children)}
      </h3>
    ),
    p: ({ children }) => (
      <p className="mt-3 text-[15px] leading-7 text-[#161A17]/80 first:mt-0">
        {wrap(children)}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-[#161A17]">{wrap(children)}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-[#161A17]/85">{wrap(children)}</em>
    ),
    ul: ({ children }) => (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-[#161A17]/80 first:mt-0 marker:text-[#D5CDBF]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-[#161A17]/80 first:mt-0 marker:text-[#D5CDBF]">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-0.5">{wrap(children)}</li>,
    hr: () => <hr className="my-4 border-[#D5CDBF]" />,
    blockquote: ({ children }) => (
      <blockquote className="mt-3 rounded-xl border border-[#D5CDBF] bg-[#F3EEE4] px-3.5 py-2.5 text-[14px] leading-6 text-[#161A17]/65 first:mt-0">
        {wrap(children)}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[#0F766E] underline decoration-[#0F766E]/30 underline-offset-2 hover:decoration-[#0F766E]"
      >
        {children}
      </a>
    ),
    code: ({ className, children }) => {
      const inline = !className;
      if (inline) {
        return (
          <code className="rounded bg-[#E7E0D4] px-1 py-0.5 font-mono text-[12px] text-[#161A17]/90">
            {children}
          </code>
        );
      }
      return (
        <code className="block overflow-x-auto whitespace-pre font-mono text-[12px] text-[#161A17]/80">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="mt-2 overflow-x-auto rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] px-3 py-2 first:mt-0">
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
