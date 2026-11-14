// Read the existing frontend without changing it. Run from backend/.
// Usage: node scripts/export-frontend.cjs .. examples/current-content.json
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(process.argv[2] || '..');
const output = process.argv[3];
if (!output) throw new Error('Provide an output JSON file');
const frontendRequire = createRequire(path.join(root, 'package.json'));
const esbuild = frontendRequire('esbuild');
const result = esbuild.buildSync({
  stdin: { contents: `
    import { projects } from './src/data/projects.ts';
    import { caseStudies } from './src/data/case-studies/index.ts';
    export default projects.map(({ todo, ...project }) => ({
      project,
      caseStudy: caseStudies.find(study => study.slug === project.slug)
        ?? { slug: project.slug, status: 'draft', intro: {} }
    }));`, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs',
});
const moduleObject = { exports: {} };
new Function('module', 'exports', result.outputFiles[0].text)(moduleObject, moduleObject.exports);
fs.writeFileSync(output, JSON.stringify(moduleObject.exports.default, null, 2) + '\n');
console.log(`Exported ${moduleObject.exports.default.length} projects. Nothing published.`);
