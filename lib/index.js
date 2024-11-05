"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const exec_1 = require("@actions/exec");
function parseVersion(version) {
    core.info(`Parsing version: ${version}`);
    let baseVersion = version;
    let suffix = '';
    if (version.includes('-')) {
        [baseVersion, suffix] = version.split('-', 2);
        suffix = `-${suffix}`;
    }
    const parts = baseVersion.split('.');
    while (parts.length < 3)
        parts.push('0');
    const [major, minor, patch] = parts.map(p => parseInt(p, 10));
    core.info(`Parsed components - Major: ${major}, Minor: ${minor}, Patch: ${patch}, Suffix: ${suffix}`);
    return { major, minor, patch, suffix };
}
function incrementVersion(version, type) {
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
function configureGit() {
    return __awaiter(this, void 0, void 0, function* () {
        core.info('Configuring git credentials...');
        yield (0, exec_1.exec)('git', ['config', '--global', 'user.name', 'GitHub Action']);
        yield (0, exec_1.exec)('git', ['config', '--global', 'user.email', 'action@github.com']);
    });
}
function commitAndPush(filePath, newVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            core.info('Starting commit and push process...');
            yield configureGit();
            // Add the file
            core.info(`Adding ${filePath} to git...`);
            yield (0, exec_1.exec)('git', ['add', filePath]);
            // Commit changes
            core.info('Committing changes...');
            yield (0, exec_1.exec)('git', ['commit', '-m', `Increment version to ${newVersion}`]);
            // Push changes
            core.info('Pushing changes...');
            yield (0, exec_1.exec)('git', ['push']);
            core.info('Successfully committed and pushed version update');
        }
        catch (error) {
            core.error('Failed to commit and push changes:');
            if (error instanceof Error) {
                core.error(error.message);
                throw error;
            }
            throw new Error('Failed to commit and push changes');
        }
    });
}
function addPRComment(newVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info('=== PR Comment Function Start ===');
        const token = core.getInput('github-token', { required: true });
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
            yield octokit.rest.issues.createComment(Object.assign(Object.assign({}, context.repo), { issue_number: prNumber, body: `⚠️ Reminder: Version should be updated to \`${newVersion}\` in build.gradle` }));
            core.info('Successfully added PR comment');
        }
        catch (error) {
            core.error('Failed to add PR comment:');
            if (error instanceof Error) {
                core.error(error.message);
                core.error(error.stack || 'No stack trace');
            }
            throw error;
        }
    });
}
function updateGradleFile(filePath, newVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info(`Reading gradle file at path: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf8');
        core.info(`Current file content: ${content}`);
        const updatedContent = content.replace(/version\s*=\s*['"](.*?)['"]/, `version = "${newVersion}"`);
        core.info(`Updated file content: ${updatedContent}`);
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        core.info(`Updated version in ${filePath} to ${newVersion}`);
        // Add commit and push after file update
        yield commitAndPush(filePath, newVersion);
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            core.info('=== Action Start ===');
            const filePath = core.getInput('file-path');
            const incrementType = core.getInput('increment-type');
            const mode = core.getInput('mode', { required: true });
            core.info(`Running with mode: ${mode}`);
            core.info(`File path: ${filePath}`);
            core.info(`Increment type: ${incrementType}`);
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
                yield updateGradleFile(filePath, newVersion);
            }
            else if (mode === 'comment-only') {
                core.info('Executing comment-only mode');
                yield addPRComment(newVersion);
            }
            else {
                throw new Error(`Invalid mode: ${mode}. Must be either 'update-file' or 'comment-only'`);
            }
            core.setOutput('previous-version', currentVersion);
            core.setOutput('new-version', newVersion);
            core.info('=== Action End ===');
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(`Action failed: ${error.message}`);
                core.error(error.stack || 'No stack trace');
            }
            else {
                core.setFailed('An unknown error occurred');
            }
        }
    });
}
run();
