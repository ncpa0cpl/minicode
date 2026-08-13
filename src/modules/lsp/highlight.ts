import type { HighlightStyle } from "@codemirror/language";

export type TokenStyle = {
  color?: string;
  fontStyle?: string;
  fontWeight?: string;
  backgroundColor?: string;
};

export function styleForTag(highlightStyle: HighlightStyle, tagName: string): TokenStyle | null {
  const specs = (highlightStyle as unknown as { specs?: readonly unknown[] }).specs;
  if (!specs) return null;
  for (const spec of specs) {
    const s = spec as {
      tag?: { name?: string; set?: Array<{ name?: string }> };
      color?: string;
      fontStyle?: string;
      fontWeight?: string;
    };
    if (s.tag) {
      const names = s.tag.set ? s.tag.set.map((tg) => tg.name) : [s.tag.name];
      if (names.includes(tagName)) {
        return { color: s.color, fontStyle: s.fontStyle, fontWeight: s.fontWeight };
      }
    }
  }
  return null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TS_KEYWORDS = new Set([
  "abstract",
  "any",
  "as",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "is",
  "keyof",
  "let",
  "module",
  "namespace",
  "never",
  "new",
  "null",
  "number",
  "of",
  "private",
  "protected",
  "public",
  "readonly",
  "require",
  "return",
  "set",
  "static",
  "string",
  "super",
  "switch",
  "symbol",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unknown",
  "void",
  "while",
  "yield",
  "infer",
  "extends",
  "satisfies",
  "const",
  "asserts",
]);

const TS_TYPE_KEYWORDS = new Set(["type", "interface", "class", "enum", "namespace", "module"]);

type Token = {
  type:
    | "keyword"
    | "typeName"
    | "string"
    | "number"
    | "comment"
    | "function"
    | "operator"
    | "punctuation"
    | "property"
    | "variable"
    | "text";
  value: string;
};

function tokenizeCode(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    const ch = code[i];
    const remaining = code.slice(i);

    // Comments
    if (remaining.startsWith("//")) {
      const end = code.indexOf("\n", i);
      const endIdx = end === -1 ? code.length : end;
      tokens.push({ type: "comment", value: code.slice(i, endIdx) });
      i = endIdx;
      continue;
    }
    if (remaining.startsWith("/*")) {
      const end = code.indexOf("*/", i + 2);
      const endIdx = end === -1 ? code.length : end + 2;
      tokens.push({ type: "comment", value: code.slice(i, endIdx) });
      i = endIdx;
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        if (code[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", value: code.slice(i, Math.min(j + 1, code.length)) });
      i = j + 1;
      continue;
    }

    // Numbers
    if (ch && /[0-9]/.test(ch)) {
      let j = i;
      while (j < code.length && /[0-9a-fx._e+\-]/i.test(code[j]!)) j++;
      tokens.push({ type: "number", value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers
    if (ch && /[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j]!)) j++;
      const word = code.slice(i, j);

      // Check if followed by ( for function call
      const nextCh = code[j];
      const isCall = nextCh === "(";

      // Check if it's a type (starts with uppercase or is a type keyword context)
      const isTypeStart = /^[A-Z]/.test(word);
      const isTypeKeyword = TS_TYPE_KEYWORDS.has(word);

      if (TS_KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (isTypeStart || isTypeKeyword) {
        tokens.push({ type: "typeName", value: word });
      } else if (isCall) {
        tokens.push({ type: "function", value: word });
      } else {
        tokens.push({ type: "variable", value: word });
      }
      i = j;
      continue;
    }

    // Operators and punctuation
    if (ch && /[+\-*/%=<>!&|^~?:]/.test(ch)) {
      let j = i;
      while (j < code.length && /[+\-*/%=<>!&|^~?:]/.test(code[j]!)) j++;
      tokens.push({ type: "operator", value: code.slice(i, j) });
      i = j;
      continue;
    }

    if (ch && /[{}()[\];,.]/.test(ch)) {
      tokens.push({ type: "punctuation", value: ch });
      i++;
      continue;
    }

    // Whitespace and other text
    let j = i;
    while (j < code.length && !/[a-zA-Z0-9_$"'`+\-*/%=<>!&|^~?:{}()[\];,.]/.test(code[j]!)) j++;
    if (j === i) j++;
    tokens.push({ type: "text", value: code.slice(i, j) });
    i = j;
  }

  return tokens;
}

const TAG_MAP: Record<Token["type"], string> = {
  keyword: "keyword",
  typeName: "typeName",
  string: "string",
  number: "number",
  comment: "comment",
  function: "function(variableName)",
  operator: "operator",
  punctuation: "punctuation",
  property: "propertyName",
  variable: "variableName",
  text: "",
};

function getTokenStyle(
  highlightStyle: HighlightStyle,
  tokenType: Token["type"],
): TokenStyle | null {
  const tagName = TAG_MAP[tokenType];
  if (!tagName) return null;
  return styleForTag(highlightStyle, tagName);
}

function styleToCss(style: TokenStyle): string {
  const parts: string[] = [];
  if (style.color) parts.push(`color:${style.color}`);
  if (style.fontStyle) parts.push(`font-style:${style.fontStyle}`);
  if (style.fontWeight) parts.push(`font-weight:${style.fontWeight}`);
  if (style.backgroundColor) parts.push(`background:${style.backgroundColor}`);
  return parts.join(";");
}

export function highlightCodeToHtml(code: string, highlightStyle: HighlightStyle): string {
  const tokens = tokenizeCode(code);
  let html = "";

  for (const token of tokens) {
    const style = getTokenStyle(highlightStyle, token.type);
    if (style) {
      const css = styleToCss(style);
      html += `<span style="${css}">${escapeHtml(token.value)}</span>`;
    } else {
      html += escapeHtml(token.value);
    }
  }

  return html;
}

const SIMPLE_TYPE_RE =
  /^(void|null|undefined|any|number|string|bigint|symbol|boolean|readonly|typeof|never|unknown)(\[\])?$/;

function isSimpleType(type: string): boolean {
  return SIMPLE_TYPE_RE.test(type.trim());
}

function addMissingParentheses(type: string): string {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const inv: Record<string, string> = { ")": "(", "}": "{", "]": "[" };
  const openStack: string[] = [];

  for (const ch of type) {
    if (ch in pairs) {
      openStack.push(ch);
    } else if (ch in inv) {
      if (openStack.length > 0 && pairs[openStack[openStack.length - 1]!] === ch) {
        openStack.pop();
      } else {
        openStack.push(inv[ch]!);
      }
    }
  }

  let result = type;
  if (openStack.length > 0) {
    result += "\n...";
    for (const open of openStack.reverse()) {
      result += pairs[open];
    }
  }
  return result;
}

function formatType(type: string): string {
  const trimmed = type.trim();
  if (isSimpleType(trimmed)) return trimmed;

  try {
    let t = trimmed;
    t = t.replace(/\.\.\.\s*\d+\s*more\s*\.\.\./g, "/* N more */");
    t = t.replace(/\.\.\.;/g, ";");
    t = addMissingParentheses(t);
    return t;
  } catch {
    return trimmed;
  }
}

export function prettifyTypeBlock(
  prefix: string,
  type: string,
  highlightStyle: HighlightStyle,
): string {
  const trimmed = type.trim();

  if (isSimpleType(trimmed)) {
    const highlighted = highlightCodeToHtml(trimmed, highlightStyle);
    return `${prefix} <code class="lsp-type">${highlighted}</code>`;
  }

  const formatted = formatType(trimmed);
  const isMultiLine = formatted.includes("\n");
  const highlighted = highlightCodeToHtml(formatted, highlightStyle);

  if (isMultiLine) {
    return `${prefix}:<pre class="lsp-codeblock">${highlighted}</pre>`;
  }
  return `${prefix} <code class="lsp-type">${highlighted}</code>`;
}

export function prettifyErrorMessage(message: string, highlightStyle: HighlightStyle): string {
  let result = escapeHtml(message);

  const rules: Array<{
    pattern: RegExp;
    replace: (match: string, ...groups: string[]) => string;
  }> = [
    {
      pattern: /is missing the following properties from type '([^']+)'/g,
      replace: (_m, type) =>
        `is missing the following properties from type ${prettifyTypeBlock("", type, highlightStyle)}`,
    },
    {
      pattern: /types '([^']+)' and '([^']+)'/g,
      replace: (_m, type1, type2) =>
        `types ${prettifyTypeBlock("", type1, highlightStyle)} and ${prettifyTypeBlock("", type2, highlightStyle)}`,
    },
    {
      pattern: /type annotation must be '([^']+)' or '([^']+)'/g,
      replace: (_m, type1, type2) =>
        `type annotation must be ${prettifyTypeBlock("", type1, highlightStyle)} or ${prettifyTypeBlock("", type2, highlightStyle)}`,
    },
    {
      pattern: /Overload \d+ of \d+, '([^']+)'/g,
      replace: (_m, type) => `Overload: ${prettifyTypeBlock("", type, highlightStyle)}`,
    },
    {
      pattern:
        /(type|type alias|interface|class|method's|return type|subtype of constraint) '([^']+)'/g,
      replace: (_m, prefix, type) => prettifyTypeBlock(prefix, type, highlightStyle),
    },
    {
      pattern: /'([^']{2,})' (is not assignable to|is missing|does not exist|cannot be)/g,
      replace: (_m, type, rest) => `${prettifyTypeBlock("", type, highlightStyle)} ${rest}`,
    },
    {
      pattern: /\s'([^']{2,})'(?=[\s.,;:!?)]|$)/g,
      replace: (_m, type) => ` ${prettifyTypeBlock("", type, highlightStyle)}`,
    },
  ];

  for (const rule of rules) {
    result = result.replace(rule.pattern, (...args) => rule.replace(...args));
  }

  return result;
}
