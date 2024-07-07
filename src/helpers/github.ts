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
export async function getMergeTimeoutAndApprovalRequiredCount(context: Context, { repo, owner }: IssueParams) {
  const assignees = context.payload.pull_request.assignees || [];
  let timeout = { mergeTimeout: context.config.contributorMergeTimeout, requiredApprovalCount: context.config.contributorMinimumApprovalsRequired };
  for (const assignee of assignees) {
    try {
      await context.octokit.repos.checkCollaborator({
        repo,
        owner,
        username: assignee.login,
      });
      timeout = { mergeTimeout: context.config.collaboratorMergeTimeout, requiredApprovalCount: context.config.collaboratorMinimumApprovalsRequired };
    } catch (e) {
      context.logger.debug(`${assignee.login} is not a collaborator of ${owner}/${repo}: ${e}`);
      timeout = { mergeTimeout: context.config.contributorMergeTimeout, requiredApprovalCount: context.config.contributorMinimumApprovalsRequired };
      break;
    }
  }
  return timeout;
}

export async function getApprovalCount({ octokit, logger }: Context, { owner, repo, issue_number: pullNumber }: IssueParams) {
  try {
    const { data: reviews } = await octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return reviews.filter((review) => review.state === "APPROVED").length;
  } catch (error) {
    logger.error(`Error fetching reviews: ${error}`);
    return 0;
  }
}
