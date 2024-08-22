import { paginateRest } from "@octokit/plugin-paginate-rest";
import { Octokit } from "@octokit/rest";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { updatePullRequests } from "./helpers/update-pull-requests";
import { Context, Env, PluginInputs } from "./types";

/**
 * How a worker executes the plugin.
 */
export async function plugin(inputs: PluginInputs, env: Env) {
  const octokitWithPlugin = Octokit.plugin(paginateRest);
  const octokit = new octokitWithPlugin({ auth: inputs.authToken });

  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    env,
    logger: new Logs("debug"),
  };

  context.logger.info("Will check the following repos", { ...context.config.repos });
  return await updatePullRequests(context);
}
