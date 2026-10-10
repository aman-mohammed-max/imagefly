/** Return a supported iris color only when the instruction explicitly names eyes/irises. */
export function parseEyeColorPrompt(prompt) {
  if (!/\b(?:eye|eyes|iris|irises)\b/i.test(prompt)) return null;
  const match = prompt.match(/\b(green|blue|hazel|brown|amber|gray|grey)\b/i);
  if (!match) return null;
  return match[1].toLowerCase() === "grey" ? "gray" : match[1].toLowerCase();
}
