export function formatCss(blocks: string[]): string {
  return `${blocks.join("\n\n")}\n`;
}
