# ipmm-cli

# Ref

https://dev.to/kenanchristian/build-an-interactive-cli-using-typescript-11fl

An option tells the function how to act (e.g. -a, -l, --verbose, --output , -name , -c , etc), whist an arguments tells the function what to act on/from (e.g. \*, file1, hostname, database).

# Overview

## Processs

`init`: Loads the last repo and starts listening for calls. Shows status and logs
`watch`: Starts listening to the foam repo for changes and it updates the ipmm repo
`sync`: Exclusive to `watch` is biderectional

## Calls:

`add` <note path>: Creates a new note. Returns its [[note-uid-1612383211]]
`get` <[[note-uid-1612383211]]>: Returns a JSON object of the given [[note-1612421759]]
`update` <[[note-uid-1612383211]], JSON object> Overrides a given note. If is in `sync` mode it will override the Foam note too.

# Commands

## foam

> Commands to opperate with a Foam repo

### sync

### import

> Parses a FOAM repo and converts it in a IPMM repo that lives in memory
> Takes the current folder if is not specified with `path`

Args

- repo_path: Path of the FOAM repository to import

### snapshot

> Takes current IPMM repo and converts it into a JSON array o notes
> If no `snapshot_path` is specified it outputs a file in the current directory like <ipmm_timestamp.json>

Args

- snapshot_path: Path of the generated JSON file

### export

> Takes a IPMM repo and creates a FOAM repo
> If no `repo_path` is specified it will use the current one

Args

- repo_path: Path of the FOAM repository to export

## status

> Logs the status of the IPMM repo
>
> - Number of notes
> - Last imported time

## stats

> Commands that give stats of an IPMM repo

- Number of notes
- Number of connections per note in a given property
- Most edited documents in the last X time

## publish

> Exports IPMM repo based on each note defined access control

## help

> display help for ipmm

```
USAGE
  $ ipmm help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```
