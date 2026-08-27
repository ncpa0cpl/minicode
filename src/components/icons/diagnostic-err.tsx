export function IconDiagnosticError() {
  return (
    <svg
      attribute:width="1.3em"
      attribute:height="1.3em"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <line
        attribute:x1="6"
        attribute:y1="6"
        attribute:x2="10"
        attribute:y2="10"
        attribute:stroke="var(--minicode-error)"
        attribute:stroke-width="2"
        attribute:stroke-linecap="round"
      />
      <line
        attribute:x1="10"
        attribute:y1="6"
        attribute:x2="6"
        attribute:y2="10"
        attribute:stroke="var(--minicode-error)"
        attribute:stroke-width="2"
        attribute:stroke-linecap="round"
      />
      <circle
        attribute:cx="8"
        attribute:cy="8"
        attribute:r="6"
        attribute:fill="none"
        attribute:stroke="var(--minicode-error)"
        attribute:stroke-width="2"
      />
    </svg>
  );
}

export function IconDiagnosticWarn() {
  return (
    <svg
      attribute:width="1.3em"
      attribute:height="1.3em"
      attribute:viewBox="0 0 16 16"
      attribute:fill="none"
    >
      <line
        attribute:x1="6"
        attribute:y1="6"
        attribute:x2="10"
        attribute:y2="10"
        attribute:stroke="var(--minicode-warning)"
        attribute:stroke-width="2"
        attribute:stroke-linecap="round"
      />
      <line
        attribute:x1="10"
        attribute:y1="6"
        attribute:x2="6"
        attribute:y2="10"
        attribute:stroke="var(--minicode-warning)"
        attribute:stroke-width="2"
        attribute:stroke-linecap="round"
      />
      <circle
        attribute:cx="8"
        attribute:cy="8"
        attribute:r="6"
        attribute:fill="none"
        attribute:stroke="var(--minicode-warning)"
        attribute:stroke-width="2"
      />
    </svg>
  );
}
