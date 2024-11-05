import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

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

async function run(): Promise<void> {
  try {
    // Get inputs
    const filePath = core.getInput('file-path');
    const incrementType = core.getInput('increment-type');

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

    // Update file content
    const updatedContent = content.replace(
      /version\s*=\s*['"](.*?)['"]/, 
      `version = "${newVersion}"`
    );

    // Write back to file
    fs.writeFileSync(filePath, updatedContent, 'utf8');

    // Set outputs
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
