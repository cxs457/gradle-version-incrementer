import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "node:fs";
import { exec } from "@actions/exec";
import path from "node:path";

interface Version {
	major: number;
	minor: number;
	patch: number;
	suffix: string;
}

function parseVersion(version: string): Version {
	core.info(`Parsing version: ${version}`);

	let baseVersion = version;
	let suffix = "";

	if (version.includes("-")) {
		[baseVersion, suffix] = version.split("-", 2);
		suffix = `-${suffix}`;
	}

	const parts = baseVersion.split(".");
	while (parts.length < 3) parts.push("0");

	const [major, minor, patch] = parts.map((p) => Number.parseInt(p, 10));
	core.info(
		`Parsed components - Major: ${major}, Minor: ${minor}, Patch: ${patch}, Suffix: ${suffix}`,
	);

	return { major, minor, patch, suffix };
}

function incrementVersionCode(versionCode: string): number {
	const newVersionCode = Number.parseInt(versionCode, 10) + 1;

	return newVersionCode;
}

function incrementVersionName(version: Version, type: string): string {
	core.info(
		`Incrementing version: ${JSON.stringify(version)} with type: ${type}`,
	);

	let newVersion: string;
	switch (type.toLowerCase()) {
		case "major":
			newVersion = `${version.major + 1}.0.0${version.suffix}`;
			break;
		case "minor":
			newVersion = `${version.major}.${version.minor + 1}.0${version.suffix}`;
			break;
		case "patch":
			newVersion = `${version.major}.${version.minor}.${version.patch + 1}${version.suffix}`;
			break;
		default:
			throw new Error(`Invalid increment type: ${type}`);
	}

	core.info(`New version: ${newVersion}`);
	return newVersion;
}

async function configureGit(): Promise<void> {
	core.info("Configuring git credentials...");
	await exec("git", ["config", "--global", "user.name", "GitHub Action"]);
	await exec("git", ["config", "--global", "user.email", "action@github.com"]);
}

async function commitAndPush(
	filePath: string,
	newVersion: string,
): Promise<void> {
	try {
		core.info("Starting commit and push process...");

		await configureGit();

		// Add the file
		core.info(`Adding ${filePath} to git...`);
		await exec("git", ["add", filePath]);

		// Commit changes
		core.info("Committing changes...");
		await exec("git", ["commit", "-m", `Increment version to ${newVersion}`]);

		// Detect branch from PR context
		const context = github.context;
		if (!context.payload.pull_request) {
			throw new Error("Not in a pull request context - cannot detect branch");
		}

		const branchName = context.payload.pull_request.head.ref;
		core.info(`Detected branch for PR: ${branchName}`);

		// Fetch and rebase to integrate remote changes
		// core.info(`Fetching and rebasing ${branchName}...`);
		// await exec('git', ['fetch', 'origin', branchName]);
		// await exec('git', ['rebase', `origin/${branchName}`]);

		// Push changes to the detected branch
		core.info("Pushing changes...");
		await exec("git", ["push", "--force", "origin", `HEAD:${branchName}`]);

		core.info("Successfully committed and pushed version update");
	} catch (error) {
		core.error("Failed to commit and push changes:");
		if (error instanceof Error) {
			core.error(error.message);
			throw error;
		}
		throw new Error("Failed to commit and push changes");
	}
}

async function addPRComment(newVersion: string): Promise<void> {
	core.info("=== PR Comment Function Start ===");

	const token = core.getInput("github-token", { required: true });
	if (!token) {
		throw new Error("No GitHub token provided");
	}
	core.info("GitHub token found");

	const octokit = github.getOctokit(token);
	const context = github.context;

	core.info("Context debug info:");
	core.info(`Event name: ${context.eventName}`);
	core.info(`Action: ${context.action}`);
	core.info(`Repo: ${context.repo.owner}/${context.repo.repo}`);
	core.info(`Payload has PR: ${!!context.payload.pull_request}`);

	if (!context.payload.pull_request) {
		core.info("Not in a pull request context - skipping PR comment");
		return;
	}

	const prNumber = context.payload.pull_request.number;
	core.info(`PR number: ${prNumber}`);

	try {
		core.info("Attempting to create comment...");
		await octokit.rest.issues.createComment({
			...context.repo,
			issue_number: prNumber,
			body: `⚠️ Reminder: Version should be updated to \`${newVersion}\` in build.gradle`,
		});
		core.info("Successfully added PR comment");
	} catch (error) {
		core.error("Failed to add PR comment:");
		if (error instanceof Error) {
			core.error(error.message);
			core.error(error.stack || "No stack trace");
		}
		throw error;
	}
}

async function updateGradleFile(
	filePath: string,
	newVersionName: string,
	newVersionCode: number,
): Promise<void> {
	core.info(`Reading file at path: ${filePath}`);

	const content = fs.readFileSync(filePath, "utf8");
	core.info(`Current file content: ${content}`);

	const updatedContent = content
		.replace(
			/versionName\s*=\s*['"](.*?)['"]/,
			`versionName = "${newVersionName}"`,
		)
		.replace(/versionCode\s*=\s*\d{0,}/, `versionCode = ${newVersionCode}`);

	core.info(`Updated file content: ${updatedContent}`);
	fs.writeFileSync(filePath, updatedContent, "utf8");
	core.info(`Updated version in ${filePath} to ${newVersionName}`);

	// Add commit and push after file update
	await commitAndPush(filePath, newVersionName);
}

async function run(): Promise<void> {
	try {
		core.info("=== Action Start ===");

		const filePath = core.getInput("file-path");
		const incrementType = core.getInput("increment-type");
		const mode = core.getInput("mode", { required: true });

		core.info(`Running with mode: ${mode}`);
		core.info(`File path: ${filePath}`);
		core.info(`Increment type: ${incrementType}`);

		const content = fs.readFileSync(path.resolve(filePath), "utf8");
		const versionNameMatch = content.match(/versionName\s*=\s*['"](.*?)['"]/);
		const versionCodeMatch = content.match(/versionCode\s*=\s*\d{0,}/);

		if (!versionCodeMatch) {
			throw new Error("Version code not found");
		}

		if (!versionNameMatch) {
			throw new Error("Version name not found");
		}
		const currentVersionCode = versionCodeMatch[1];
		const currentVersionName = versionNameMatch[1];
		const parsedVersion = parseVersion(currentVersionName);
		const newVersionName = incrementVersionName(parsedVersion, incrementType);
		const newVersionCode = incrementVersionCode(currentVersionCode);

		core.info(`Mode check - current mode: ${mode}`);
		if (mode === "update-file") {
			core.info("Executing update-file mode");
			await updateGradleFile(filePath, newVersionName, newVersionCode);
		} else if (mode === "comment-only") {
			core.info("Executing comment-only mode");
			await addPRComment(newVersionName);
		} else {
			throw new Error(
				`Invalid mode: ${mode}. Must be either 'update-file' or 'comment-only'`,
			);
		}

		core.setOutput("previous-version", currentVersionName);
		core.setOutput("new-version", newVersionName);

		core.info("=== Action End ===");
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(`Action failed: ${error.message}`);
			core.error(error.stack || "No stack trace");
		} else {
			core.setFailed("An unknown error occurred");
		}
	}
}

run();
