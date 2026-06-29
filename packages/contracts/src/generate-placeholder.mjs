import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve(process.cwd(), "src/generated-info.json");

writeFileSync(
  outputPath,
  JSON.stringify(
    {
      note: "Replace this placeholder with OpenAPI-based generation once backend dependencies are installed.",
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(`Wrote ${outputPath}`);

