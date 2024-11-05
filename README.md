# Gradle Version Incrementer

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
      - uses: actions/checkout@v3
      - name: Increment version
        uses: sardul3/gradle-version-incrementer@v1
        with:
          file-path: 'app/build.gradle'
          increment-type: 'patch'  # or 'minor' or 'major'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `file-path` | Path to the gradle file | No | `app/build.gradle` |
| `increment-type` | Type of increment | No | `patch` |

## Outputs

| Output | Description |
|--------|-------------|
| `previous-version` | The version before incrementing |
| `new-version` | The version after incrementing |

## License

MIT
