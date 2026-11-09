import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-line bg-[#0b0c11]">
      <div className="flex items-center justify-between border-b border-line/80 px-3 py-1.5">
        <span className="font-mono text-[0.62rem] uppercase tracking-wider text-ash/70">{language || "code"}</span>
        <button
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] text-ash transition-colors hover:bg-white/5 hover:text-parchment focus-ring"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard unavailable */
            }
          }}
          aria-label="Copy code"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="!m-0 !rounded-none !border-0 !bg-transparent">
        <code className={language ? `language-${language}` : undefined}>{code}</code>
      </pre>
    </div>
  );
}

const components: Components = {
  a({ children, href, ...props }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props}>
        {children}
      </a>
    );
  },
  code({ className, children, ...props }) {
    const text = String(children ?? "").replace(/\n$/, "");
    const match = /language-([\w-]+)/.exec(className || "");
    const isBlock = Boolean(match) || text.includes("\n");
    if (isBlock) {
      return <CodeBlock code={text} language={match?.[1]} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  img({ src, alt, ...props }) {
    return (
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="my-4 w-full rounded-xl border border-line bg-coal/60 shadow-grimoire"
        {...props}
      />
    );
  },
};

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-grimoire">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
