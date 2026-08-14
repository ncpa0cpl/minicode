export type Formatter = (info: { filepath: string; code: string }) => Promise<string> | string;

export type FormatterFactory = (() => Formatter) | (() => Promise<Formatter>);
