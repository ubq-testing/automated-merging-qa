import { SupportedEvents, SupportedEventsU } from "./context";
import { StaticDecode, Type as T } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";

export interface PluginInputs<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]> {
  stateId: string;
  eventName: T;
  eventPayload: TU["payload"];
  settings: PluginSettings;
  authToken: string;
  ref: string;
}

export const pluginSettingsSchema = T.Object({
  /**
   * The amount of validations needed to consider a pull-request by a collaborator to be deemed eligible for merge
   */
  collaboratorMinimumApprovalsRequired: T.Number({ default: 1, minimum: 1 }),
  /**
   * The amount of validations needed to consider a pull-request by a contributor to be deemed eligible for merge
   */
  contributorMinimumApprovalsRequired: T.Number({ default: 1, minimum: 1 }),
  /**
   * The timespan to wait before merging a collaborator's pull-request
   */
  collaboratorMergeTimeout: T.String({ default: "3.5 days" }),
  /**
   * The timespan to wait before merging a contributor's pull-request
   */
  contributorMergeTimeout: T.String({ default: "7 days" }),
  /**
   * The location of the database
   */
  databaseUrl: T.String({ default: "database/sql.db" }),
});
export const pluginSettingsValidator = new StandardValidator(pluginSettingsSchema);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
