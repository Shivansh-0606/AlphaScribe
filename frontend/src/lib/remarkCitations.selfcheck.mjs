// Runnable self-check for remarkCitations.js — run with `node src/lib/remarkCitations.selfcheck.mjs`.
// Not a jest suite (none is wired up in this frontend); this is the smallest thing
// that fails if the citation-splitting logic breaks.
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import remarkCitations from "./remarkCitations.js";

function linksIn(markdown) {
  // Parse only (no plugins attached), then apply the transform directly —
  // mirrors exactly what react-markdown does with a remarkPlugins entry.
  const tree = unified().use(remarkParse).parse(markdown);
  remarkCitations()(tree);
  const found = [];
  // Block body matters: an arrow returning push()'s numeric result would make
  // unist-util-visit treat that number as a "jump to this index" instruction.
  visit(tree, "link", (n) => { found.push(n.url); });
  return found;
}

assert.deepEqual(linksIn("Revenue grew [1] a lot [2]."), ["#source-1", "#source-2"]);
assert.deepEqual(linksIn("No citations here."), []);
assert.deepEqual(linksIn("[1][2]"), ["#source-1", "#source-2"]);
assert.deepEqual(linksIn("See [99] for details"), ["#source-99"]);
// A real markdown link is untouched (remark-parse made it a link node before
// our plugin runs; "link" isn't digits so CITATION_RE never matches it).
assert.deepEqual(linksIn("Already a [link](https://example.com)"), ["https://example.com"]);

console.log("remarkCitations self-check passed");
