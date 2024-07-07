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
export async function getMergeTimeoutAndApprovalRequiredCount(context: Context, authorAssociation: string) {
  const timeoutCollaborator = {
    mergeTimeout: context.config.collaboratorMergeTimeout,
    requiredApprovalCount: context.config.collaboratorMinimumApprovalsRequired,
  };
  const timeoutContributor = {
    mergeTimeout: context.config.contributorMergeTimeout,
    requiredApprovalCount: context.config.contributorMinimumApprovalsRequired,
  };
  return authorAssociation === "COLLABORATOR" || authorAssociation === "MEMBER" ? timeoutCollaborator : timeoutContributor;
}

export async function getApprovalCount({ octokit, logger }: Context, { owner, repo, issue_number: pullNumber }: IssueParams) {
  try {
    const { data: reviews } = await octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return reviews.filter((review) => review.state === "APPROVED").length;
  } catch (e) {
    logger.error(`Error fetching reviews' approvals: ${e}`);
    return 0;
  }
}

export async function isCiGreen({ octokit, logger }: Context, sha: string, { owner, repo }: IssueParams) {
  try {
    const ref = sha;

    const { data: checkSuites } = await octokit.checks.listSuitesForRef({
      owner,
      repo,
      ref,
    });

    const checkSuitePromises = checkSuites.check_suites.map(async (suite) => {
      const { data: checkRuns } = await octokit.checks.listForSuite({
        owner,
        repo,
        check_suite_id: suite.id,
      });

      logger.debug(`Workflow runs for sha ${sha}: ${JSON.stringify(checkRuns.check_runs)}`);
      return checkRuns.check_runs.every((run) => run.conclusion === "success");
    });

    const checkResults = await Promise.all(checkSuitePromises);

    return checkResults.every((result) => result);
  } catch (e) {
    logger.error(`Error checking CI status: ${e}`);
    return false;
  }
}
