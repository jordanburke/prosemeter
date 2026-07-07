# The Migration

The database was migrated by the team over the weekend. All records were copied to the
new cluster and the indexes were rebuilt afterward. The configuration was reviewed by two
engineers before the change was approved.

## Rollout

The service was restarted once the data had been validated. Traffic was gradually shifted
to the new nodes. The old cluster was kept online until the results were confirmed to be
correct. Alerts were configured so that any regression would be caught quickly.

## Aftermath

The incident report was written by the on-call engineer. Lessons were documented and the
runbook was updated. Follow-up tasks were assigned to be completed during the next sprint.
