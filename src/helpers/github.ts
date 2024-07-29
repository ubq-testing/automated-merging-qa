import { retryAsync } from "ts-retry";
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
    mergeTimeout: context.config.mergeTimeout.collaborator,
    requiredApprovalCount: context.config.approvalsRequired.collaborator,
  };
  const timeoutContributor = {
    mergeTimeout: context.config.mergeTimeout.contributor,
    requiredApprovalCount: context.config.approvalsRequired.contributor,
  };
  return authorAssociation === "COLLABORATOR" || authorAssociation === "MEMBER" ? timeoutCollaborator : timeoutContributor;
}

export async function getApprovalCount({ octokit, logger }: Context, { owner, repo, issue_number: pullNumber }: IssueParams) {
  try {
    const { data: reviews } = await octokit.rest.pulls.listReviews({
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

export async function isCiGreen({ octokit, logger, env }: Context, sha: string, { owner, repo }: IssueParams) {
  try {
    const ref = sha;

    const { data: checkSuites } = await octokit.rest.checks.listSuitesForRef({
      owner,
      repo,
      ref,
    });
    return retryAsync(
      async () => {
        const checkSuitePromises = checkSuites.check_suites.map(async (suite) => {
          logger.debug(`Checking runs for suite ${suite.id}: ${suite.url}, and filter out ${env.workflowName}`);
          const { data: checkRuns } = await octokit.rest.checks.listForSuite({
            owner,
            repo,
            check_suite_id: suite.id,
          });

          return checkRuns.check_runs;
        });
        const checkResults = await Promise.all(checkSuitePromises);

        for (const checkResult of checkResults) {
          const filteredResults = checkResult.filter((o) => o.name !== env.workflowName);
          if (filteredResults.find((o) => o.status !== "completed")) {
            return null;
          } else if (
            filteredResults.find((o) => {
              logger.debug(`Workflow ${o.name}/${o.id} [${o.url}]: ${o.status},${o.conclusion}`);
              return o.conclusion === "failure";
            })
          ) {
            return false;
          }
        }
        return true;
      },
      {
        until(lastResult) {
          if (lastResult === null) {
            logger.info("Not all CI runs were complete, will retry...");
          }
          return lastResult !== null;
        },
        maxTry: 100,
        delay: 60000,
      }
    );
  } catch (e) {
    logger.error(`Error checking CI status: ${e}`);
    return false;
  }
}

/**
 * Returns all the pull requests that are opened and not a draft from the list of repos / organizations.
 *
 * https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests#search-only-issues-or-pull-requests
 */
export async function getOpenPullRequests({ octokit, logger }: Context, targets: string[]) {
  const filter = targets.map((target) => {
    let toExclude = "";
    // If we have to exclude the target, happen a minus and remove it from the target name
    if (target[0] === "-") {
      toExclude = "-";
      target = target.slice(1);
    }
    const [org, repo] = target.split("/");
    return repo ? `${toExclude}repo:${org}/${repo}` : `${toExclude}org:${org}`;
  });
  try {
    const results = await octokit.paginate("GET /search/issues", {
      q: `is:pr is:open draft:false ${filter.join(" ")}`,
    });
    return results.flat();
  } catch (e) {
    logger.error(`Error getting open pull-requests for targets: [${targets.join(", ")}]. ${e}`);
    return [];
  }
}

export async function mergePullRequest(context: Context, { repo, owner, issue_number: pullNumber }: IssueParams) {
  await context.octokit.pulls.merge({
    owner,
    repo,
    pull_number: pullNumber,
  });
}

export async function getPullRequestDetails(context: Context, { repo, owner, issue_number: pullNumber }: IssueParams) {
  const response = await context.octokit.rest.pulls.get({
    repo,
    owner,
    pull_number: pullNumber,
  });
  console.log(response);
  return response.data;
}
