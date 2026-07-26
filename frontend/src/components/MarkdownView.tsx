import ReactMarkdown, { type Components } from 'react-markdown';

// M3c Phase 2 (W-68): shared read-only markdown renderer for coaching lessons — used by the admin
// module editor preview and the student Lesson page. react-markdown renders no raw HTML by default,
// so module content cannot inject markup. Styling is done with explicit component overrides (the
// project has no @tailwindcss/typography plugin). Callers may pass `components` to override specific
// elements per context (e.g. the Playbook lesson renders trap bullets as amber cards) — W-81.
export default function MarkdownView({ content, components }: { content: string; components?: Components }) {
  return (
    <div className="text-gray-800 leading-relaxed">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-3 first:mt-0">{children}</h1>,
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="mb-3">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-900">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 rounded-lg bg-gray-50 px-4 py-2 text-gray-700">{children}</blockquote>
          ),
          a: ({ children, href }) => (
            <a href={href} className="text-brand-blue underline">
              {children}
            </a>
          ),
          ...components,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
