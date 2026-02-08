const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export async function postToSlack(userName: string, content: string, isBreakingNews: boolean) {
  if (!SLACK_WEBHOOK_URL) return;

  const prefix = isBreakingNews ? ":rotating_light: *BREAKING NEWS*\n" : "";
  const text = `${prefix}*${userName}*: ${content}`;

  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
