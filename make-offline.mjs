import fs from 'node:fs';
const js=fs.readFileSync('offline-build/dunes.js','utf8').replace(/<\/script/gi,'<\\/script');
const css=fs.readFileSync('offline-build/sites-project.css','utf8');
const html=`<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="An interactive aerial time-lapse of sand dunes"><title>A Sea of Sand — Dune Observatory</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script><script>document.addEventListener('click',e=>{const a=e.target.closest('.download-link');if(a&&location.protocol==='file:'){e.preventDefault();const u=URL.createObjectURL(new Blob(['<!doctype html>'+document.documentElement.outerHTML],{type:'text/html'}));const link=document.createElement('a');link.href=u;link.download='a-sea-of-sand.html';link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}});</script></body></html>`;
fs.writeFileSync('public/a-sea-of-sand.html',html);
fs.copyFileSync('public/a-sea-of-sand.html','../../outputs/a-sea-of-sand.html');
console.log(`Saved self-contained HTML (${Math.round(html.length/1024)} KB)`);
