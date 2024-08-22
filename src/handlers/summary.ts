import * as core from "@actions/core";
import { Context } from "../types";

export interface ResultInfo {
  url: string;
  merged: boolean;
}

function generateGitHubSummary(context: Context, urls: ResultInfo[]): string {
  const target = `https://github.com/${context.payload.repository.owner?.login}`;
  const output: string[] = ["## Merge report\n\n"];
  output.push("<samp>");
  output.push("| Merged | ID |\n");
  output.push("|---|---|\n");
  output.push(
    urls
      .sort((a) => (a.merged ? -1 : 1))
      .map(({ url, merged }) => {
        const status = merged ? `<span>🔵</span>` : `<span>⚫️</span>`;
        return `| ${status} | [${url.split("/").pop()}](${url}) |`;
      })
      .join("\n")
  );
  output.push("</samp>");
  output.push("🔵= merged");
  output.push("⚫️= unmerged");
  output.push("## Configuration\n\n");
  output.push("### Watching Repositories\n\n");
  output.push(context.config.repos.monitor.map((o) => `- [${o}](${target}/${o})`).join("\n"));
  output.push("### Ignored Repositories\n\n");
  output.push(context.config.repos.ignore.map((o) => `- [${o}](${target}/${o})`).join("\n"));
  return output.join("\n");
}

export async function generateSummary(context: Context, results: ResultInfo[]) {
  try {
    const summary = generateGitHubSummary(context, results);
    await core.summary.addRaw(summary).write();
  } catch (e) {
    context.logger.error("Could not publish the summary", { e });
  }
}
