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
  core.info('=== PR Comment Function Start ===');

  const token = core.getInput('github-token', { required: true });
  core.info(`Token received: ${token ? 'Yes' : 'No'}`);
  if (!token) {
    throw new Error('No GitHub token provided');
  }
  core.info('GitHub token found');


  const octokit = github.getOctokit(token);
  const context = github.context;

  core.info('Context debug info:');
  core.info(`Event name: ${context.eventName}`);
  core.info(`Action: ${context.action}`);
  core.info(`Repo: ${context.repo.owner}/${context.repo.repo}`);
  core.info(`Payload has PR: ${!!context.payload.pull_request}`);

  if (!context.payload.pull_request) {
    core.info('Not in a pull request context - skipping PR comment');
    return;
  }

  const prNumber = context.payload.pull_request.number;
  core.info(`PR number: ${prNumber}`);

  try {
    core.info('Attempting to create comment...');
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: prNumber,
      body: `⚠️ Reminder: Version should be updated to \`${newVersion}\` in build.gradle`
    });
    core.info('Successfully added PR comment');
  } catch (error) {
    core.error('Failed to add PR comment:');
    if (error instanceof Error) {
      core.error(error.message);
      core.error(error.stack || 'No stack trace');
    } else {
      core.error('Unknown error type');
    }
    throw error;  // Re-throw to ensure the action fails if comment creation fails
  }

  core.info('=== PR Comment Function End ===');
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
    core.info('=== Action Start ===');

    const filePath = core.getInput('file-path');
    const incrementType = core.getInput('increment-type');
    const mode = core.getInput('mode', { required: true });

    core.info(`Running with mode: ${mode}`);
    core.info(`File path: ${filePath}`);
    core.info(`Increment type: ${incrementType}`);

    // Rest of your existing code for version parsing and incrementing...

    const content = fs.readFileSync(filePath, 'utf8');
    const versionMatch = content.match(/version\s*=\s*['"](.*?)['"]/);
    if (!versionMatch) {
      throw new Error('Version not found in gradle file');
    }

    const currentVersion = versionMatch[1];
    const parsedVersion = parseVersion(currentVersion);
    const newVersion = incrementVersion(parsedVersion, incrementType);

    core.info(`Mode check - current mode: ${mode}`);
    if (mode === 'update-file') {
      core.info('Executing update-file mode');
      await updateGradleFile(filePath, newVersion);
    } else if (mode === 'comment-only') {
      core.info('Executing comment-only mode');
      await addPRComment(newVersion);
    } else {
      throw new Error(`Invalid mode: ${mode}. Must be either 'update-file' or 'comment-only'`);
    }

    core.setOutput('previous-version', currentVersion);
    core.setOutput('new-version', newVersion);

    core.info('=== Action End ===');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Action failed: ${error.message}`);
      core.error(error.stack || 'No stack trace');
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();