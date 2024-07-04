import * as fs from "node:fs";
import { initializeDataSource } from "../src/adapters/sqlite/data-source";
import { PullRequest } from "../src/adapters/sqlite/entities/pull-request";
import { server } from "./__mocks__/node";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach, it, jest } from "@jest/globals";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const htmlUrl = "https://github.com/ubiquibot/automated-merging/pull/1";
const actionsGithubPackage = "@actions/github";

describe("Action tests", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
  });

  it("Should add a pull request in the DB on PR opened", async () => {
    const dbName = `database/${expect.getState().currentTestName}.db`;
    fs.rmSync(dbName, { force: true });
    jest.mock(actionsGithubPackage, () => ({
      context: {
        repo: {
          owner: {
            login: "ubiquibot",
          },
        },
        payload: {
          inputs: {
            eventName: "pull_request.opened",
            settings: JSON.stringify({
              databaseUrl: dbName,
            }),
            eventPayload: JSON.stringify({
              pull_request: {
                html_url: htmlUrl,
              },
            }),
            env: {},
          },
        },
      },
    }));
    const run = (await import("../src/action")).run;
    await expect(run()).resolves.toMatchObject({ status: 200 });
    const dataSource = await initializeDataSource(dbName);
    const pullRequests = await dataSource.getRepository(PullRequest).find();
    expect(pullRequests).toMatchObject([
      {
        id: 1,
        url: htmlUrl,
      },
    ]);
  });

  it("Should remove a pull request in the DB on PR closed", async () => {
    const dbName = `database/${expect.getState().currentTestName}.db`;
    fs.rmSync(dbName, { force: true });
    const dataSource = await initializeDataSource(dbName);
    const pr = new PullRequest();
    pr.url = htmlUrl;
    pr.lastActivity = new Date();
    await pr.save();
    jest.mock(actionsGithubPackage, () => ({
      context: {
        repo: {
          owner: {
            login: "ubiquibot",
          },
        },
        payload: {
          inputs: {
            eventName: "pull_request.closed",
            settings: JSON.stringify({
              databaseUrl: dbName,
            }),
            eventPayload: JSON.stringify({
              pull_request: {
                html_url: htmlUrl,
              },
            }),
            env: {},
          },
        },
      },
    }));
    const run = (await import("../src/action")).run;
    await expect(run()).resolves.toMatchObject({ status: 200 });
    const pullRequests = await dataSource.getRepository(PullRequest).find();
    expect(pullRequests).toHaveLength(0);
  });

  it("Should not close a PR that is not past the threshold", async () => {
    jest.mock(actionsGithubPackage, () => ({
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
                html_url: htmlUrl,
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
