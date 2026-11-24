// Rewrites each star badge in README.md with the repository's current count.
//
// A badge needs no marker. The script finds it by its shape:
//   [![Stars](https://img.shields.io/badge/<count>-...)](https://github.com/<owner>/<repo>/stargazers)
// and reads <owner>/<repo> from the link. To add a project, copy a row of the
// table and change its link.
//
// The badges are static images on purpose. A live shields.io star badge shows
// "invalid" when shields.io runs out of GitHub requests.
//
// Run it by hand with: node .github/scripts/update-stars.mjs
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../../README.md", import.meta.url);
const badge = /(\[!\[Stars\]\(https:\/\/img\.shields\.io\/badge\/)([^-)]*)(-[^)]*\)\]\(https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/stargazers\))/g;

// 97 stays 97, and 1379 becomes 1.4k, as GitHub writes it.
const short = count => (count < 1000 ? String(count) : `${(Math.round(count / 100) / 10).toFixed(1).replace(/\.0$/, "")}k`);

async function stars(repository) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "profile-readme-stars" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${repository}`, { headers, signal: AbortSignal.timeout(20000) });
  if (response.status !== 200) throw new Error(`${repository} answered HTTP ${response.status}`);
  const count = (await response.json()).stargazers_count;
  if (!Number.isInteger(count)) throw new Error(`${repository} gave no star count`);
  return count;
}

const before = readFileSync(file, "utf8");
const repositories = [...new Set([...before.matchAll(badge)].map(match => match[4]))];
if (!repositories.length) throw new Error("README.md holds no star badge");

// One failed repository stops the run, so the README never holds a mix of new
// and stale counts, and a link to a repository that moved shows up as a failure.
const counts = new Map();
for (const repository of repositories) counts.set(repository, await stars(repository));

const after = before.replace(badge, (whole, start, old, end, repository) => `${start}${short(counts.get(repository))}${end}`);
if (after !== before) writeFileSync(file, after);
for (const [repository, count] of counts) console.log(`${repository}: ${count} (${short(count)})`);
console.log(after === before ? "README.md is current." : "README.md updated.");
