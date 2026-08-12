# Seam Wizard

[![npm](https://img.shields.io/npm/v/@seamapi/wizard.svg)](https://www.npmjs.com/package/@seamapi/wizard)
[![GitHub Actions](https://github.com/seamapi/wizard/actions/workflows/check.yml/badge.svg)](https://github.com/seamapi/wizard/actions/workflows/check.yml)

The AI powered Seam setup wizard.

## Description

An interactive terminal wizard that takes a project from zero to a working
Seam integration. Run inside a project, it will:

1. **Detect the project** — JavaScript/TypeScript or Python,
   and the package manager or installer in use.
2. **Connect a Seam account** — an existing `SEAM_API_KEY`
   in the environment or a `.env*` file is verified and reused.
   Otherwise the developer can continue in the browser, where the
   Console mints a fresh key and hands it back over a localhost
   callback, or paste a key by hand.
   Either way the key is verified and saved to `.env`.
3. **Install the Seam SDK** — `seam` via npm, pnpm, yarn, or bun
   for JavaScript, or pip, poetry, or uv for Python.
4. **Install the Seam plugin** —
   [`seamapi/seam-plugin`](https://github.com/seamapi/seam-plugin),
   which provides the Seam integration skills and the `seam-docs` MCP
   for the developer's AI coding assistant.
   Claude Code is detected via `.claude` or `CLAUDE.md`,
   in which case the wizard prints the slash commands to run,
   since an external program cannot drive them.
5. **Write the integration** — optionally. The wizard analyzes the
   project, recommends an approach, confirms it with the developer,
   records the plan in `.seam/onboarding.json`, and then runs an
   embedded agent that writes the integration for review as a diff.

The wizard never asks for a password: keys are created in the browser
or pasted, never minted here. Inference for the analysis and the
embedded agent is routed through Seam, so no developer Anthropic API
key is needed.

The wizard is built with [Ink] and takes over the terminal for the
duration of a run, restoring it and reprinting a transcript on the way
out.

This package is not a standalone command line program:
it deliberately publishes no `bin`.
The wizard is distributed as a library and mounted by the
[Seam CLI](https://github.com/seamapi/cli) under `seam wizard`.

[Ink]: https://github.com/vadimdemedes/ink

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

The wizard handles `--help` and `--version` itself
and otherwise takes over the terminal
until the developer finishes, then restores it and prints a transcript of
the run. It resolves when the wizard is done, and only rejects if the
wizard could not run at all: a step that fails reports itself to the
developer and does not reject.

Pass `cwd` to set the project root the wizard sets up.
It defaults to `process.cwd()`,
which is the project the command was run in.
The wizard reads and writes files there,
e.g., `.env` and `.seam/onboarding.json`.

```ts
await wizard({
  argv: process.argv.slice(3),
  commandName: 'seam wizard',
  cwd: '/path/to/project',
})
```

### Environment variables

- `SEAM_API_KEY`: An existing Seam API key.
  When set, the wizard verifies and reuses it instead of asking
  the developer to connect an account.
  The wizard also looks for this in the project's `.env*` files,
  and writes the key it obtains back to `.env`.
- `SEAM_CONSOLE_URL`: Points the browser connection flow at a
  non-production Console.
  Defaults to `https://console.seam.co`.

## Development and Testing

### Quickstart

```
$ git clone https://github.com/seamapi/wizard.git
$ cd wizard
$ nvm install
$ npm install
$ npm run test:watch
```

Run the wizard locally against a project with

```
$ npm run wizard -- --cwd <project>
```

Run any other Seam CLI command with

```
$ npm run seam -- login
$ npm run seam -- devices list
```

Both run the Seam CLI from `devDependencies` through `src/bin/seam.ts`,
with its `@seamapi/wizard` import pointed at this checkout,
so the wizard runs as `seam wizard` does and with the adapter the CLI
gives it.
That file exists for local development only:
it is excluded from the build and from the published package.

`--cwd <path>` is an option of that entry, for running against a scratch
project instead of this repository.
Every other argument is passed to the CLI untouched.

### Source layout

The wizard is an [Ink] application under `src/lib`:

- `wizard.ts` is the entrypoint the package exports.
  It parses arguments, handles `--help` and `--version`,
  and hands off to the renderer.
- `render.tsx` runs the app full-screen
  and reprints its transcript on exit.
- `app.tsx` is the state machine driving the run,
  one phase per step, and holds all of the rendering.
- `steps/` holds the logic for each step, with no UI in it.
- `util/` holds the Seam API client, dotenv handling,
  and the subprocess runner.
- `version.ts` holds the package version reported by `--version`.
  It ships a `0.0.0` placeholder that `prepack.ts` replaces with the
  version from `package.json` when the package is packed,
  recompiling just that module with `tsconfig.prepack.json`.
  The version is only correct in a packed or published package,
  not when running from a clone.

Modules under `src/lib` are imported through the `lib/*` path alias
rather than parent-relative specifiers.

Types that mirror the Seam API wire format
or the on-disk `.seam/onboarding.json` record keep their `snake_case`
property names, which the lint configuration allows.

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
