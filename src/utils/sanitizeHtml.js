const { JSDOM } = require("jsdom");
const DOMPurify = require("dompurify")(new JSDOM("").window);

const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "em", "u", "s", "span", "br", "hr",
  "blockquote", "pre", "code",
  "a", "ul", "ol", "li",
  "sub", "sup", "mark", "small", "del", "ins",
  "svg", "path",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "class", "style",
  "spellcheck", "data-language", "dir",
  "xmlns", "width", "height", "viewbox", "fill", "d",
];

const URI_REGEXP = /^(?:(?:(?:https?|mailto|ftp):)|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;

/**
 * Sanitize HTML content against XSS attacks.
 * This is the server-side trust boundary — the definitive sanitization layer.
 *
 * @param {string} html - Raw HTML content to sanitize
 * @returns {string} - Sanitized HTML string
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: ["data-language", "data-editor-arrow"],
    ALLOWED_URI_REGEXP: URI_REGEXP,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "onsubmit"],
  });
}

module.exports = { sanitizeHtml };