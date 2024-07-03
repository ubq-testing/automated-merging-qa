import ms from "ms";
import { getAllTimelineEvents } from "../handlers/github-events";
import { Context } from "../types";
import { parseGitHubUrl } from "./github-url";

type IssueEvent = {
  created_at?: string;
  updated_at?: string;
  timestamp?: string;
  commented_at?: string;
};

export async function updatePullRequests(context: Context) {
  const pullRequests = await context.adapters.sqlite.pullRequest.getAll();

  if (!pullRequests?.length) {
    return context.logger.info("Nothing to do.");
  }
  for (const pullRequest of pullRequests) {
    try {
      const activity = await getAllTimelineEvents(context, parseGitHubUrl(pullRequest.url));
      const eventDates: Date[] = activity
        .map((event) => {
          const e = event as IssueEvent;
          return new Date(e.created_at || e.updated_at || e.timestamp || e.commented_at || "");
        })
        .filter((date) => !isNaN(date.getTime()));

      const lastActivityDate = new Date(Math.max(...eventDates.map((date) => date.getTime())));

      if (isPastOffset(lastActivityDate, context.config.collaboratorMergeTimeout)) {
        // Should close PR
        await context.adapters.sqlite.pullRequest.delete(pullRequest.url);
      } else {
        await context.adapters.sqlite.pullRequest.update(pullRequest.url, lastActivityDate);
      }
    } catch (e) {
      context.logger.error(`Could not get activity for pull-request ${pullRequest.url}: ${e}`);
    }
  }
}

// Function to check if the last activity date is past a given offset
function isPastOffset(lastActivityDate: Date, offset: string): boolean {
  const currentDate = new Date();
  const offsetTime = ms(offset);

  if (offsetTime === undefined) {
    throw new Error("Invalid offset format");
  }

  const futureDate = new Date(lastActivityDate.getTime() + offsetTime);

  return currentDate > futureDate;
}
