# `@ubiquibot/automated-merging`

Automatically merge pull-requests based on the reviewer count, the time elapsed since the last activity, depending 
on the association of the pull-request author.

## Configuration example

```yml
- plugin: ubiquibot/automated-merging
  name: automated-merging
  id: automated-merging
  description: "Automatically merge pull-requests"
  with: # these are the example settings, the kernel passes these to the plugin.
    collaboratorMinimumApprovalsRequired: 1
    contributorMinimumApprovalsRequired: 2
    collaboratorMergeTimeout: "3.5 days"
    contributorMergeTimeout: "7 days"
```

## Testing

```shell
yarn test
```
