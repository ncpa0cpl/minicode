declare class TrustedHTML {}

type HTMLTrustPolicy = {
  createHTML(html: string): string & TrustedHTML;
};

declare const trustedTypes:
  | undefined
  | {
      createPolicy(
        name: string,
        opts: {
          createHTML: (str: string) => string;
        },
      ): HTMLTrustPolicy;
    };

/**
 * Returns an HTML-string passthrough that respects the Trusted Types policy
 * when present in the environment. Used both for minicode's custom hover
 * rendering and as the `sanitizeHTML` hook for `@codemirror/lsp-client`.
 */
export function trustHtml(html: string): string {
  if (typeof trustedTypes === "undefined") return html;
  return trustedTypes!.createPolicy("myEscapePolicy", {
    createHTML: (str: string) => str,
  }).createHTML(html) as unknown as string;
}
