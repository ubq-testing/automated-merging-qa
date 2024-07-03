import { parseGitHubUrl } from "../helpers/github-url";
import { Context } from "../types";

export type IssueParams = ReturnType<typeof parseGitHubUrl>;

export async function getAllTimelineEvents({ octokit }: Context, issueParams: IssueParams) {
  return octokit.paginate(octokit.rest.issues.listEventsForTimeline, issueParams);
}
