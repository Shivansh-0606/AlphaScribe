import { visit, SKIP } from "unist-util-visit";

const CITATION_RE = /\[(\d+)\]/g;

// Rewrites literal "[1]", "[2]" citation markers (as emitted by the synthesizer
// prompt) into real mdast link nodes pointing at "#source-N", so react-markdown's
// existing `a` component override can turn them into click targets — no manual
// markdown string rewriting.
export default function remarkCitations() {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || index == null || !CITATION_RE.test(node.value)) return;
      CITATION_RE.lastIndex = 0;
      const parts = [];
      let last = 0;
      let match;
      while ((match = CITATION_RE.exec(node.value))) {
        if (match.index > last) {
          parts.push({ type: "text", value: node.value.slice(last, match.index) });
        }
        parts.push({
          type: "link",
          url: `#source-${match[1]}`,
          children: [{ type: "text", value: match[0] }],
        });
        last = match.index + match[0].length;
      }
      if (last < node.value.length) parts.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
      // SKIP: without it, visit() descends into the inserted link nodes and
      // re-matches their own "[n]" text child, double-wrapping every citation.
      return [SKIP, index + parts.length];
    });
  };
}
