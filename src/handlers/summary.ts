import * as core from "@actions/core";
import { Context } from "../types";

export interface ResultInfo {
  url: string;
  merged: boolean;
}

function generateGitHubSummary(context: Context, urls: ResultInfo[]): string {
  let monitored = "Monitored: " + context.config.repos.monitor.join(" | ") + "\n\n";
  const ignored = "Ignored: " + context.config.repos.ignore.join(" | ") + "\n\n";

  monitored +=
    ignored +
    urls
      .map(({ url, merged }) => {
        const status = merged ? `<span>🟢 merged</span>` : `<span>🔵 no change</span>`;
        return `- [${url}](${url}) - ${status}`;
      })
      .join("\n");

  return monitored;
}

export async function generateSummary(context: Context, results: ResultInfo[]) {
  try {
    const summary = generateGitHubSummary(context, results);
    await core.summary.addRaw(summary).write();
  } catch (e) {
    context.logger.error("Could not publish the summary", { e });
  }
}
