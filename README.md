# ipmm-cli

Toolkit to make a FOAM repo to make it Interplanetary

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/ipmm-cli.svg)](https://npmjs.org/package/ipmm-cli)
[![Downloads/week](https://img.shields.io/npm/dw/ipmm-cli.svg)](https://npmjs.org/package/ipmm-cli)
[![License](https://img.shields.io/npm/l/ipmm-cli.svg)](https://github.com/xavivives/ipmm-cli/blob/master/package.json)

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g ipmm-cli
$ ipmm COMMAND
running command...
$ ipmm (-v|--version|version)
ipmm-cli/0.0.0 linux-x64 node-v15.6.0
$ ipmm --help [COMMAND]
USAGE
  $ ipmm COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`ipmm hello [FILE]`](#ipmm-hello-file)
- [`ipmm help [COMMAND]`](#ipmm-help-command)

## `ipmm hello [FILE]`

describe the command here

```
USAGE
  $ ipmm hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ ipmm hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/xavivives/ipmm-cli/blob/v0.0.0/src/commands/hello.ts)_

## `ipmm help [COMMAND]`

display help for ipmm

```
USAGE
  $ ipmm help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_

<!-- commandsstop -->

# Ref

https://dev.to/kenanchristian/build-an-interactive-cli-using-typescript-11fl

An option tells the function how to act (e.g. -a, -l, --verbose, --output , -name , -c , etc), whist an arguments tells the function what to act on/from (e.g. *, file1, hostname, database).

# Commands

## import

> Parses a FOAM repo and converts it in a IPMM repo that lives in memory
> Takes the current folder if is not specified with `path`

Args

- repo_path: Path of the FOAM repository to import

## snapshot

> Takes current IPMM repo and converts it into a JSON array o notes
> If no `snapshot_path` is specified it outputs a file in the current directory like <ipmm_timestamp.json>

Args

- snapshot_path: Path of the generated JSON file

## export

> Takes a IPMM repo and creates a FOAM repo
> If no `repo_path` is specified it will use the current one

Args

- repo_path: Path of the FOAM repository to export

## status

> Logs the status of the IPMM repo
>
> - Number of notes
> - Last imported time
