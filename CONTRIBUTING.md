# Contributing to this repository

We welcome your contributions! There are multiple ways to contribute, even if you're not a developer.

## Opening issues

If you think you've found a security vulnerability, do not open a GitHub issue. Instead, follow the instructions in our security policy.

To report a bug or request an enhancement that is not related to a security vulnerability, open a GitHub issue. When filing a bug, remember that the better written the bug is, the easier and more likely it is to be reproduced and fixed.

## Pre-requisites for code or documentation submissions

Before we can review or accept any source code or documentation-related contribution, you will need to digitally sign the [Oracle Contributor Agreement (OCA)](https://oca.opensource.oracle.com/) using the OCA Signing Service. This only needs to be done once, so if you've signed it for another repository or project, there is no need to sign again.

All your commit messages must include the following line using the same name and email address you used to sign the OCA:

```
Signed-off-by: Your Name <you@example.org>
```

This can be automatically added to pull requests by committing with --sign-off or -s, e.g.

```
git commit --signoff
```

We can only accept pull requests from contributors who have been verified as having signed the OCA.

## Commit messages

This project uses Conventional Commits and is Commitizen friendly.

If you already have Commitizen installed, you can run `git cz ...` instead of `git commit ...` and Commitizen will make sure your commit message is in the right format and provides all the necessary information.

If you don't have Commitizen installed, a pre-commit git hook will analyze your commit message and report anything that needs to be fixed. For example:

```
$ git commit -m "Updated the contribution guide."
⧗   input: Updated the contribution guide.
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
⚠   message must be signed off [signed-off-by]

✖   found 2 problems, 1 warnings
ⓘ   Get help: https://github.com/oracle-actions/.github/blob/main/CONTRIBUTING.md#commit-messages

husky - commit-msg hook exited with code 1 (error)
```

If you have any questions, please check the Conventional Commits FAQ, start a discussion or open an issue.

## Development Workflow

Our project follows a structured release process from development to production:

1. **Development Phase**:
   - Create a feature branch from `development`: `git checkout -b feature/my-feature`
   - Make your changes following the [Conventional Commits](https://www.conventionalcommits.org/) format
   - Run tests locally: `npm test`
   - Commit changes: `git commit -m "feat: add new feature"`
   - Push to your feature branch: `git push origin feature/my-feature`

2. **Integration to Development**:
   - Create a pull request targeting the `development` branch
   - Address review comments and ensure all checks pass
   - Squash commits if necessary to maintain a clean history
   - Merge the pull request to `development`
   - Verify integration tests pass on the `development` branch

3. **Creating a Release**:
   - When ready to release, create a pull request from `development` to `main`
   - This PR represents a release candidate
   - Run final verification on the release candidate
   - Once approved, merge the pull request to `main`

4. **Release Tagging**:
   - After merging to `main`, manually create a tag to trigger the release process:
     ```bash
     git checkout main
     git pull
     git tag -a v0.1.0 -m "Initial release"  # Or appropriate version
     git push origin v0.1.0
     ```
   - The GitHub workflow is triggered when a tag matching `v*` is pushed
   - Once triggered, semantic-release will:
     - Analyze the commits since the last release
     - Determine the appropriate version number based on conventional commits
     - Generate release notes automatically from commit messages
     - Create a GitHub release with the determined version (independent of your manually created tag)
     - Publish the package to npm (if configured)

## Pull request process

1. Ensure there is an issue created to track and discuss the fix or enhancement you intend to submit.
2. Fork this repository
3. Create a branch in your fork to implement the changes. We recommend using the issue number as part of your branch name, e.g. `1234-fixes`
4. Ensure that any documentation is updated with the changes that are required by your change.
5. Submit the pull request. Do not leave the pull request blank. Explain exactly what your changes are meant to do and provide simple steps on how to validate your changes. Ensure that you reference the issue you created as well.
6. We will assign the pull request to specific people for review before it is merged.

## Code of conduct

Our Code of Conduct is adapted from the Contributor Covenant, version 1.4, available at https://www.contributor-covenant.org/version/1/4/code-of-conduct.html.