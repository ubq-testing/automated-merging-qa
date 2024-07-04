import { http, HttpResponse } from "msw";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.post("https://api.github.com/repos/login,ubiquibot//dispatches", () => {
    return HttpResponse.json();
  }),
  http.get("https://api.github.com/repos/:org/:repo/pulls/:id/merge", () => {
    return HttpResponse.json();
  }),
];
