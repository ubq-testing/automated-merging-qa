import { Octokit } from "@octokit/rest";
import { http, HttpResponse } from "msw";
import * as fs from "node:fs";
import { initializeDataSource } from "../src/adapters/sqlite/data-source";
import { PullRequest } from "../src/adapters/sqlite/entities/pull-request";
import { getMergeTimeout } from "../src/helpers/github";
import { server } from "./__mocks__/node";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach, it, jest } from "@jest/globals";
import { Context } from "../src/types";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const htmlUrl = "https://github.com/ubiquibot/automated-merging/pull/1";
const actionsGithubPackage = "@actions/github";

describe("Action tests", () => {
  let dbName = `database/tests/test.db`;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    dbName = `database/tests/${expect.getState().currentTestName}.db`;
    fs.rmSync(dbName, { force: true });
  });

  it("Should add a pull request in the DB on PR opened", async () => {
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
    const dataSource = await initializeDataSource(dbName);
    const pr = new PullRequest();
    pr.url = htmlUrl;
    pr.lastActivity = new Date();
    await pr.save();
    server.use(
      http.get(
        "https://api.github.com/repos/:org/:repo/pulls/:id/merge",
        () => {
          return HttpResponse.json({}, { status: 404 });
        },
        { once: true }
      )
    );
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
    expect(pullRequests).toHaveLength(1);
  });

  it("Should close a PR that is past the threshold", async () => {
    const dataSource = await initializeDataSource(dbName);
    const pr = new PullRequest();
    pr.url = htmlUrl;
    const lastActivityDate = new Date();
    lastActivityDate.setDate(new Date().getDate() - 8);
    console.log(lastActivityDate);
    pr.lastActivity = lastActivityDate;
    await pr.save();
    server.use(
      http.get(
        "https://api.github.com/repos/:org/:repo/pulls/:id/merge",
        () => {
          return HttpResponse.json({}, { status: 404 });
        },
        { once: true }
      )
    );
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

  it("Should pick the timeout according to the assignee's status", async () => {
    const contributorMergeTimeout = "7 days";
    const collaboratorMergeTimeout = "3.5 days";
    const context = {
      logger: {
        debug: console.log,
      },
      payload: {
        pull_request: {
          assignees: [{ login: "ubiquibot" }],
        },
      },
      config: {
        contributorMergeTimeout,
        collaboratorMergeTimeout,
      },
      octokit: new Octokit(),
    } as unknown as Context;
    await expect(getMergeTimeout(context, { owner: "ubiquibot", repo: "automated-merging", issue_number: 1 })).resolves.toEqual(collaboratorMergeTimeout);
    server.use(
      http.get(
        "https://api.github.com/repos/:org/:repo/collaborators/:login",
        () => {
          return HttpResponse.json("Not a collaborator", { status: 404 });
        },
        { once: true }
      )
    );
    await expect(getMergeTimeout(context, { owner: "ubiquibot", repo: "automated-merging", issue_number: 1 })).resolves.toEqual(contributorMergeTimeout);
  });
});
