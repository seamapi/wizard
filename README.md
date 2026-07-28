# Seam Wizard

[![npm](https://img.shields.io/npm/v/@seamapi/wizard.svg)](https://www.npmjs.com/package/@seamapi/wizard)
[![GitHub Actions](https://github.com/seamapi/wizard/actions/workflows/check.yml/badge.svg)](https://github.com/seamapi/wizard/actions/workflows/check.yml)

The AI powered Seam setup wizard.

## Description

TODO

This package is not a standalone command line program:
it deliberately publishes no `bin`.
The wizard is distributed as a library and mounted by the
[Seam CLI](https://github.com/seamapi/cli) under `seam wizard`.

## Installation

Add this as a dependency to your project using [npm] with

```
$ npm install @seamapi/wizard
```

[npm]: https://www.npmjs.com/

## Usage

Mount the entire wizard as a subcommand by forwarding the arguments
that belong to the wizard to the default export:

```ts
import wizard from '@seamapi/wizard'

// e.g., for `seam wizard --help`, argv is `['--help']`.
await wizard({
  argv: process.argv.slice(3),
  commandName: 'seam wizard',
})
```

The `commandName` option is only used in help output
so that the wizard describes itself using the command
that was actually run.

## Development and Testing

### Quickstart

```
$ git clone https://github.com/seamapi/wizard.git
$ cd wizard
$ nvm install
$ npm install
$ npm run test:watch
```

Run the wizard locally with

```
$ npm run wizard
```

This runs the development CLI in `src/bin/cli.ts`,
which simply calls the wizard with the arguments given.
That file exists for local development only:
it is excluded from the build and from the published package.

Primary development tasks are defined under `scripts` in `package.json`
and available via `npm run`.
View them with

```
$ npm run
```

### Source code

The [source code] is hosted on GitHub.
Clone the project with

```
$ git clone git@github.com:seamapi/wizard.git
```

[source code]: https://github.com/seamapi/wizard

### Requirements

You will need [Node.js] with [npm] and a [Node.js debugging] client.

Be sure that all commands run under the correct Node version, e.g.,
if using [nvm], install the correct version with

```
$ nvm install
```

Set the active version for each shell session with

```
$ nvm use
```

Install the development dependencies with

```
$ npm install
```

[Node.js]: https://nodejs.org/
[Node.js debugging]: https://nodejs.org/en/docs/guides/debugging-getting-started/
[npm]: https://www.npmjs.com/
[nvm]: https://github.com/creationix/nvm

### Publishing

#### Automatic

New versions are released automatically with [semantic-release]
as long as commits follow the [Angular Commit Message Conventions].

[Angular Commit Message Conventions]: https://semantic-release.gitbook.io/semantic-release/#commit-message-format
[semantic-release]: https://semantic-release.gitbook.io/

#### Manual

Publish a new version by triggering a [version workflow_dispatch on GitHub Actions].
The `version` input will be passed as the first argument to [npm-version].

This may be done on the web or using the [GitHub CLI] with

```
$ gh workflow run version.yml --raw-field version=<version>
```

[GitHub CLI]: https://cli.github.com/
[npm-version]: https://docs.npmjs.com/cli/version
[version workflow_dispatch on GitHub Actions]: https://github.com/seamapi/wizard/actions?query=workflow%3Aversion

## GitHub Actions

_GitHub Actions should already be configured: this section is for reference only._

The following repository secrets must be set on [GitHub Actions]:

- `GH_TOKEN`: A personal access token for the bot user with
  `packages:write` and `contents:write` permission.
- `GIT_USER_NAME`: The GitHub bot user's real name.
- `GIT_USER_EMAIL`: The GitHub bot user's email.
- `GPG_PRIVATE_KEY`: The GitHub bot user's [GPG private key].
- `GPG_PASSPHRASE`: The GitHub bot user's GPG passphrase.

[GitHub Actions]: https://github.com/features/actions
[GPG private key]: https://github.com/marketplace/actions/import-gpg#prerequisites

## Contributing

> If using squash merge, edit and ensure the commit message follows the [Angular Commit Message Conventions] specification.
> Otherwise, each individual commit must follow the [Angular Commit Message Conventions] specification.

1. Create your feature branch (`git checkout -b my-new-feature`).
2. Make changes.
3. Commit your changes (`git commit -am 'Add some feature'`).
4. Push to the branch (`git push origin my-new-feature`).
5. Create a new draft pull request.
6. Ensure all checks pass.
7. Mark your pull request ready for review.
8. Wait for the required approval from the code owners.
9. Merge when ready.

[Angular Commit Message Conventions]: https://semantic-release.gitbook.io/semantic-release/#commit-message-format

## License

This npm package is licensed under the MIT license.

## Warranty

This software is provided by the copyright holders and contributors "as is" and
any express or implied warranties, including, but not limited to, the implied
warranties of merchantability and fitness for a particular purpose are
disclaimed. In no event shall the copyright holder or contributors be liable for
any direct, indirect, incidental, special, exemplary, or consequential damages
(including, but not limited to, procurement of substitute goods or services;
loss of use, data, or profits; or business interruption) however caused and on
any theory of liability, whether in contract, strict liability, or tort
(including negligence or otherwise) arising in any way out of the use of this
software, even if advised of the possibility of such damage.
