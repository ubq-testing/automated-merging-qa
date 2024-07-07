import ms from "ms";
import { PullRequest } from "../adapters/sqlite/entities/pull-request";
import { getAllTimelineEvents } from "../handlers/github-events";
import { Context } from "../types";
import { getMergeTimeout, IssueParams, parseGitHubUrl } from "./github";

type IssueEvent = {
  created_at?: string;
  updated_at?: string;
  timestamp?: string;
  commented_at?: string;
};

async function isPullMerged(context: Context, { repo, owner, issue_number: pullNumber }: IssueParams) {
  try {
    const res = await context.octokit.pulls.checkIfMerged({
      repo,
      owner,
      pull_number: pullNumber,
    });
    return res.status === 204;
  } catch (e) {
    return false;
  }
}

export async function updatePullRequests(context: Context) {
  const pullRequests = await context.adapters.sqlite.pullRequest.getAll();

  if (!pullRequests?.length) {
    return context.logger.info("Nothing to do.");
  }
  for (const pullRequest of pullRequests) {
    try {
      const gitHubUrl = parseGitHubUrl(pullRequest.url);
      context.logger.debug(`Processing pull-request ${pullRequest.url}...`);
      if (await isPullMerged(context, gitHubUrl)) {
        context.logger.info(`The pull request ${pullRequest.url} is already merged, nothing to do.`);
        try {
          await context.adapters.sqlite.pullRequest.delete(pullRequest.url);
        } catch (e) {
          context.logger.error(`Failed to delete pull-request ${pullRequest.url}: ${e}`);
        }
        continue;
      }
      const activity = await getAllTimelineEvents(context, parseGitHubUrl(pullRequest.url));
      const eventDates: Date[] = activity
        .map((event) => {
          const e = event as IssueEvent;
          return new Date(e.created_at || e.updated_at || e.timestamp || e.commented_at || "");
        })
        .filter((date) => !isNaN(date.getTime()));

      const lastActivityDate = new Date(Math.max(...eventDates.map((date) => date.getTime())));

      const mergeTimeout = await getMergeTimeout(context, gitHubUrl);
      if (isNaN(lastActivityDate.getTime()) || isPastOffset(lastActivityDate, mergeTimeout)) {
        context.logger.info(`Pull-request ${pullRequest.url} is past its due date (${mergeTimeout} after ${lastActivityDate}), will merge.`);
        await mergePullRequest(context, pullRequest, gitHubUrl);
      } else {
        await context.adapters.sqlite.pullRequest.update(pullRequest.url, lastActivityDate);
        context.logger.info(`Updated PR ${pullRequest.url} to a new timestamp (${lastActivityDate})`);
      }
    } catch (e) {
      context.logger.error(`Could not process pull-request ${pullRequest.url} for auto-merge: ${e}`);
    }
  }
}

async function mergePullRequest(context: Context, pullRequest: PullRequest, { repo, owner, issue_number: pullNumber }: IssueParams) {
  await context.adapters.sqlite.pullRequest.delete(pullRequest.url);
  await context.octokit.pulls.merge({
    owner,
    repo,
    pull_number: pullNumber,
  });
}

function isPastOffset(lastActivityDate: Date, offset: string): boolean {
  const currentDate = new Date();
  const offsetTime = ms(offset);

  if (offsetTime === undefined) {
    throw new Error("Invalid offset format");
  }

  const futureDate = new Date(lastActivityDate.getTime() + offsetTime);

  return currentDate > futureDate;
}
