import { RestEndpointMethodTypes } from "@octokit/rest";

export type GitHubTimelineEvent = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][0];
