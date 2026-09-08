import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { resolve } from 'node:path';
export default defineConfig({
 define:{'process.env.NODE_ENV':JSON.stringify('production')},
 plugins:[react()],resolve:{alias:{'@':resolve(import.meta.dirname,'.')}},css:{postcss:{plugins:[tailwindcss()]}},
 build:{outDir:'offline-build',emptyOutDir:true,copyPublicDir:false,lib:{entry:'standalone.tsx',name:'DuneSimulation',formats:['iife'],fileName:()=> 'dunes.js'},cssCodeSplit:false},
});
