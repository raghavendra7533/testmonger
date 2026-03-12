import { Octokit } from "@octokit/rest";
import * as dotenv from "dotenv";

dotenv.config();

const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("GITHUB_TOKEN environment variable is required");
}

export const octokit = new Octokit({
  auth: token,
});

export interface PRInfo {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string | null;
  labels: string[];
  files: PRFile[];
  diff: string;
}

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
  content?: string;
}

/**
 * Fetch PR details including files and diff
 */
export async function getPRInfo(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRInfo> {
  // Get PR metadata
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Get PR files
  const { data: listFilesData } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Get raw file content for each file to provide full context to the LLM
  const files: PRFile[] = await Promise.all(
    listFilesData.map(async (f) => {
      let content = "";
      try {
        if (f.status !== "removed") {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: f.filename,
            ref: pr.head.sha, // Fetch the file exactly as it is in the PR head branch
          });

          if (!Array.isArray(data) && data.type === "file" && data.content) {
            content = Buffer.from(data.content, "base64").toString("utf-8");
          }
        }
      } catch (e) {
        console.warn(`Could not fetch full content for ${f.filename}:`, e);
      }

      return {
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
        content: content, // include the full raw content 
      };
    })
  );

  // Get PR diff
  const { data: diff } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: {
      format: "diff",
    },
  });

  return {
    owner,
    repo,
    number: prNumber,
    title: pr.title,
    body: pr.body,
    labels: pr.labels.map((l) => (typeof l === "string" ? l : l.name || "")),
    files,
    diff: diff as unknown as string,
  };
}

/**
 * Create a new branch in a repo
 */
export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string = "main"
): Promise<void> {
  // Get the SHA of the base branch
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });

  // Create new branch
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  });
}

/**
 * Create or update a file in a repo
 */
export async function createFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
): Promise<void> {
  const contentBase64 = Buffer.from(content).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: contentBase64,
    branch,
  });
}

/**
 * Create a pull request
 */
export async function createPR(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string = "main"
): Promise<{ number: number; url: string }> {
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });

  return {
    number: pr.number,
    url: pr.html_url,
  };
}

/**
 * Parse PR URL to extract owner, repo, and PR number
 */
export function parsePRUrl(url: string): {
  owner: string;
  repo: string;
  prNumber: number;
} {
  const match = url.match(
    /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
  );
  if (!match) {
    throw new Error(`Invalid PR URL: ${url}`);
  }
  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };
}
