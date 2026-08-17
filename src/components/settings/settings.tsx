import { css } from "embedcss";
import { CloseIcon } from "../icons/close";
import { MiniCodeContext } from "../../context";
import { sig, Signal } from "@ncpa0cpl/vanilla-jsx/signals";

const SettingsStyles = css`
  .settings-overlay {
    position: fixed;
    top: 2.62em;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 500;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    padding: 0.92em;
    box-sizing: border-box;
    user-select: none;

    & .settings-panel {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      background: var(--minicode-bg, #1b1f27);
      border: 1px solid var(--minicode-border, #2a2f3a);
      border-radius: 0.62em;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
      color: var(--minicode-fg, #cdd3de);
      font-family: var(--minicode-font, ui-monospace, monospace);
      font-size: 1em;
      overflow: hidden;
    }

    & .settings-header {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.62em;
      flex: 0 0 auto;
      padding: 0.77em 0.92em;
      border-bottom: 1px solid var(--minicode-border, #2a2f3a);
      background: var(--minicode-bg, #1b1f27);
    }

    & .settings-title {
      font-weight: 600;
      color: var(--minicode-fg, #cdd3de);
      margin-right: 0.31em;
    }

    & .settings-spacer {
      flex: 1 1 auto;
    }

    & .settings-close {
      --btn-size: 2em;
      padding: unset;
      height: var(--btn-size);
      min-width: var(--btn-size);
      display: flex;
      justify-content: center;
      align-items: center;
      border: 1px solid var(--minicode-border, #2a2f3a);
      border-radius: 0.31em;
      background: transparent;
      color: var(--minicode-fg, #cdd3de);
      font: inherit;
      cursor: pointer;
      outline: none;

      &:hover {
        background: var(--minicode-hover, #232834);
      }
    }

    & .settings-table {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      margin: 1em;

      & .settings-setting {
        display: grid;
        grid-template-columns: minmax(12em, 25%) 1fr;
        padding: 0.75em;
        border-bottom: 1px solid var(--minicode-border, #2a2f3a);
      }
    }
  }
`;

export function Settings({ ctx }: { ctx: MiniCodeContext }) {
  const onClose = () => {
    ctx.settingsOpen.dispatch(false);
  };

  return (
    <div class={SettingsStyles}>
      <div class="settings-overlay">
        <div class="settings-panel">
          <div class="settings-header">
            <span class="settings-title">Settings</span>
            <div class="settings-spacer"></div>
            <button class="settings-close" onclick={onClose}>
              <CloseIcon />
            </button>
          </div>
          <div class="settings-table">
            <div class="settings-setting">
              <span>Minicode Scale</span>
              <MultiUnitFontSizeInput value={ctx.uiFontSize} />
            </div>
            <div class="settings-setting">
              <span>Editor Font Size</span>
              <MultiUnitFontSizeInput value={ctx.tabs.fontSize} />
            </div>
            <div class="settings-setting">
              <span>Terminal Font Size</span>
              <FontSizeInput
                initalValue={ctx.terminals.fontSize.get()}
                step={1}
                min={8}
                max={30}
                onChange={(f) => {
                  ctx.terminals.fontSize.dispatch(f);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FontSizeInputStyle = css`
  .font-size-input-container {
    display: flex;
    flex-direction: row;

    & input {
      font-size: 1em;
      background-color: var(--minicode-input-bg, #232834);
      color: var(--minicode-input-fg, #cdd3de);
      border: 1px solid var(--minicode-input-border, #2a2f3a);
      width: 4em;
      height: 2em;
      padding: 0px 0.6em;
      box-sizing: border-box;
      outline: none;

      &:focus {
        border-color: var(--minicode-input-focus, #4b9fff);
      }
    }

    & button {
      font-size: 1em;
      background-color: var(--minicode-input-bg, #232834);
      color: var(--minicode-input-fg, #cdd3de);
      border: 1px solid var(--minicode-input-border, #2a2f3a);
      outline: none;
      box-sizing: border-box;
      width: 2em;
      height: 2em;

      &:hover {
        background-color: var(--minicode-input-hover, #2c3344);
      }
    }
  }
`;

function FontSizeInput<T>(props: {
  initalValue: number | string;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
}) {
  const decrement = () => {
    let val = Number(input.value || props.initalValue);
    if (Number.isNaN(val)) {
      val = 0;
    }

    const nextVal = Math.max(Math.min(val - props.step, props.max), props.min);
    input.value = nextVal.toFixed(1);
    props.onChange(nextVal);
  };

  const increment = () => {
    let val = Number(input.value || props.initalValue);
    if (Number.isNaN(val)) {
      val = 0;
    }

    const nextVal = Math.max(Math.min(val + props.step, props.max), props.min);
    input.value = nextVal.toFixed(1);
    props.onChange(nextVal);
  };

  const handleChange = (ev: Event & { target: HTMLInputElement }) => {
    const value = ev.target.value;
    const valNumChars = value.replace(/[^\d.]/g, "");
    const parts = valNumChars.split(".");

    let numValue = 0;

    if (parts.length === 1) {
      numValue = Number(parts[0]);
    } else if (parts.length === 2) {
      numValue = Number(parts.join("."));
    } else if (parts.length > 2) {
      numValue = Number(`${parts[0]}.${parts.slice(1).join("")}`);
    }

    if (Number.isNaN(numValue)) {
      numValue = 0;
    }

    numValue = Math.max(Math.min(numValue, props.max), props.min);

    if (numValue.toFixed(1) !== value) {
      ev.target.value = numValue.toFixed(1);
    }

    props.onChange(numValue);
  };

  const input = (
    <input
      defaultValue={
        typeof props.initalValue === "number"
          ? props.initalValue.toFixed(1)
          : props.initalValue.replace(/[^\d.]/g, "")
      }
      onchange={handleChange}
    />
  ) as HTMLInputElement;

  return (
    <div class={FontSizeInputStyle}>
      {input}
      <button onclick={decrement}>-</button>
      <button onclick={increment}>+</button>
    </div>
  );
}

const MufsiStyle = css`
  .multi-unit-fsinp {
    display: flex;
    flex-direction: row;
    gap: 0.5em;
  }
`;

function MultiUnitFontSizeInput(props: { value: Signal<string> }) {
  const unit = sig<"em" | "px">(props.value.get().endsWith("px") ? "px" : "em");

  return (
    <div class={MufsiStyle}>
      {unit.derive((unit) => {
        switch (unit) {
          case "em":
            return (
              <FontSizeInput
                initalValue={props.value.get()}
                step={0.1}
                min={0.6}
                max={4}
                onChange={(f) => {
                  props.value.dispatch(f.toFixed(1) + "em");
                }}
              />
            );
          case "px":
            return (
              <FontSizeInput
                initalValue={props.value.get()}
                step={1}
                min={8}
                max={30}
                onChange={(f) => {
                  props.value.dispatch(f.toFixed(1) + "px");
                }}
              />
            );
        }
      })}
      <Select
        initialValue={props.value.get().endsWith("px") ? "px" : "em"}
        options={["px", "em"]}
        onChange={(opt) => {
          props.value.dispatch((current) => {
            const currentNum = Number(current.replace(/[^\d.]/g, ""));
            switch (opt) {
              case "em":
                return `${(currentNum / 16).toFixed(1)}em`;
              case "px":
                return `${(currentNum * 16).toFixed(0)}px`;
            }
            return current;
          });
          unit.dispatch(opt as "px" | "em");
        }}
      />
    </div>
  );
}

const SelectStyles = css`
  .select-container {
    background-color: var(--minicode-input-bg, #232834);
    color: var(--minicode-input-fg, #cdd3de);
    border: 1px solid var(--minicode-input-border, #2a2f3a);
    position: relative;
    height: 2em;
    padding: 0em 0.6em;

    &:hover {
      background-color: var(--minicode-input-hover, #2c3344);
    }

    & .select-preview {
      line-height: 1.8em;
      cursor: pointer;
    }

    & .select-popover-list {
      display: none;
      position: absolute;
      top: 2em;
      left: 0;
      right: 0;
      z-index: 5;

      &.expanded {
        display: flex;
        flex-direction: column;
      }

      & .select-button {
        font-size: 0.95em;
        background-color: var(--minicode-input-bg, #232834);
        color: var(--minicode-input-fg, #cdd3de);
        border: 1px solid var(--minicode-input-border, #2a2f3a);
        outline: none;
        box-sizing: border-box;
        height: 2em;
        z-index: 4;

        &:hover {
          background-color: var(--minicode-input-hover, #2c3344);
        }
      }

      & .select-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0);
        z-index: 3;
      }
    }
  }
`;

function Select(props: {
  options: Array<string>;
  initialValue: string;
  onChange: (v: string) => void;
}) {
  const expanded = sig(false);
  const selected = sig(props.initialValue);

  const clickHandler = (opt: string) => () => {
    props.onChange(opt);
    selected.dispatch(opt);
    expanded.dispatch(false);
  };

  return (
    <div class={SelectStyles}>
      <span class="select-preview" onclick={() => expanded.dispatch((e) => !e)}>
        {selected}
      </span>
      <div
        class={{
          "select-popover-list": true,
          expanded,
        }}
      >
        {props.options.map((opt) => (
          <button class="select-button" onclick={clickHandler(opt)}>
            {opt}
          </button>
        ))}
        <div class="select-backdrop" onclick={() => expanded.dispatch(false)}></div>
      </div>
    </div>
  );
}
