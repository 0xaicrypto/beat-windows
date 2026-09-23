import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = process.env.GITHUB_REPOSITORY || "0xaicrypto/beat-windows";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
if (!token){
  console.log("No GitHub token — keeping existing data/discussions.json");
  process.exit(0);
}

const [owner, name] = REPO.split("/");
const query = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    url
    hasDiscussionsEnabled
    discussionCategories(first: 20) { nodes { name slug } }
    discussions(first: 20, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes {
        number title url createdAt updatedAt
        comments { totalCount }
        category { name slug }
        author { login }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "BeatWindowsFeedBot/1.0 (+https://beatwindows.org)"
  },
  body: JSON.stringify({ query, variables: { owner, name } })
});
if (!res.ok){
  console.warn(`GraphQL HTTP ${res.status} — keeping existing data/discussions.json`);
  process.exit(0);
}
const json = await res.json();
if (json.errors || !json.data || !json.data.repository){
  console.warn("GraphQL errors: " + JSON.stringify(json.errors || json));
  process.exit(0);
}
const repo = json.data.repository;
if (!repo.hasDiscussionsEnabled){
  console.log("Discussions are disabled — keeping existing data/discussions.json");
  process.exit(0);
}

const items = repo.discussions.nodes.map(d => ({
  number: d.number,
  title: d.title,
  url: d.url,
  date: d.updatedAt,
  created: d.createdAt,
  comments: d.comments.totalCount,
  category: d.category ? d.category.name : "",
  categorySlug: d.category ? d.category.slug : "",
  author: d.author ? d.author.login : ""
}));
const categories = repo.discussionCategories.nodes
  .filter(c => c.slug !== "announcements")
  .map(c => ({ name: c.name, slug: c.slug }));
const out = {
  generated: new Date().toISOString(),
  repo: repo.url,
  newUrl: repo.url + "/discussions/new",
  categories,
  items
};
await writeFile(join(root, "data/discussions.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`discussions: ${items.length} threads, ${categories.length} categories`);
