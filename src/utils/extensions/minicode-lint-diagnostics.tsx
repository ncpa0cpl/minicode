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

import { EditorView, ViewUpdate } from "@codemirror/view";
import { StateEffect, TransactionSpec } from "@codemirror/state";

export type Severity = "hint" | "info" | "warning" | "error";

/// Describes a problem or hint for a piece of code.
export interface Diagnostic {
  /// The start position of the relevant text.
  from: number;
  /// The end position. May be equal to `from`, though actually
  /// covering text is preferable.
  to: number;
  /// The severity of the problem. This will influence how it is
  /// displayed.
  severity: Severity;
  /// An optional source string indicating where the diagnostic is
  /// coming from. You can put the name of your linter here, if
  /// applicable.
  source?: string;
  /// The message associated with this diagnostic.
  message: string;
  /// An optional custom rendering function that displays the message
  /// as a DOM node.
  renderMessage?: (view: EditorView) => Element;
}

/// The state effect that updates the set of active diagnostics. Can
/// be useful when writing an extension that needs to track these.
export const setDiagnosticsEffect = StateEffect.define<readonly Diagnostic[]>();

/// Returns a transaction spec which updates the current set of
/// diagnostics.
export function setDiagnostics(diagnostics: readonly Diagnostic[]): TransactionSpec {
  return { effects: setDiagnosticsEffect.of(diagnostics) };
}

export function diagnosticsFromViewUpdate(update: ViewUpdate) {
  const diagnostics: Diagnostic[] = [];
  let hasDiagnosticsEffect = false;

  for (const tx of update.transactions) {
    for (const effect of tx.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        diagnostics.push(...effect.value.values());
        hasDiagnosticsEffect = true;
      }
    }
  }

  if (!hasDiagnosticsEffect) {
    return null;
  }

  return diagnostics;
}

export function severityWeight(sev: Severity) {
  return sev == "error" ? 4 : sev == "warning" ? 3 : sev == "info" ? 2 : 1;
}

export function maxSeverity(diagnostics: readonly Diagnostic[]) {
  let sev: Severity = "hint",
    weight = 1;
  for (let d of diagnostics) {
    let w = severityWeight(d.severity);
    if (w > weight) {
      weight = w;
      sev = d.severity;
    }
  }
  return sev;
}

export function renderDiagnostic(view: EditorView, diagnostic: Diagnostic) {
  return (
    <li class={"cm-diagnostic cm-diagnostic-" + diagnostic.severity}>
      <span class="cm-diagnosticText">
        {diagnostic.renderMessage ? diagnostic.renderMessage(view) : diagnostic.message}
      </span>
      <div class="cm-diagnosticSource">{diagnostic.source}</div>
    </li>
  );
}

export function diagnosticsTooltip(view: EditorView, diagnostics: readonly Diagnostic[]) {
  return (
    <ul class="cm-tooltip-lint">{diagnostics.map((d) => renderDiagnostic(view, d))}</ul>
  ) as HTMLUListElement;
}
