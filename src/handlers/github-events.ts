import { parseGitHubUrl } from "../helpers/github-url";
import { Context } from "../types";
import { GitHubTimelineEvent } from "../types/github-types";

export type IssueParams = ReturnType<typeof parseGitHubUrl>;

export async function getAllTimelineEvents({ octokit }: Context, issueParams: IssueParams): Promise<GitHubTimelineEvent[]> {
  const options = octokit.issues.listEventsForTimeline.endpoint.merge(issueParams);
  return await octokit.paginate(options);
}
