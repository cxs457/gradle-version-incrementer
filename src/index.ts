import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';

interface Version {
  major: number;
  minor: number;
  patch: number;
  suffix: string;
}

function parseVersion(version: string): Version {
  // Split version into base version and suffix (if any)
  let baseVersion = version;
  let suffix = '';

  if (version.includes('-')) {
    [baseVersion, suffix] = version.split('-', 2);
    suffix = `-${suffix}`;
  }

  // Parse version components
  const parts = baseVersion.split('.');
  while (parts.length < 3) parts.push('0');

  const [major, minor, patch] = parts.map(p => parseInt(p, 10));

  return { major, minor, patch, suffix };
}

function incrementVersion(version: Version, type: string): string {
  switch (type.toLowerCase()) {
    case 'major':
      return `${version.major + 1}.0.0${version.suffix}`;
    case 'minor':
      return `${version.major}.${version.minor + 1}.0${version.suffix}`;
    case 'patch':
      return `${version.major}.${version.minor}.${version.patch + 1}${version.suffix}`;
    default:
      throw new Error(`Invalid increment type: ${type}`);
  }
}

async function addPRComment(newVersion: string): Promise<void> {
  const token = core.getInput('github-token', { required: true });
  const octokit = github.getOctokit(token);
  const context = github.context;

  // Only proceed if we're in a PR context
  if (!context.payload.pull_request) {
    core.debug('Not in a pull request context - skipping PR comment');
    return;
  }

  try {
    // Add a comment to the PR with the version update information
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: context.payload.pull_request.number,
      body: `⚠️ Reminder: Version should be updated to \`${newVersion}\` in build.gradle`
    });
  } catch (error) {
    core.warning(`Failed to add PR comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function updateGradleFile(filePath: string, newVersion: string): Promise<void> {
  // Read the gradle file
  const content = fs.readFileSync(filePath, 'utf8');

  // Update file content
  const updatedContent = content.replace(
      /version\s*=\s*['"](.*?)['"]/,
      `version = "${newVersion}"`
  );

  // Write back to file
  fs.writeFileSync(filePath, updatedContent, 'utf8');
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const filePath = core.getInput('file-path');
    const incrementType = core.getInput('increment-type');
    const mode = core.getInput('mode', { required: true }); // 'update-file' or 'comment-only'

    // Read the gradle file
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract current version
    const versionMatch = content.match(/version\s*=\s*['"](.*?)['"]/);
    if (!versionMatch) {
      throw new Error('Version not found in gradle file');
    }

    const currentVersion = versionMatch[1];
    core.debug(`Current version: ${currentVersion}`);

    // Parse and increment version
    const parsedVersion = parseVersion(currentVersion);
    const newVersion = incrementVersion(parsedVersion, incrementType);
    core.debug(`New version: ${newVersion}`);

    // Based on mode, either update file or add comment
    if (mode === 'update-file') {
      await updateGradleFile(filePath, newVersion);
      core.info(`Updated version in ${filePath} to ${newVersion}`);
    } else if (mode === 'comment-only') {
      await addPRComment(newVersion);
      core.info(`Added reminder comment about version ${newVersion}`);
    } else {
      throw new Error(`Invalid mode: ${mode}. Must be either 'update-file' or 'comment-only'`);
    }

    // Set outputs regardless of mode
    core.setOutput('previous-version', currentVersion);
    core.setOutput('new-version', newVersion);

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();