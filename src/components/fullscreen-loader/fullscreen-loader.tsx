import { css } from "embedcss";

const loaderStyles = css`
  .loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.54em;
    width: 100%;
    height: 100%;
    background: var(--minicode-bg, #1b1f27);
    color: var(--minicode-fg, #cdd3de);
    font-family: var(--minicode-font, ui-monospace, monospace);

    & .loader-spinner {
      width: 2.46em;
      height: 2.46em;
      border: 3px solid var(--minicode-border, #2a2f3a);
      border-top-color: var(--minicode-accent, #4b9fff);
      border-radius: 50%;
      animation: minicode-spin 0.8s linear infinite;
    }

    & .loader-text {
      font-size: 1em;
      color: var(--minicode-muted, #6b7280);
      letter-spacing: 0.04em;
    }

    @keyframes minicode-spin {
      to {
        transform: rotate(360deg);
      }
    }
  }
`;

export function FullscreenLoader() {
  return (
    <div class={loaderStyles}>
      <div class="loader-spinner"></div>
      <div class="loader-text">Loading...</div>
    </div>
  );
}
