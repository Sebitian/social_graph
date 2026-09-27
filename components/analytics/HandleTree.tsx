"use client";

export interface HandleTreeNode {
  id: string;
  handle: string;
  selected: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

interface Props {
  root: HandleTreeNode;
  nodes: HandleTreeNode[];
  className?: string;
}

function TreeNode({
  handle,
  selected,
  disabled,
  title,
  onClick,
}: Omit<HandleTreeNode, "id">) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      title={title ?? `@${handle}`}
      onClick={onClick}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full py-0.5 pr-1.5 text-left text-[12px] transition ${
        disabled
          ? "cursor-not-allowed text-[#5E665F]/45"
          : selected
            ? "text-[#161A17]"
            : "text-[#5E665F] hover:text-[#161A17]"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          disabled
            ? "bg-[#D5CDBF]"
            : selected
              ? "bg-[#161A17] ring-2 ring-[#E1306C] ring-offset-2 ring-offset-[#F3EEE4]"
              : "bg-[#161A17]"
        }`}
      />
      <span className={`truncate ${selected ? "font-semibold" : "font-medium"}`}>
        <span className={disabled ? "" : "text-[#0F766E]"}>@</span>
        {handle}
      </span>
    </button>
  );
}

function Branch({
  index,
  count,
}: {
  index: number;
  count: number;
}) {
  const only = count === 1;
  const vertical = only
    ? ""
    : index === 0
      ? "top-1/2 bottom-0"
      : index === count - 1
        ? "top-0 bottom-1/2"
        : "inset-y-0";

  return (
    <span aria-hidden className="relative h-8 w-4 shrink-0">
      {vertical ? (
        <span className={`absolute left-0 w-px bg-[#161A17] ${vertical}`} />
      ) : null}
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#161A17]" />
    </span>
  );
}

export default function HandleTree({ root, nodes, className = "" }: Props) {
  return (
    <div
      role="group"
      aria-label="Accounts"
      className={`flex items-center ${className}`}
    >
      <TreeNode {...root} />
      {nodes.length > 0 ? (
        <div className="flex items-center">
          <span aria-hidden className="h-px w-4 shrink-0 bg-[#161A17]" />
          <ul className="flex flex-col">
            {nodes.map((node, index) => (
              <li key={node.id} className="flex items-center">
                <Branch index={index} count={nodes.length} />
                <TreeNode {...node} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
