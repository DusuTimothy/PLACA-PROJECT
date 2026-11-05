/**
 * Tiny, safe Markdown renderer for guide content.
 *
 * The server stores Markdown only; raw HTML is never rendered. This supports
 * the subset the starter guides use: headings, paragraphs, bold text and
 * ordered/unordered lists.
 */

function inline(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
}

export default function GuideBody({ markdown }) {
  const lines = String(markdown || '').split('\n');
  const blocks = [];
  let list = null;

  function flushList() {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        className={`ml-5 space-y-1 ${list.ordered ? 'list-decimal' : 'list-disc'}`}
      >
        {list.items.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </Tag>
    );
    list = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      blocks.push(
        <h4 key={blocks.length} className="pt-2 text-base font-bold text-ink">
          {inline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith('## ')) {
      flushList();
      blocks.push(
        <h3 key={blocks.length} className="pt-3 text-lg font-bold text-ink">
          {inline(line.slice(3))}
        </h3>
      );
    } else if (/^\d+\.\s+/.test(line)) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(line.replace(/^\d+\.\s+/, ''));
    } else if (line.startsWith('- ')) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(line.slice(2));
    } else {
      flushList();
      blocks.push(
        <p key={blocks.length} className="text-sm leading-relaxed text-slate-700">
          {inline(line)}
        </p>
      );
    }
  }
  flushList();

  return <div className="space-y-1">{blocks}</div>;
}
