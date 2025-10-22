import * as fs from "fs/promises";
import * as path from "path";

const sourcesDir = path.resolve(process.cwd(), "sources");

async function normalizeTextFile(filePath: string) {
  console.log(`Normalizing ${path.basename(filePath)}...`);
  const originalContent = await fs.readFile(filePath, "utf-8");

  // 1. Remove specific warning lines
  let processedContent = originalContent.replace(/\x5BWARNING: This file was truncated. To view the full content, use the 'read_file' tool on this specific file.\x5D/g, '');

  // 2. Split the text into blocks based on one or more empty lines.
  const blocks = processedContent.split(/\n\s*\n/);

  // 3. Process each block to consolidate paragraphs and clean up whitespace.
  const cleanedBlocks = blocks.map(block => {
    // Replace any remaining single newlines with a space, then collapse multiple spaces.
    return block.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  });

  // 4. Filter out any blocks that became empty after trimming.
  const nonEmptyBlocks = cleanedBlocks.filter(block => block.length > 0);

  // 5. Join the blocks back together with a consistent double newline.
  const finalContent = nonEmptyBlocks.join('\n\n');

  // 6. Overwrite the original file with the cleaned content.
  await fs.writeFile(filePath, finalContent, "utf-8");
}

async function main() {
  console.log("Starting normalization of all source files...");
  const files = await fs.readdir(sourcesDir);

  for (const file of files) {
    if (path.extname(file) === ".txt") {
      const filePath = path.join(sourcesDir, file);
      await normalizeTextFile(filePath);
    }
  }

  console.log("Normalization complete.");
}

main().catch(e => {
  console.error("An error occurred during normalization:", e);
  process.exit(1);
});
