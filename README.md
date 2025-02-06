Forked from [sardul3/gradle-version-incrementer](https://github.com/sardul3/gradle-version-incrementer)

# Gradle Properties Version Incrementer

A GitHub Action to automatically increment version numbers in Gradle build files.

## Features

- Supports SNAPSHOT versions
- Can increment major, minor, or patch versions
- Preserves version suffixes
- Simple integration

## Usage

```yaml
name: Increment Version

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  increment-version:
    runs-on: ubuntu-latest
    steps:
     # To just add a reminder comment:
      - uses: cxs457/gradle-version-incrementer@1.0.2

        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          file-path: 'build.gradle'
          increment-type: 'patch'
          mode: 'comment-only'
    
      # Or to actually update the file:
      - uses: cxs457/gradle-version-incrementer@1.0.2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          file-path: 'build.gradle'
          increment-type: 'patch'
          mode: 'update-file'
```

## Inputs

| Input | Description                       | Required | Default |
|-------|-----------------------------------|----------|---------|
| `github-token` | already present for all workflows | Yes      | N/A     |
| `file-path` | Path to the gradle file           | Yes      | N/A     |
| `increment-type` | Type of increment                 | Yes      | N/A     |

## Outputs

| Output | Description |
|--------|-------------|
| `previous-version` | The version before incrementing |
| `new-version` | The version after incrementing |

## License

MIT
