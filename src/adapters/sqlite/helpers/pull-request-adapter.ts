import { DataSource } from "typeorm";
import { Context } from "../../../types";
import { PullRequest } from "../entities/pull-request";
import { Super } from "./sqlite";

export class PullRequestAdapter extends Super {
  constructor(sqlite: DataSource, context: Context) {
    super(sqlite, context);
  }

  public async create(url: string) {
    const pullRequest = new PullRequest();

    pullRequest.url = url;
    try {
      return await pullRequest.save();
    } catch (e) {
      this.context.logger.error(`Failed to save the url ${url} to the DB.`);
      return null;
    }
  }
}
