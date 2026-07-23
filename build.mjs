import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const server = path.join(dist, "server");
const hosting = path.join(dist, ".openai");

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });
await mkdir(hosting, { recursive: true });
await cp(path.join(root, "public"), client, { recursive: true });
await cp(
  path.join(root, ".openai", "hosting.json"),
  path.join(hosting, "hosting.json"),
);

const worker = await readFile(path.join(root, "worker", "index.js"), "utf8");
const personas = await readFile(path.join(root, "lib", "personas.js"), "utf8");
await writeFile(path.join(server, "index.js"), worker);
await writeFile(path.join(server, "personas.js"), personas);

console.log("思想档案馆网站构建完成");
