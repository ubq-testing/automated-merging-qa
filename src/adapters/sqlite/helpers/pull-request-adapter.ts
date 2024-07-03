import { DataSource } from "typeorm";
import { Context } from "../../../types";
import { Super } from "./sqlite";

export class PullRequestAdapter extends Super {
  constructor(sqlite: DataSource, context: Context) {
    super(sqlite, context);
  }
}
