import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import { Octokit } from "@octokit/rest";

interface Version {
  major: number;
  minor: number;
  patch: number;
  suffix: string;
}


// Function to create an Octokit instance with a user-provided token
function createOctokitInstance(userToken: any) {
  return new Octokit({
    auth: userToken, // Use the user-provided token
  });
}

function parseVersion(version: string): Version {
  core.info(`Parsing version: ${version}`);

  let baseVersion = version;
  let suffix = '';

  if (version.includes('-')) {
    [baseVersion, suffix] = version.split('-', 2);
    suffix = `-${suffix}`;
  }

  const parts = baseVersion.split('.');
  while (parts.length < 3) parts.push('0');

  const [major, minor, patch] = parts.map(p => parseInt(p, 10));
  core.info(`Parsed components - Major: ${major}, Minor: ${minor}, Patch: ${patch}, Suffix: ${suffix}`);

  return { major, minor, patch, suffix };
}

function incrementVersion(version: Version, type: string): string {
  core.info(`Incrementing version: ${JSON.stringify(version)} with type: ${type}`);

  let newVersion;
  switch (type.toLowerCase()) {
    case 'major':
      newVersion = `${version.major + 1}.0.0${version.suffix}`;
      break;
    case 'minor':
      newVersion = `${version.major}.${version.minor + 1}.0${version.suffix}`;
      break;
    case 'patch':
      newVersion = `${version.major}.${version.minor}.${version.patch + 1}${version.suffix}`;
      break;
    default:
      throw new Error(`Invalid increment type: ${type}`);
  }

  core.info(`New version: ${newVersion}`);
  return newVersion;
}

async function addPRComment(newVersion: string): Promise<void> {
  core.info(`Preparing to add PR comment for version: ${newVersion}`);

  const token = core.getInput('github-token', { required: true });
  const octokit = github.getOctokit(token);
  const context = github.context;

  // Check if we are in a PR context
  if (!context.payload.pull_request) {
    core.info('Not in a pull request context - skipping PR comment');
    return;
  }

  core.info(`PR context found - Issue number: ${context.payload.pull_request.number}`);

  try {
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: context.payload.pull_request.number,
      body: `⚠️ Reminder: Version should be updated to \`${newVersion}\` in build.gradle`
    });
    core.info('Successfully added PR comment');
  } catch (error) {
    core.warning(`Failed to add PR comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function updateGradleFile(filePath: string, newVersion: string): Promise<void> {
  core.info(`Reading gradle file at path: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf8');
  core.info(`Current file content: ${content}`);

  const updatedContent = content.replace(
      /version\s*=\s*['"](.*?)['"]/,
      `version = "${newVersion}"`
  );

  core.info(`Updated file content: ${updatedContent}`);
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  core.info(`Updated version in ${filePath} to ${newVersion}`);
}

async function run(): Promise<void> {
  try {
    const filePath = core.getInput('file-path');
    const incrementType = core.getInput('increment-type');
    const mode = core.getInput('mode', { required: true });

    core.info(`Inputs - File path: ${filePath}, Increment type: ${incrementType}, Mode: ${mode}`);

    const content = fs.readFileSync(filePath, 'utf8');
    core.info(`Read gradle file content: ${content}`);

    const versionMatch = content.match(/version\s*=\s*['"](.*?)['"]/);
    if (!versionMatch) {
      throw new Error('Version not found in gradle file');
    }

    const currentVersion = versionMatch[1];
    core.info(`Current version: ${currentVersion}`);

    const parsedVersion = parseVersion(currentVersion);
    const newVersion = incrementVersion(parsedVersion, incrementType);

    if (mode === 'update-file') {
      await updateGradleFile(filePath, newVersion);
    } else if (mode === 'comment-only') {
      await addPRComment(newVersion);
    } else {
      throw new Error(`Invalid mode: ${mode}. Must be either 'update-file' or 'comment-only'`);
    }

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
