import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import usersGet from "./__mocks__/users-get.json";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach, it, jest } from "@jest/globals";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("User tests", () => {
  beforeEach(() => {
    for (const item of usersGet) {
      db.users.create(item);
    }
  });

  it("Should add and remove pull requests in the DB on PR opened / closed", async () => {
    jest.mock("@actions/github", () => ({
      context: {
        repo: {
          owner: {
            login: "ubiquibot",
          },
        },
        payload: {
          inputs: {
            eventName: "push",
            settings: JSON.stringify({
              databaseUrl: `database/${expect.getState().currentTestName}.db`,
            }),
            eventPayload: JSON.stringify({
              pull_request: {
                html_url: "https://github.com/ubiquibot/automated-merging/pull/1",
              },
            }),
            env: {},
          },
        },
      },
    }));
    const run = (await import("../src/action")).run;
    await expect(run()).resolves.toReturn();
  });

  it("Should not close a PR that is not past the threshold", async () => {
    jest.mock("@actions/github", () => ({
      context: {
        repo: {
          owner: {
            login: "ubiquibot",
          },
        },
        payload: {
          inputs: {
            eventName: "push",
            settings: JSON.stringify({
              databaseUrl: `database/should_not_close_a_pr_that_is_not_past_the_threshold.db`,
            }),
            eventPayload: JSON.stringify({
              pull_request: {
                html_url: "https://github.com/ubiquibot/automated-merging/pull/1",
              },
            }),
            env: {},
          },
        },
      },
    }));
    const run = (await import("../src/action")).run;
    await expect(run()).resolves.toReturn();
  });

  it("Should close a PR that is past the threshold", async () => {});
});
