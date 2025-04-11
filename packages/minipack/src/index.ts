import fs from "node:fs";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { transformFromAstSync } from "@babel/core";
import path from "node:path";
import { loadConfig } from "./config";

let ID = 0;

type Asset = {
  id: number;
  filename: string;
  dependencies: string[];
  code: string | null | undefined;
  mapping: Record<string, number>;
};

function createAsset(filename: string): Asset {
  const content = fs.readFileSync(filename, "utf-8");

  const ast = parser.parse(content, { sourceType: "module" });
  const dependencies: string[] = [];
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });

  const id = ID++;

  const { code } =
    transformFromAstSync(ast, undefined, {
      presets: [require.resolve("@babel/preset-env")],
    }) ?? {};

  return {
    id,
    filename,
    dependencies,
    code,
    mapping: {} as Record<string, number>,
  };
}

function createGraph(entry: string) {
  const mainAsset = createAsset(entry);

  const queue = [mainAsset];

  for (const asset of queue) {
    const dirname = path.dirname(asset.filename);

    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.resolve(dirname, relativePath);

      const child = createAsset(absolutePath);
      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }

  return queue;
}

function bundle(graph: Asset[]) {
  let modules = "";

  graph.forEach((mod) => {
    modules += `${mod.id}: [
    function (require, module, exports) { ${mod.code} },
    ${JSON.stringify(mod.mapping)},
    ],`;
  });

  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id];

        function localRequire(name) {
          return require(mapping[name]);
        }

        const module = { exports: {} };
        fn(localRequire, module, module.exports);
        return module.exports;
      }

      require(0);
    })({${modules}})
  `;

  return result;
}

const config = loadConfig();

const graph = createGraph(path.resolve(process.cwd(), config.entry));
const result = bundle(graph);

const outputFile = path.resolve(process.cwd(), config.output);
const outputDir = path.dirname(outputFile);
fs.mkdirSync(outputDir, { recursive: true }); // Ensure the directory exists

fs.writeFileSync(outputFile, result);
