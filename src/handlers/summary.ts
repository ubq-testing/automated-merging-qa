import * as core from "@actions/core";
import { Context } from "../types";

export interface ResultInfo {
  url: string;
  merged: boolean;
}

function generateGitHubSummary(context: Context, urls: ResultInfo[]): string {
  let output = "## Repositories\n\n";
  output += `Monitored: [${context.config.repos.monitor.join(" | ")}]\n\n`;
  output += `Ignored: [${context.config.repos.ignore.join(" | ")}]\n\n`;
  output += "## Merging\n\n";
  output += "🟢: merged\n🔵: no change\n\n";
  output += urls
    .map(({ url, merged }) => {
      const status = merged ? `<span>🟢</span>` : `<span>🔵</span>`;
      return `- ${status} - [${url}](${url})`;
    })
    .join("\n");
  return output;
}

export async function generateSummary(context: Context, results: ResultInfo[]) {
  try {
    const summary = generateGitHubSummary(context, results);
    await core.summary.addRaw(summary).write();
  } catch (e) {
    context.logger.error("Could not publish the summary", { e });
  }
}
