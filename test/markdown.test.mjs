import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { renderMarkdown, safeMarkdownURL, MARKDOWN_LIMITS } from '../site/markdown.mjs';

class TestNode {
  constructor(localName, text = '') { this.localName = localName; this.children = []; this.attributes = {}; this.value = text; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  set className(value) { this.attributes.class = value; }
  set textContent(value) { this.value = String(value); this.children = []; }
  get textContent() { return this.value + this.children.map(child => child.textContent).join(''); }
}
const documentRef = {
  createElement: tag => new TestNode(tag),
  createTextNode: text => new TestNode('#text', text),
  createDocumentFragment: () => new TestNode('#fragment'),
};
const source = 'https://github.com/owner/project/pull/3#issuecomment-1';
const render = body => renderMarkdown(body, source, documentRef);
function nodes(root) { return [root, ...root.children.flatMap(nodes)]; }
const elements = (root, name) => nodes(root).filter(node => node.localName === name);

test('GitHub Markdown renders headings, paragraphs, lists, quotes, code and tables as structure', () => {
  const body = '# Review\n\nParagraph with **strong**, *emphasis* and ~~removed~~.\n\n- one\n- two\n\n> quoted\n\n```html\n<script>literal code</script>\n```\n\n| Flag | Meaning |\n| :--- | ---: |\n| x | safe |\n';
  const result = render(body);
  for (const tag of ['h1', 'p', 'strong', 'em', 'del', 'ul', 'li', 'blockquote', 'pre', 'code', 'table', 'th', 'td']) assert.ok(elements(result, tag).length, tag);
  assert.equal(elements(result, 'script').length, 0);
  assert.match(elements(result, 'code')[0].textContent, /<script>literal code<\/script>/);
  assert.equal(elements(result, 'th')[1].attributes.class, 'align-right');
});
test('whole-document parsing preserves details split around Markdown tokens and nested disclosure content', () => {
  const result = render('<details><summary>Review details</summary>\n\n## Why this matters\n\n- **Attribution remains visible**\n\n<details><summary>More</summary>\n\n`example()`\n\n</details>\n</details>');
  assert.equal(elements(result, 'details').length, 2);
  assert.equal(elements(result, 'summary')[0].textContent, 'Review details');
  assert.equal(elements(result, 'h2')[0].textContent, 'Why this matters');
  assert.equal(elements(result, 'strong')[0].textContent, 'Attribution remains visible');
  assert.equal(elements(result, 'code')[0].textContent, 'example()');
  assert.ok(elements(elements(result, 'details')[0], 'ul').length);
});
test('HTML comments and active content are never default reading content or active DOM', () => {
  const result = render('Visible attribution\n\n<!-- private-formatting-metadata -->\n<script>alert(1)</script><style>body{display:none}</style><iframe src="https://evil.invalid"></iframe><svg onload="alert(2)"><a href="javascript:alert(3)">bad</a></svg><math><mtext>foreign</mtext></math><form action="https://evil.invalid"><input name="cookie"></form>');
  assert.match(result.textContent, /Visible attribution/);
  assert.doesNotMatch(result.textContent, /private-formatting-metadata|alert\(1\)|body\{display/);
  assert.match(result.textContent, /embed omitted/);
  for (const tag of ['script', 'style', 'iframe', 'svg', 'math', 'form', 'input']) assert.equal(elements(result, tag).length, 0, tag);
});
test('comment delimiters in fenced code remain text, while actual HTML comments disappear', () => {
  const result = render('<!-- hidden metadata -->\n\n```html\n<!-- meaningful code example -->\n<div>Example</div>\n```');
  assert.doesNotMatch(result.textContent, /hidden metadata/);
  assert.match(elements(result, 'code')[0].textContent, /<!-- meaningful code example -->/);
  assert.match(elements(result, 'code')[0].textContent, /<div>Example<\/div>/);
});
test('deep nested Markdown below the size cap fails explicitly rather than returning empty content', () => {
  const body = '> '.repeat(2000) + 'deep Markdown';
  assert.ok(body.length < MARKDOWN_LIMITS.characters);
  let result;
  try { result = render(body); }
  catch (error) { assert.ok(error instanceof RangeError); return; }
  assert.match(result.textContent, /Deeply nested content omitted|Formatting limit reached/);
});
test('unsafe attributes cannot clobber DOM, install handlers or restyle the application', () => {
  const result = render('<p id="theme" name="constructor" class="reading" style="position:fixed" data-theme-choice="light" onclick="alert(1)">Safe text</p><a href="https://example.com" id="filters" name="__proto__" onmouseover="alert(2)">Link</a>');
  assert.equal(elements(result, 'p')[0].textContent, 'Safe text');
  for (const node of nodes(result)) for (const key of Object.keys(node.attributes)) assert.ok(['href', 'rel', 'target', 'title', 'open', 'start', 'class'].includes(key), key);
  assert.deepEqual(elements(result, 'p')[0].attributes, {});
  assert.deepEqual(elements(result, 'a')[0].attributes, { href: 'https://example.com/', rel: 'noopener noreferrer', target: '_blank' });
});
test('links permit HTTPS only, reject credentials and normalize encoded malicious protocols safely', () => {
  for (const value of ['javascript:alert(1)', 'JaVaScRiPt:\nalert(1)', 'data:text/html,hi', 'vbscript:msgbox(1)', 'file:///secret', 'blob:https://example.com/id', 'http://example.com', 'https://user:password@example.com']) assert.equal(safeMarkdownURL(value, source), null, value);
  assert.equal(safeMarkdownURL('../issues/4', source), 'https://github.com/owner/project/issues/4');
  assert.equal(safeMarkdownURL('#discussion', source), 'https://github.com/owner/project/pull/3#discussion');
  const result = render('<a href="jav&#x61;script:alert(1)">Encoded</a><a href="java&#9;script:alert(2)">Control</a>[bad](javascript:alert%281%29)');
  assert.equal(elements(result, 'a').length, 0);
  assert.match(result.textContent, /Encoded/);
});
test('images are never instantiated or fetched and retain attribution and explicit safe attachment links', () => {
  const result = render('<a href="https://coderabbit.ai"><img src="https://example.invalid/banner.png" alt="CodeRabbit assistance" onerror="alert(1)"></a>\n\n![Evidence screenshot](https://example.invalid/evidence.png)\n\n<img src="javascript:alert(1)" alt="Unsafe image">');
  assert.equal(elements(result, 'img').length, 0);
  assert.match(result.textContent, /CodeRabbit assistance/);
  assert.match(result.textContent, /Evidence screenshot.*Open image/);
  assert.match(result.textContent, /Unsafe image/);
  const anchors = elements(result, 'a');
  assert.equal(anchors.length, 2);
  assert.equal(elements(anchors[0], 'a').length, 1, 'No nested anchor is inserted for a linked banner');
  for (const element of nodes(result)) assert.equal(element.attributes.src, undefined);
});
test('task lists stay readable but cannot become active form controls', () => {
  const result = render('- [x] Done\n- [ ] Pending\n');
  assert.match(result.textContent, /\[x\].*Done/);
  assert.match(result.textContent, /\[ \].*Pending/);
  assert.equal(elements(result, 'input').length, 0);
});
test('size, node and depth budgets produce explicit limits rather than empty success', () => {
  assert.match(render('a'.repeat(MARKDOWN_LIMITS.characters + 1)).textContent, /exceeds the formatting limit/);
  assert.match(render('<div>'.repeat(140) + 'deep' + '</div>'.repeat(140)).textContent, /Deeply nested content omitted/);
  assert.match(render('<i>x</i>'.repeat(6000)).textContent, /Formatting limit reached/);
});
test('malformed HTML repair cannot create foreign or active nodes', () => {
  const result = render('<table><tr><td><svg><foreignObject><img src="https://evil.invalid" onerror="alert(1)"></foreignObject></svg></td></tr></table><noscript><img src="https://evil.invalid/2"></noscript>');
  for (const node of nodes(result)) assert.ok(!['img', 'svg', 'foreignObject', 'script', 'iframe'].includes(node.localName));
  assert.ok(nodes(result).every(node => !Object.hasOwn(node.attributes, 'src')));
});
test('formatting does not mutate original body bytes or their SHA256', () => {
  const body = '<!-- exact -->\n**Reviewed**\n\n<details><summary>Bot attribution</summary>\n\nOriginal message.\n\n</details>';
  const hash = createHash('sha256').update(body).digest('hex');
  render(body);
  assert.equal(createHash('sha256').update(body).digest('hex'), hash);
  assert.ok(body.includes('<!-- exact -->'));
});
test('production renderer never uses an HTML injection sink or a resource-loading parser', async () => {
  const source = await readFile(new URL('../site/markdown.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|DOMParser|document\.write/);
  assert.match(source, /parseFragment\(marked\.parse/);
  assert.match(source, /namespaceURI/);
  assert.match(source, /createElement/);
});
