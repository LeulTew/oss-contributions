import { marked } from 'marked';
import { parseFragment } from 'parse5';

const allowed = new Set([
  'p', 'br', 'strong', 'em', 's', 'del', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'hr', 'a', 'details', 'summary', 'kbd', 'sup', 'sub',
]);
const discarded = new Set(['script', 'style', 'template', 'head', 'meta', 'link', 'base']);
const embeds = new Set(['svg', 'math', 'iframe', 'object', 'embed', 'video', 'audio', 'canvas', 'form', 'textarea', 'select', 'button']);
const attr = (node, name) => node.attrs?.find(attribute => attribute.name === name)?.value;
export const MARKDOWN_LIMITS = Object.freeze({ characters: 100000, nodes: 10000, depth: 128 });

export function safeMarkdownURL(value, source) {
  if (!value) return null;
  try {
    const url = new URL(value, source);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

// Neither parser creates a browser document. Only this closed vocabulary reaches the DOM.
export function renderMarkdown(body, source, documentRef = document) {
  const fragment = documentRef.createDocumentFragment();
  function omitted(text) {
    const span = documentRef.createElement('span');
    span.className = 'omitted-embed';
    span.textContent = text;
    return span;
  }
  if (body.length > MARKDOWN_LIMITS.characters) {
    fragment.append(omitted('[Message exceeds the formatting limit. Read the original text below or open its source.]'));
    return fragment;
  }
  const tree = parseFragment(marked.parse(body, { gfm: true, breaks: false, async: false }), { scriptingEnabled: false });
  let visited = 0, limited = false;
  function append(parent, entry, depth) {
    if (limited) return;
    if (++visited > MARKDOWN_LIMITS.nodes) {
      parent.append(omitted('[Formatting limit reached. Read the complete original text below or open its source.]'));
      limited = true;
      return;
    }
    if (entry.nodeName === '#comment') return;
    if (entry.nodeName === '#text') { parent.append(documentRef.createTextNode(entry.value)); return; }
    if (depth > MARKDOWN_LIMITS.depth) {
      parent.append(omitted('[Deeply nested content omitted; original text is available below.]'));
      return;
    }
    const tag = entry.tagName;
    if (entry.namespaceURI && entry.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      parent.append(omitted('[Non-HTML embed omitted]'));
      return;
    }
    if (discarded.has(tag)) return;
    if (tag === 'img') {
      const text = `[Image not loaded${attr(entry, 'alt') ? `: ${attr(entry, 'alt')}` : ''}]`;
      const href = safeMarkdownURL(attr(entry, 'src'), source);
      if (href && parent.localName !== 'a') {
        const imageLink = documentRef.createElement('a');
        imageLink.setAttribute('href', href);
        imageLink.setAttribute('target', '_blank');
        imageLink.setAttribute('rel', 'noopener noreferrer');
        imageLink.className = 'omitted-embed';
        imageLink.textContent = `${text} Open image`;
        parent.append(imageLink);
      } else parent.append(omitted(text));
      return;
    }
    if (tag === 'input') {
      if (attr(entry, 'type')?.toLowerCase() === 'checkbox') parent.append(documentRef.createTextNode(attr(entry, 'checked') === undefined ? '[ ] ' : '[x] '));
      else parent.append(omitted('[Input omitted]'));
      return;
    }
    if (embeds.has(tag)) {
      parent.append(omitted(`[${tag} embed omitted]`));
      return;
    }
    let target = parent;
    if (allowed.has(tag)) {
      const href = tag === 'a' ? safeMarkdownURL(attr(entry, 'href'), source) : null;
      target = documentRef.createElement(tag === 'a' && !href ? 'span' : tag);
      if (href) {
        target.setAttribute('href', href);
        target.setAttribute('rel', 'noopener noreferrer');
        target.setAttribute('target', '_blank');
      }
      if (attr(entry, 'title')) target.setAttribute('title', attr(entry, 'title'));
      if (tag === 'details' && attr(entry, 'open') !== undefined) target.setAttribute('open', '');
      if (tag === 'ol' && attr(entry, 'start') !== undefined) {
        const start = Number(attr(entry, 'start'));
        if (Number.isSafeInteger(start) && Math.abs(start) <= 100000) target.setAttribute('start', String(start));
      }
      if (['td', 'th'].includes(tag) && ['left', 'center', 'right'].includes(attr(entry, 'align'))) target.className = `align-${attr(entry, 'align')}`;
      parent.append(target);
    }
    for (const child of entry.childNodes ?? []) append(target, child, depth + 1);
  }
  for (const child of tree.childNodes) append(fragment, child, 0);
  return fragment;
}
