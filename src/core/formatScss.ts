export function formatScss(blocks: string[]): string {
  return `${blocks.join("\n\n")}\n`;
}
