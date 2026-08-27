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

import { EditorView, showTooltip, gutter, GutterMarker, Tooltip } from "@codemirror/view";
import {
  Text,
  StateEffect,
  StateField,
  Extension,
  Transaction,
  RangeSet,
  Range,
} from "@codemirror/state";
import {
  Diagnostic,
  Severity,
  setDiagnosticsEffect,
  maxSeverity,
  diagnosticsTooltip,
} from "./minicode-lint-diagnostics";

function hideTooltip(tr: Transaction, tooltip: Tooltip) {
  let from = tooltip.pos,
    to = tooltip.end || from;
  let line = tr.startState.doc.lineAt(tooltip.pos);
  return !!(
    tr.effects.some((e) => e.is(setDiagnosticsEffect)) ||
    tr.changes.touchesRange(line.from, Math.max(line.to, to))
  );
}

class LintGutterMarker extends GutterMarker {
  severity: Severity;
  constructor(readonly diagnostics: readonly Diagnostic[]) {
    super();
    this.severity = maxSeverity(diagnostics);
  }

  toDOM(view: EditorView) {
    let icon: Element;
    switch (this.severity) {
      case "error":
        icon = <ErrorMarker />;
        break;
      case "warning":
        icon = <WarningMarker />;
        break;
      case "info":
        icon = <InfoMarker />;
        break;
      case "hint":
        icon = <></>;
        break;
    }

    return (
      <div
        class="cm-lint-marker"
        onmouseover={(ev) => {
          if (this.diagnostics.length) {
            gutterMarkerMouseOver(view, ev.target, this.diagnostics);
          }
        }}
      >
        {icon}
      </div>
    );
  }
}

const enum Hover {
  Time = 300,
  Margin = 10,
}

function trackHoverOn(view: EditorView, marker: HTMLElement) {
  let mousemove = (event: MouseEvent) => {
    let rect = marker.getBoundingClientRect();
    if (
      event.clientX > rect.left - Hover.Margin &&
      event.clientX < rect.right + Hover.Margin &&
      event.clientY > rect.top - Hover.Margin &&
      event.clientY < rect.bottom + Hover.Margin
    )
      return;
    for (let target = event.target as Node | null; target; target = target.parentNode) {
      if (target.nodeType == 1 && (target as HTMLElement).classList.contains("cm-tooltip-lint"))
        return;
    }
    window.removeEventListener("mousemove", mousemove);
    if (view.state.field(lintGutterTooltip))
      view.dispatch({ effects: setLintGutterTooltip.of(null) });
  };
  window.addEventListener("mousemove", mousemove);
}

function gutterMarkerMouseOver(
  view: EditorView,
  marker: HTMLElement,
  diagnostics: readonly Diagnostic[],
) {
  function hovered() {
    let line = view.elementAtHeight(marker.getBoundingClientRect().top + 5 - view.documentTop);
    const linePos = view.coordsAtPos(line.from);
    if (linePos) {
      view.dispatch({
        effects: setLintGutterTooltip.of({
          pos: line.from,
          above: false,
          clip: false,
          create() {
            return {
              dom: diagnosticsTooltip(view, diagnostics),
              getCoords: () => marker.getBoundingClientRect(),
            };
          },
        }),
      });
    }
    marker.onmouseout = marker.onmousemove = null;
    trackHoverOn(view, marker);
  }

  let hoverTimeout = setTimeout(hovered, Hover.Time);
  marker.onmouseout = () => {
    clearTimeout(hoverTimeout);
    marker.onmouseout = marker.onmousemove = null;
  };
  marker.onmousemove = () => {
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(hovered, Hover.Time);
  };
}

function markersForDiagnostics(doc: Text, diagnostics: readonly Diagnostic[]) {
  let byLine: { [line: number | string]: Diagnostic[] } = Object.create(null);
  for (let diagnostic of diagnostics) {
    // Clamp to the document — diagnostics may reference positions past
    // its end (e.g. when the document shrank since they were computed).
    let from = Math.max(0, Math.min(diagnostic.from, doc.length));
    let line = doc.lineAt(from);
    (byLine[line.from] || (byLine[line.from] = [])).push(diagnostic);
  }
  let markers: Range<GutterMarker>[] = [];
  for (let line of Object.keys(byLine)) {
    markers.push(new LintGutterMarker(byLine[line]!).range(+line));
  }
  return RangeSet.of(markers, true);
}

const lintGutterExtension = gutter({
  class: "minicode-cm-lint-gutter",
  side: "after",
  markers: (view) => view.state.field(lintGutterMarkers),
  widgetMarker: (view, widget, block) => {
    let diagnostics: Diagnostic[] = [];
    view.state.field(lintGutterMarkers).between(block.from, block.to, (from, to, value) => {
      if (from > block.from && from < block.to)
        diagnostics.push(...(value as LintGutterMarker).diagnostics);
    });
    return diagnostics.length ? new LintGutterMarker(diagnostics) : null;
  },
});

const lintGutterMarkers = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(markers, tr) {
    markers = markers.map(tr.changes);
    for (let effect of tr.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        markers = markersForDiagnostics(tr.state.doc, effect.value.slice(0));
      }
    }
    return markers;
  },
});

const setLintGutterTooltip = StateEffect.define<Tooltip | null>();

const lintGutterTooltip = StateField.define<Tooltip | null>({
  create() {
    return null;
  },
  update(tooltip, tr) {
    if (tooltip && tr.docChanged)
      tooltip = hideTooltip(tr, tooltip)
        ? null
        : { ...tooltip, pos: tr.changes.mapPos(tooltip.pos) };
    return tr.effects.reduce((t, e) => (e.is(setLintGutterTooltip) ? e.value : t), tooltip);
  },
  provide: (field) => showTooltip.from(field),
});

/// Returns an extension that installs a gutter showing markers for
/// each line that has diagnostics, which can be hovered over to see
/// the diagnostics.
export function lintGutter(): Extension {
  return [lintGutterMarkers, lintGutterExtension, lintGutterTooltip];
}

function InfoMarker() {
  return (
    <svg
      attribute:width="1em"
      attribute:height="1em"
      attribute:xmlns="http://www.w3.org/2000/svg"
      attribute:viewBox="0 0 40 40"
    >
      <path
        attribute:fill="var(--minicode-info)"
        attribute:stroke="var(--minicode-info)"
        attribute:stroke-width="6"
        attribute:stroke-linejoin="round"
        attribute:d="M5 5L35 5L35 35L5 35Z"
      />
    </svg>
  );
}

function WarningMarker() {
  return (
    <svg
      attribute:width="1em"
      attribute:height="1em"
      attribute:xmlns="http://www.w3.org/2000/svg"
      attribute:viewBox="0 0 40 40"
    >
      <circle
        attribute:cx="20"
        attribute:cy="20"
        attribute:r="15"
        attribute:fill="var(--minicode-warning)"
        attribute:stroke="var(--minicode-warning)"
        attribute:stroke-width="6"
      />
    </svg>
  );
}

function ErrorMarker() {
  return (
    <svg
      attribute:width="1em"
      attribute:height="1em"
      attribute:xmlns="http://www.w3.org/2000/svg"
      attribute:viewBox="0 0 40 40"
    >
      <circle
        attribute:cx="20"
        attribute:cy="20"
        attribute:r="15"
        attribute:fill="var(--minicode-error)"
        attribute:stroke="var(--minicode-error)"
        attribute:stroke-width="6"
      />
    </svg>
  );
}
