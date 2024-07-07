import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { server } from "./__mocks__/node";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("User tests", () => {
  it("Should deny the configuration if the required reviewers are less than 1", async () => {
    jest.mock("@actions/github", () => ({
      context: {
        repo: {
          owner: {
            login: "ubiquibot",
          },
        },
        workflow: "workflow",
        payload: {
          inputs: {
            eventName: "pull_request.opened",
            settings: JSON.stringify({
              collaboratorMinimumApprovalsRequired: 0,
              contributorMinimumApprovalsRequired: 0,
            }),
            eventPayload: JSON.stringify({
              pull_request: {
                html_url: "https://github.com/ubiquibot/automated-merging/pull/1",
              },
            }),
            env: {
              workflowName: "workflow",
            },
          },
        },
      },
    }));
    const run = (await import("../src/action")).run;
    await expect(run()).rejects.toThrow(
      "Invalid settings provided:\n/collaboratorMinimumApprovalsRequired: Expected number to be greater or equal to 1;\n/contributorMinimumApprovalsRequired: Expected number to be greater or equal to 1"
    );
  });
});
