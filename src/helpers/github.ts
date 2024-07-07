import { Context } from "../types";

export function parseGitHubUrl(url: string) {
  const path = new URL(url).pathname.split("/");
  if (path.length !== 5) {
    throw new Error(`[parseGitHubUrl] Invalid url: [${url}]`);
  }
  return {
    owner: path[1],
    repo: path[2],
    issue_number: Number(path[4]),
  };
}

export type IssueParams = ReturnType<typeof parseGitHubUrl>;

/**
 * Gets the merge timeout depending on the status of the assignee. If there are multiple assignees with different
 * statuses, the longest timeout is chosen.
 */
export async function getMergeTimeout(context: Context, { repo, owner }: IssueParams) {
  const assignees = context.payload.pull_request.assignees || [];
  let timeout = context.config.contributorMergeTimeout;
  for (const assignee of assignees) {
    try {
      await context.octokit.repos.checkCollaborator({
        repo,
        owner,
        username: assignee.login,
      });
      timeout = context.config.collaboratorMergeTimeout;
    } catch (e) {
      context.logger.debug(`${assignee.login} is not a collaborator of ${owner}/${repo}: ${e}`);
      timeout = context.config.contributorMergeTimeout;
      break;
    }
  }
  return timeout;
}
