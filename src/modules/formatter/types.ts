export type Formatter = (info: { filename: string; code: string }) => Promise<string> | string;

export type FormatterFactory = (() => Formatter) | (() => Promise<Formatter>);
