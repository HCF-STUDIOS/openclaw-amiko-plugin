import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readSkill(relPath: string): { frontmatter: Record<string, string>; body: string } {
  const path = fileURLToPath(new URL(relPath, import.meta.url));
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(match, `${relPath} must start with a --- frontmatter block`);
  const [, frontmatterBlock, body] = match;
  const frontmatter: Record<string, string> = {};
  for (const line of frontmatterBlock.split("\n")) {
    const sep = line.indexOf(": ");
    if (sep === -1) continue;
    frontmatter[line.slice(0, sep).trim()] = line.slice(sep + 2).trim();
  }
  return { frontmatter, body };
}

test("create skill exists and parses with required frontmatter", () => {
  const { frontmatter, body } = readSkill("../skills/create/SKILL.md");
  assert.equal(frontmatter.name, "create");
  assert.ok(frontmatter.description && frontmatter.description.length > 0);
  assert.ok(frontmatter.metadata && frontmatter.metadata.includes("openclaw"));
  assert.ok(!frontmatter.metadata?.includes('"mcp"'), "create skill is built-in tools, not an MCP server");
  assert.match(body, /NEVER invent/);
});

test("composio skill still parses with required frontmatter (no regression)", () => {
  const { frontmatter } = readSkill("../skills/composio/SKILL.md");
  assert.equal(frontmatter.name, "composio");
  assert.ok(frontmatter.description && frontmatter.description.length > 0);
});
