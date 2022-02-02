# Pseudo Interplanetary mind-map CLI

`Pseudo Interplanetary mind-map` is a set of tools meant to play with the underlying assumptions of `Interplanetary mind-map`.

Is `pseudo` because it neglects many aspects of its design in order to focus on its more challenging conceptual unknowns.  See the [docs](https://github.com/interplanetarymindmap/docs) repository to get a better overview.


## Install

```
npm install pipmm -g
```

## Commands

- `help`: display help for `pipmm`
- `init`: Generates initial configuration, the `MID` (mind-identifier)
- `export`: Compiles the `Abstractions` repository (or a single note) into an IPMM repo and saves it as JSON object and its keys
- `log`: View the logs from the last command ran
- `filter`: Returns a list of notes based on a filter.
- `restore`: Compiles `Abstractions`repo, filters it and uploads to the server (local or remote, depending on the flag) erasing the previous version.
- `update`: Uploads a note to the server
- `watch`: Creates a local server and watches changes on the `Abstractions` repo, when a file is changed it updates the client
