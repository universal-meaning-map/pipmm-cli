# Pseudo Interplanetary Mindmap CLI

Pseudo Interplanetary Mind-map is a set of tools meant to explore and play with the underlying assumptions of IPMM. It'


# Overview

The Ipmm repo is currently a single JSON file when stored in disk. It could be a single JSON/IPLD object per note
Each command registers to a log file.
Each command loads the entire Ipmm repo unless the `init` daemon is running in which case it will be in memory.
Unless specified it uses the repo paths specified in the `config.json` file

# Commands

`init`[daemon]: Loads the Ipmm repo in memory. Runs the rest of commands over it. When a command is ran it stores the repo back into disk.
`add` <notePath>: Creates a new note. Returns its noteUid.
`get` <noteUid>: Returns a JSON object of the given note
`update` <noteUid, JSON object> Overrides a given note. If is in `sync` mode it will override the Foam note too.
`stats`: Has multiple statistical data about ipmm
`status`: Outputs info about the running demons and the state of the ipmm repo
`logs`: Outputs the latest opperations
`publish`: Exports a JSON object based on each note access control configuration
`config`: Sets properties of the config file

- `ipmm_path`: Sets the default repo path for ipmmm
- `foam_path`: Sets the default repo path for foam

`foam`: Foam related commands

- `import`: Parses the Foam repo and creates a new ipmm repo  
- `export`: Outputs a Foam repo from the ipmm repo
- `watch`[daemon]: Listens to the foam repo for changes and it updates the ipmm repo
- `sync`[daemon]: Listen for changes in foam and ipmm and syncs the other one. Exclusive to `watch`

# Reference 

## Foam

Flags

-fr=<path>, --foam_repo=<path>: Path of the FOAM repository. Defaults to config file if not specified
-ir=<path>, --ipmm_repo=<path>: Path of the Ipmm repository. Defaults to config file if not specfifed

`foam import`

> Parses a FOAM repo and converts it in a IPMM repo that lives in memory[
> Takes the current folder if is not specified with `path`]

`foam export``

`foam sync`

`foam watch`
[]
## status

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
