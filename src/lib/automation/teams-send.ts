// Posts a message to a Teams workflow link as an Adaptive Card. The link is never logged.

export async function postToTeams(webhookUrl: string, text: string): Promise<{ ok: boolean; status?: number }> {
  const [title, ...rest] = text.split("\n");
  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: title, weight: "Bolder", size: "Medium", wrap: true },
            ...(rest.join("\n").trim() ? [{ type: "TextBlock", text: rest.join("\n").trim(), wrap: true }] : []),
          ],
        },
      },
    ],
  };
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false };
  }
}
