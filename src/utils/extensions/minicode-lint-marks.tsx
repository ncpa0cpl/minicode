// Adapted from @codemirror/lint
// Copyright (C) 2018-2024 Marijn Haverbeke and others
// MIT License: https://opensource.org/licenses/MIT
//
// MIT License
//
// Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//
// Source: https://code.haverbeke.berlin/codemirror/lint/src/commit/dc7cf103c2f7730b93c52d7350955c43bbb58f66/LICENSE

import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
  hoverTooltip,
  Tooltip,
} from "@codemirror/view";
import { StateField, Extension, Transaction, Text, EditorState } from "@codemirror/state";
import {
  Diagnostic,
  Severity,
  setDiagnosticsEffect,
  diagnosticsTooltip,
} from "./minicode-lint-diagnostics";

class DiagnosticWidget extends WidgetType {
  constructor(readonly sev: Severity) {
    super();
  }

  eq(other: DiagnosticWidget) {
    return other.sev == this.sev;
  }

  toDOM() {
    return (<span class={"cm-lintPoint cm-lintPoint-" + this.sev}></span>) as HTMLSpanElement;
  }
}

function decorationsForDiagnostics(doc: Text, diagnostics: readonly Diagnostic[]): DecorationSet {
  let ranges = diagnostics.map((d) => {
    // Clamp to the document — diagnostics may reference positions past
    // its end (e.g. when the document shrank since they were computed).
    let from = Math.max(0, Math.min(d.from, doc.length));
    let to = Math.max(from, Math.min(d.to, doc.length));
    return from == to
      ? Decoration.widget({
          widget: new DiagnosticWidget(d.severity),
          diagnostics: [d],
        }).range(from)
      : Decoration.mark({
          class: "cm-lintRange cm-lintRange-" + d.severity,
          diagnostics: [d],
        }).range(from, to);
  });
  return Decoration.set(ranges, true);
}

const lintMarksField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (let effect of tr.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        return decorationsForDiagnostics(tr.state.doc, effect.value);
      }
    }
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function lintTooltip(view: EditorView, pos: number, side: -1 | 1) {
  let diagnostics = view.state.field(lintMarksField);
  let found: readonly Diagnostic[] | undefined,
    start = -1,
    end = -1;
  diagnostics.between(pos - (side < 0 ? 1 : 0), pos + (side > 0 ? 1 : 0), (from, to, { spec }) => {
    if (
      pos >= from &&
      pos <= to &&
      (from == to || ((pos > from || side > 0) && (pos < to || side < 0)))
    ) {
      found = spec.diagnostics;
      start = from;
      end = to;
      return false;
    }
  });

  if (!found) return null;

  return {
    pos: start,
    end: end,
    above: true,
    create() {
      return { dom: diagnosticsTooltip(view, found!) };
    },
  };
}

function hideTooltip(tr: Transaction, tooltip: Tooltip) {
  let from = tooltip.pos,
    to = tooltip.end || from;
  let line = tr.startState.doc.lineAt(tooltip.pos);
  return !!(
    tr.effects.some((e) => e.is(setDiagnosticsEffect)) ||
    tr.changes.touchesRange(line.from, Math.max(line.to, to))
  );
}

/// Returns an extension that displays diagnostics as squiggly
/// underlines in the editor text, with hover tooltips showing the
/// diagnostic messages.
export function lintMarks(): Extension {
  return [lintMarksField, hoverTooltip(lintTooltip, { hideOn: hideTooltip })];
}

export function allDiagnostics(state: EditorState): readonly Diagnostic[] {
  let result: Diagnostic[] = [];
  state.field(lintMarksField, false)?.between(0, state.doc.length, (from, to, { spec }) => {
    result.push(...spec.diagnostics);
  });
  return result;
}
