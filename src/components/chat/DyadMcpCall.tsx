import React, { useState } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  CircleX,
  Loader,
  Server,
  Wrench,
} from "lucide-react";
import { CodeHighlight } from "./CodeHighlight";
import { CustomTagState } from "./stateTypes";

interface DyadMcpCallProps {
  children?: React.ReactNode;
  node?: any;
}

export const DyadMcpCall: React.FC<DyadMcpCallProps> = ({ children, node }) => {
  const [isOpen, setIsOpen] = useState(false);
  const title: string = node?.properties?.title || "MCP Tool";
  const server: string = node?.properties?.server || "";
  const tool: string = node?.properties?.tool || "";
  const state = (node?.properties?.state as CustomTagState) ?? "finished";

  const pending = state === "pending";
  const aborted = state === "aborted";
  const borderColor = pending
    ? "border-amber-500"
    : aborted
      ? "border-red-500"
      : "border-border";

  // Stringify children if it's not a string
  const contentString =
    typeof children === "string"
      ? children
      : typeof children === "object"
        ? JSON.stringify(children, null, 2)
        : String(children ?? "");

  return (
    <div
      className={`bg-(--background-lightest) hover:bg-(--background-lighter) rounded-lg px-4 py-2 border my-2 cursor-pointer ${borderColor}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={16} />
          <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded ml-1 font-medium">
            MCP
          </span>
          <div className="flex items-center gap-1 text-sm text-gray-800 dark:text-gray-200">
            <Wrench size={14} />
            <span className="font-medium">{title}</span>
            {pending && (
              <div className="flex items-center text-amber-600 text-xs ml-2">
                <Loader size={14} className="mr-1 animate-spin" />
                <span>Running...</span>
              </div>
            )}
            {aborted && (
              <div className="flex items-center text-red-600 text-xs ml-2">
                <CircleX size={14} className="mr-1" />
                <span>Did not finish</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center">
          {isOpen ? (
            <ChevronsDownUp
              size={20}
              className="text-gray-500 dark:text-gray-400"
            />
          ) : (
            <ChevronsUpDown
              size={20}
              className="text-gray-500 dark:text-gray-400"
            />
          )}
        </div>
      </div>
      {isOpen && (
        <div className="mt-3 text-xs">
          <CodeHighlight className="language-json">
            {contentString}
          </CodeHighlight>
        </div>
      )}
    </div>
  );
};
