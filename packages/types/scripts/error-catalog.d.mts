export type ParsedErrorEntry = {
  code: string;
  module: string;
  status: number;
  messageKey: string;
  params: string[];
};

export function parseErrorsMarkdown(markdown: string): ParsedErrorEntry[];
export function renderCatalog(entries: ParsedErrorEntry[]): string;
