import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";
import { Value } from "@sinclair/typebox/value";
import { plugin } from "./plugin";
import { envSchema, envValidator, PluginInputs, pluginSettingsSchema, pluginSettingsValidator } from "./types";

/**
 * How a GitHub action executes the plugin.
 */
export async function run() {
  const payload = github.context.payload.inputs;

  payload.env = { ...(payload.env || {}), workflowName: github.context.workflow };
  if (!envValidator.test(payload.env)) {
    const errors: string[] = [];
    for (const error of envValidator.errors(payload.env)) {
      console.error(error);
      errors.push(`${error.path}: ${error.message}`);
    }
    throw new Error(`Invalid environment provided:\n${errors.join(";\n")}`);
  }
  const env = Value.Decode(envSchema, payload.env || {});

  payload.settings = Value.Default(pluginSettingsSchema, JSON.parse(payload.settings));
  if (!pluginSettingsValidator.test(payload.settings)) {
    const errors: string[] = [];
    for (const error of pluginSettingsValidator.errors(payload.settings)) {
      console.error(error);
      errors.push(`${error.path}: ${error.message}`);
    }
    throw new Error(`Invalid settings provided:\n${errors.join(";\n")}`);
  }

  const settings = Value.Decode(pluginSettingsSchema, payload.settings);
  const inputs: PluginInputs = {
    stateId: payload.stateId,
    eventName: payload.eventName,
    eventPayload: JSON.parse(payload.eventPayload),
    settings,
    authToken: payload.authToken,
    ref: payload.ref,
  };

  await plugin(inputs, env);

  return returnDataToKernel(process.env.GITHUB_TOKEN, inputs.stateId, {});
}

async function returnDataToKernel(repoToken: string, stateId: string, output: object) {
  const octokit = new Octokit({ auth: repoToken });
  return octokit.repos.createDispatchEvent({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    event_type: "return_data_to_ubiquibot_kernel",
    client_payload: {
      state_id: stateId,
      output: JSON.stringify(output),
    },
  });
}
