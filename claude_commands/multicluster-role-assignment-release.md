---
description: Create CI configuration for new multicluster-role-assignment release
args: "[new_release_version]"
allowed-tools: Read, Edit, Write, Bash(python3 -m venv venv/; source venv/bin/activate; python3 -m pip install pyyaml; CONTAINER_ENGINE=docker CONTAINER_ENGINE_OPTS='--platform linux/arm64' make update; deactivate; git status), AskUserQuestion, Glob
---

# Multicluster Role Assignment Release Setup

You are helping the user set up CI configuration for a new multicluster-role-assignment release.

## Command Arguments

This command accepts an optional argument: `/multicluster-role-assignment-release [new_release_version]`
- If argument is provided (e.g., `/multicluster-role-assignment-release 2.17`), use it directly
- If no argument is provided, prompt the user for the new release version

## Overview

This command automates the routine release upgrade process for the stolostron/multicluster-role-assignment repository. It creates new CI configuration files, updates existing files with the new version, and regenerates job configurations using `make update`.

## Steps to Follow

### 1. Get and validate the new release version
- If ARGUMENTS are provided, parse to extract the new release version (e.g., "2.17")
- If no ARGUMENTS are provided, ask the user for the new release version
- Validate format: should be in format "X.YZ" or "X.Y" (e.g., "2.16", "2.17")
- Normalize to standard format without "release-" prefix

### 2. Determine the current/previous release version
- List files in `ci-operator/config/stolostron/multicluster-role-assignment/`
- Find the latest existing release config file (pattern: `stolostron-multicluster-role-assignment-release-*.yaml`)
- Extract the previous version number from the filename
- Display to user: "Found existing release: {previous_version}, creating new release: {new_version}"
- **Critical verification**: Read the previous release config file to ensure it will be used as the template

### 3. Verify release branch exists in upstream repository
**IMPORTANT PREREQUISITE CHECK**

Before proceeding with CI configuration changes, confirm the release branch exists:
- Display a clear message to the user:
  ```
  ⚠️  PREREQUISITE: Release Branch Creation

  Before updating CI configuration, you must create the release-{new_version} branch
  in the stolostron/multicluster-role-assignment repository.

  This is a manual step that must be completed first.

  Have you created the release-{new_version} branch in stolostron/multicluster-role-assignment?
  ```
- Use AskUserQuestion to confirm the user has created the branch
- If user answers "No" or is unsure:
  - Provide instructions: "Please create the release-{new_version} branch in the stolostron/multicluster-role-assignment repository first, then run this command again."
  - Exit immediately without making any changes
- Only proceed if user confirms "Yes"

### 4. Create new release config file
**File**: `ci-operator/config/stolostron/multicluster-role-assignment/stolostron-multicluster-role-assignment-release-{new_version}.yaml`

- Read the previous release config file (e.g., `stolostron-multicluster-role-assignment-release-{previous_version}.yaml`)
- Create the new release config file by copying the previous one
- Make the following transformations:
  - In the `promotion.to[0].name` field: change `"{previous_version}"` to `"{new_version}"`
  - In the `zz_generated_metadata.branch` field: change `release-{previous_version}` to `release-{new_version}`
  - All other content remains identical
- Write the new file

### 5. Update main config file
**File**: `ci-operator/config/stolostron/multicluster-role-assignment/stolostron-multicluster-role-assignment-main.yaml`

Read the main config file and make these changes:
- In the `promotion.to[0].name` field: change `"{previous_version}"` to `"{new_version}"`
- In the `fast-forward` test's `env.DESTINATION_BRANCH` field: change `release-{previous_version}` to `release-{new_version}`

Use the Edit tool to make these two changes.

### 6. Update Prow config file
**File**: `core-services/prow/02_config/stolostron/multicluster-role-assignment/_prowconfig.yaml`

Read the Prow config file and make these changes:

a. **Update main branch contexts**: In the `branch-protection.orgs.stolostron.repos.multicluster-role-assignment.branches.main.required_status_checks.contexts` section:
   - Change all instances of `acm-{previous_version_short}` to `acm-{new_version_short}`
   - Example: `acm-215` → `acm-216` (version without dots)

b. **Add new release branch section**: After the previous release branch section (e.g., `release-{previous_version}`), add a new section for the new release:
   ```yaml
   release-{new_version}:
     required_status_checks:
       contexts:
       - Red Hat Konflux / multicluster-role-assignment-acm-{new_version_short}-on-pull-request
       - Red Hat Konflux / enterprise-contract-acm-{new_version_short} / multicluster-role-assignment-acm-{new_version_short}
   ```
   where `{new_version_short}` is the version without dots (e.g., "216" for "2.16")

**Important**: The YAML indentation must be preserved exactly. The new release section should be at the same indentation level as the other release sections.

### 7. Run make update
After all files are modified, regenerate downstream artifacts (job configs, metadata, etc.):

**Setup Python virtual environment (if needed):**
- Check if `venv/` directory exists
- If it doesn't exist, create it: `python3 -m venv venv/`
- Activate the virtual environment: `source venv/bin/activate`
- Install pyyaml: `python3 -m pip install pyyaml`

**Run make update:**
- Execute: `CONTAINER_ENGINE=docker CONTAINER_ENGINE_OPTS='--platform linux/arm64' make update`
- This will create the new job files:
  - `ci-operator/jobs/stolostron/multicluster-role-assignment/stolostron-multicluster-role-assignment-release-{new_version}-postsubmits.yaml`
  - `ci-operator/jobs/stolostron/multicluster-role-assignment/stolostron-multicluster-role-assignment-release-{new_version}-presubmits.yaml`
- Display the output to user
- If `make update` succeeds, verify the job files were created
- If `make update` fails, display the error and suggest manual intervention
- After completion, deactivate the virtual environment: `deactivate`

### 8. Summary and next steps
Provide a summary to the user:
- New release config created: `stolostron-multicluster-role-assignment-release-{new_version}.yaml`
- Main config updated with new version: {new_version}
- Prow config updated with new branch protection
- Job configs generated by `make update`
- List all files that were created or modified

Suggest next steps:
- Review the changes with `git status` and `git diff`
- Test the configuration if needed
- Commit the changes with an appropriate message like:
  ```
  CI setup for MulticlusterRoleAssignment for {new_version} new release branch
  ```
- Create a follow-up commit for branch protection updates if needed:
  ```
  multicluster-role-assignment: branch protection update with konflux {new_version}
  ```

## Important Notes

- **DO NOT manually edit files in `ci-operator/jobs/`** - these are auto-generated by `make update`
- The new release config file should be nearly identical to the previous release, only changing version numbers
- The `zz_generated_metadata` in config files will be updated by `make update`
- Preserve exact YAML formatting and indentation
- The version number format changes between contexts:
  - Config files: "2.16" (with dot)
  - Prow contexts: "216" (without dot, "acm-216")
  - Branch names: "release-2.16" (with "release-" prefix)

## Error Handling

- If the previous release config file doesn't exist, ask user which version to copy from
- If `make update` fails, display the error and suggest checking logs
- If files already exist, ask user if they want to overwrite
- If version format is invalid, ask user to provide a valid version number
