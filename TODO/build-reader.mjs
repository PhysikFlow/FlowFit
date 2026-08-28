import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const outputFile = join(currentDir, "content.generated.js");

const files = (await readdir(currentDir))
  .filter((file) => file.toLowerCase().endsWith(".md"))
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

const documents = await Promise.all(files.map(async (file) => {
  const path = join(currentDir, file);
  const [content, info] = await Promise.all([readFile(path, "utf8"), stat(path)]);
  return {
    file,
    modifiedAt: info.mtime.toISOString(),
    content
  };
}));

const banner = "// Arquivo gerado por `node TODO/build-reader.mjs`. Não editar manualmente.\n";
const payload = `window.FLOWFIT_TODO_CONTENT = ${JSON.stringify({
  generatedAt: new Date().toISOString(),
  documents
}, null, 2)};\n`;

await writeFile(outputFile, banner + payload, "utf8");
console.log(`Leitor TODO: ${documents.length} documentos incorporados em ${outputFile}`);
