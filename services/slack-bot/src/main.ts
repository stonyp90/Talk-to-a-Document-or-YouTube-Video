import { App } from "@slack/bolt";
import { createSlackBot } from "./handlers";

async function main(): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (!botToken || !appToken) {
    console.error(
      "[slack-bot] SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required.",
    );
    console.error(
      "[slack-bot] Create a Slack app at api.slack.com/apps with Socket Mode enabled.",
    );
    process.exit(1);
  }

  const app = new App({
    token: botToken,
    appToken,
    socketMode: true,
  });

  const bot = createSlackBot({ app });

  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      console.log("[slack-bot] shutting down");
      process.exit(0);
    });

  await app.start();
  console.log("[slack-bot] bridge online — identity scoring active");
}

main().catch((error) => {
  console.error("[slack-bot] could not start", error);
  process.exit(1);
});
