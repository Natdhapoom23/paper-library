import { build } from 'esbuild';
import { copyFileSync,mkdirSync } from 'node:fs';
mkdirSync('dist',{recursive:true});
await build({entryPoints:['source-app.mjs'],bundle:true,format:'esm',minify:true,outfile:'dist/app.js',external:['./pdf.mjs','./config.js'],target:['es2022']});
for(const name of ['index.html','style.css','config.js','schema.sql','README.md'])copyFileSync(name,'dist/'+name);
for(const [src,dest] of [['node_modules/pdfjs-dist/build/pdf.mjs','pdf.mjs'],['node_modules/pdfjs-dist/build/pdf.worker.mjs','pdf.worker.mjs'],['node_modules/mammoth/mammoth.browser.min.js','mammoth.js'],['node_modules/page-flip/dist/js/page-flip.browser.js','page-flip.js']])copyFileSync(src,'dist/'+dest);
copyFileSync('.nojekyll','dist/.nojekyll');
console.log('Built static GitHub Pages site in dist/');
