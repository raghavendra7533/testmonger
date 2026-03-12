const GITHUB_API = 'https://api.github.com';

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: { ...headers(token), ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function testConnection(token: string): Promise<{ login: string; name: string | null }> {
  const data = await ghFetch<{ login: string; name: string | null }>(token, '/user');
  return { login: data.login, name: data.name };
}

export async function fetchPRInfo(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ pr: any; files: any[] }> {
  const [pr, files] = await Promise.all([
    ghFetch<any>(token, `/repos/${owner}/${repo}/pulls/${prNumber}`),
    ghFetch<any[]>(token, `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`),
  ]);
  return { pr, files };
}

export async function commitTestAndOpenPR(
  token: string,
  targetOwner: string,
  targetRepo: string,
  branchName: string,
  filePath: string,
  fileContent: string,
  prTitle: string,
  prBody: string,
  commitMessage: string,
): Promise<string> {
  // Get default branch SHA
  const ref = await ghFetch<{ object: { sha: string } }>(
    token,
    `/repos/${targetOwner}/${targetRepo}/git/ref/heads/main`,
  );

  // Create branch
  await ghFetch(token, `/repos/${targetOwner}/${targetRepo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    }),
  });

  // Create file
  const content = btoa(unescape(encodeURIComponent(fileContent)));
  await ghFetch(token, `/repos/${targetOwner}/${targetRepo}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: commitMessage,
      content,
      branch: branchName,
    }),
  });

  // Open PR
  const newPR = await ghFetch<{ html_url: string }>(
    token,
    `/repos/${targetOwner}/${targetRepo}/pulls`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: prTitle,
        body: prBody,
        head: branchName,
        base: 'main',
      }),
    },
  );

  return newPR.html_url;
}
