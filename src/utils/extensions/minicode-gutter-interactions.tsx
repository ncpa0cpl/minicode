import { Command, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { css } from "embedcss";
import { Diagnostic, diagnosticsFromViewUpdate } from "./minicode-lint-diagnostics";
import { allDiagnostics } from "./minicode-lint-marks";
import throttle from "lodash.throttle";
import { EditorSelection } from "@codemirror/state";

const Style = css`
  .minicode-lint-gutter-btn {
    padding: 0 0.3em;
    width: 2em;
    position: absolute;
    right: 0.6em;
    z-index: 10;
    background-color: transparent;
    border: unset;
    display: none;
    box-sizing: border-box;

    & svg {
      width: 100%;
      height: auto;
      color: var(--minicode-accent);
    }

    &.visible {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    &.upper {
      top: 0.1em;
    }

    &.lower {
      bottom: 0.6em;

      & svg {
        transform: rotate(180deg);
      }
    }
  }
`;

const noop = () => false;

export const LintGutterInteractable = ViewPlugin.fromClass(
  class LintGutterInteractable {
    upperBtn;
    lowerBtn;

    isUpperVisible = sig(false);
    isLowerVisible = sig(false);

    goToNextDiagnosticAbove = noop;
    goToNextDiagnosticBelow = noop;

    removeScrollListener;

    constructor(public _editorView: EditorView) {
      this.upperBtn = (
        <button
          class={{
            [Style.cname]: true,
            upper: true,
            visible: this.isUpperVisible,
          }}
          onclick={() => {
            this.goToNextDiagnosticAbove();
          }}
          title="Show previous diagnostic"
        >
          <BtnIcon />
        </button>
      ) as HTMLButtonElement;
      this.lowerBtn = (
        <button
          class={{
            [Style.cname]: true,
            lower: true,
            visible: this.isLowerVisible,
          }}
          onclick={() => {
            this.goToNextDiagnosticBelow();
          }}
          title="Show next diagnostic"
        >
          <BtnIcon />
        </button>
      ) as HTMLButtonElement;

      _editorView.dom.append(this.upperBtn);
      _editorView.dom.append(this.lowerBtn);

      const onscroll = throttle(
        () => {
          requestAnimationFrame(() => {
            const diagnostics = allDiagnostics(_editorView.state);
            this.recalculateVisibility(diagnostics);
          });
        },
        250,
        { leading: true, trailing: true },
      );

      _editorView.scrollDOM.addEventListener("scroll", onscroll);

      this.removeScrollListener = () => {
        _editorView.scrollDOM.removeEventListener("scroll", onscroll);
      };
    }

    recalculateVisibility(d: readonly Diagnostic[]) {
      const scrollTop = this._editorView.scrollDOM.scrollTop;
      const topBlock = this._editorView.lineBlockAtHeight(scrollTop);
      const bottomBlock = this._editorView.lineBlockAtHeight(
        scrollTop + this._editorView.scrollDOM.clientHeight,
      );
      const firstVisibleLine = this._editorView.state.doc.lineAt(topBlock.from);
      const lastVisibleLine = this._editorView.state.doc.lineAt(bottomBlock.from);

      let nextAbove:
        | {
            line: number;
            diagnostic: Diagnostic;
          }
        | undefined;
      let nextBelow:
        | {
            line: number;
            diagnostic: Diagnostic;
          }
        | undefined;

      for (let i = 0; i < d.length; i++) {
        const diag = d[i]!;

        const startLine = this._editorView.state.doc.lineAt(diag.from);
        const endLine = this._editorView.state.doc.lineAt(diag.to);

        if (
          startLine.number >= firstVisibleLine.number &&
          endLine.number <= lastVisibleLine.number
        ) {
          continue;
        }

        if (startLine.number < firstVisibleLine.number) {
          if (!nextAbove || startLine.number > nextAbove.line) {
            nextAbove = {
              diagnostic: diag,
              line: startLine.number,
            };
          }
        }

        if (endLine.number > lastVisibleLine.number) {
          if (!nextBelow || startLine.number < nextBelow.line) {
            nextBelow = {
              diagnostic: diag,
              line: startLine.number,
            };
          }
        }
      }

      if (nextAbove) {
        this.isUpperVisible.dispatch(true);
        this.goToNextDiagnosticAbove = () => {
          return this.goToDiagnostic(nextAbove);
        };
      } else {
        this.isUpperVisible.dispatch(false);
        this.goToNextDiagnosticAbove = noop;
      }

      if (nextBelow) {
        this.isLowerVisible.dispatch(true);
        this.goToNextDiagnosticBelow = () => {
          return this.goToDiagnostic(nextBelow);
        };
      } else {
        this.isLowerVisible.dispatch(false);
        this.goToNextDiagnosticBelow = noop;
      }
    }

    goToDiagnostic(target: { line: number; diagnostic: Diagnostic }) {
      const line = this._editorView.state.doc.line(target.line);
      this._editorView.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
      this._editorView.focus();
      this._editorView.dispatch({
        selection: EditorSelection.cursor(target.diagnostic.to),
      });
      return true;
    }

    findNextDiagnostic(): { line: number; diagnostic: Diagnostic } | null {
      let diagnostics = allDiagnostics(this._editorView.state);
      const cursorPos = this._editorView.state.selection.main.to;

      diagnostics = diagnostics.toSorted((a, b) => {
        return a.from - b.from;
      });

      for (let i = 0; i < diagnostics.length; i++) {
        const diag = diagnostics[i]!;

        if (diag.to > cursorPos) {
          const startLine = this._editorView.state.doc.lineAt(diag.from);
          return {
            diagnostic: diag,
            line: startLine.number,
          };
        }
      }

      return null;
    }

    findPrevDiagnostic(): { line: number; diagnostic: Diagnostic } | null {
      let diagnostics = allDiagnostics(this._editorView.state);
      const cursorPos = this._editorView.state.selection.main.to;

      diagnostics = diagnostics.toSorted((a, b) => {
        return a.from - b.from;
      });

      for (let i = diagnostics.length - 1; i >= 0; i--) {
        const diag = diagnostics[i]!;

        if (diag.to < cursorPos) {
          const startLine = this._editorView.state.doc.lineAt(diag.from);
          return {
            diagnostic: diag,
            line: startLine.number,
          };
        }
      }

      return null;
    }

    update(update: ViewUpdate) {
      const diagnostics = diagnosticsFromViewUpdate(update);
      if (diagnostics != null) {
        requestAnimationFrame(() => {
          this.recalculateVisibility(diagnostics);
        });
      }
    }

    destroy() {
      this.upperBtn.remove();
      this.lowerBtn.remove();
      this.removeScrollListener();
    }
  },
);

export const showNextDiagnostic: Command = (view) => {
  const lintGutter = view.plugin(LintGutterInteractable);
  if (lintGutter) {
    const d = lintGutter.findNextDiagnostic();
    if (d) return lintGutter.goToDiagnostic(d);
  }
  return false;
};

export const showPrevDiagnostic: Command = (view) => {
  const lintGutter = view.plugin(LintGutterInteractable);
  if (lintGutter) {
    const d = lintGutter.findPrevDiagnostic();
    if (d) return lintGutter.goToDiagnostic(d);
  }
  return false;
};

function BtnIcon() {
  return (
    <svg
      attribute:width="1em"
      attribute:height="1em"
      attribute:xmlns="http://www.w3.org/2000/svg"
      attribute:viewBox="0 0 10.6 10.6"
    >
      <g attribute:transform="translate(-0.12653091,-0.03109297)">
        <line
          attribute:x1="5.4926839"
          attribute:x2="9.5695019"
          attribute:y1="2.9416032"
          attribute:y2="5.1402121"
          attribute:stroke="currentColor"
          attribute:stroke-width="1.30885"
          attribute:stroke-linecap="round"
        />
        <line
          attribute:x1="5.3437119"
          attribute:x2="1.2668933"
          attribute:y1="2.9115963"
          attribute:y2="5.1102052"
          attribute:stroke="currentColor"
          attribute:stroke-width="1.30885"
          attribute:stroke-linecap="round"
        />
      </g>
      <g attribute:transform="translate(-0.12653091,2.7666876)">
        <line
          attribute:x1="5.4926839"
          attribute:x2="9.5695019"
          attribute:y1="2.9416032"
          attribute:y2="5.1402121"
          attribute:stroke="currentColor"
          attribute:stroke-width="1.30885"
          attribute:stroke-linecap="round"
        />
        <line
          attribute:x1="5.3437119"
          attribute:x2="1.2668933"
          attribute:y1="2.9115963"
          attribute:y2="5.1102052"
          attribute:stroke="currentColor"
          attribute:stroke-width="1.30885"
          attribute:stroke-linecap="round"
        />
      </g>
    </svg>
  );
}
