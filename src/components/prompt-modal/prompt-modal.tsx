import { css } from "embedcss";

const PromptModalStyles = css`
  .prompt-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    user-select: none;
  }

  .prompt-modal {
    display: flex;
    flex-direction: column;
    min-width: 320px;
    max-width: 90vw;
    background: var(--minicode-bg, #1b1f27);
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    padding: 16px;
    font-family: var(--minicode-font, ui-monospace, monospace);
    font-size: 13px;
    color: var(--minicode-fg, #cdd3de);
  }

  .prompt-title {
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--minicode-fg, #cdd3de);
    user-select: none;
  }

  .prompt-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    background: var(--minicode-editor-bg, #14171d);
    color: var(--minicode-editor-fg, #cdd3de);
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 4px;
    font: inherit;
    outline: none;

    &:focus {
      border-color: var(--minicode-accent, #4b9fff);
    }
  }

  .prompt-actions {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .prompt-btn {
    padding: 6px 14px;
    border: 1px solid var(--minicode-border, #2a2f3a);
    border-radius: 4px;
    background: transparent;
    color: var(--minicode-fg, #cdd3de);
    font: inherit;
    cursor: pointer;
    outline: none;

    &:hover {
      background: var(--minicode-hover, #232834);
    }

    &.primary {
      background: var(--minicode-accent, #4b9fff);
      border-color: var(--minicode-accent, #4b9fff);
      color: #ffffff;

      &:hover {
        filter: brightness(1.1);
      }
    }
  }
`;

export type PromptModalProps = {
  title: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function PromptModal(props: PromptModalProps) {
  const { title, defaultValue = "", onConfirm, onCancel } = props;

  const input = (
    <input class="prompt-input" type="text" value={defaultValue} />
  ) as HTMLInputElement;

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });

  const confirm = () => onConfirm(input.value);

  return (
    <div class={PromptModalStyles}>
      <div
        class="prompt-overlay"
        onclick={(e: MouseEvent) => {
          if (e.target === e.currentTarget) onCancel();
        }}
        oncontextmenu={(e: Event) => e.preventDefault()}
      >
        <div
          class="prompt-modal"
          onclick={(e: Event) => e.stopPropagation()}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            } else if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
          }}
        >
          <div class="prompt-title">{title}</div>
          {input}
          <div class="prompt-actions">
            <button class="prompt-btn" onclick={onCancel}>
              Cancel
            </button>
            <button class="prompt-btn primary" onclick={confirm}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
