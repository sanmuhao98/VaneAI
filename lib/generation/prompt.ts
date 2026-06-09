// Assembles the final prompt from a template's (server-only) base_prompt and the user's keyword.
// {subject} placeholder → replaced; otherwise keyword is appended. Never returned to the client.
export function assemblePrompt(basePrompt: string, keyword: string): string {
  if (basePrompt.includes('{subject}')) {
    return basePrompt.replaceAll('{subject}', keyword)
  }
  return `${basePrompt}, ${keyword}`
}
