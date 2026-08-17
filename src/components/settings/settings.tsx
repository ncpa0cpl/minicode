import { css } from "embedcss";

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

    .settings-header {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.62em;
      flex: 0 0 auto;
      padding: 0.77em 0.92em;
      border-bottom: 1px solid var(--minicode-border, #2a2f3a);
      background: var(--minicode-bg, #1b1f27);
    }

    .settings-title {
      font-weight: 600;
      color: var(--minicode-fg, #cdd3de);
      margin-right: 0.31em;
    }
  }
`;

export function Settings() {
  return (
    <div class={SettingsStyles}>
      <div class="settings-overlay">
        <div class="settings-panel">
          <div class="settings-header">
            <span class="settings-title">Settings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
