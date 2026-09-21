/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import react from '@vitejs/plugin-react';
import { defineConfig, transformWithEsbuild } from 'vite';
import pkg from '@douyinfe/vite-plugin-semi';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { build as esbuild } from 'esbuild';
import { codeInspectorPlugin } from 'code-inspector-plugin';
const { vitePluginSemi } = pkg;

/*
 * 每个模型的调用文档，生成成公开的 Markdown：/docs/models/<模型>.md。
 *
 * 门户里「复制给 AI」放的就是这个链接——外部 agent 不带登录就能读（网关对
 * web/dist 是免认证的静态服务），而且读到的和抽屉里看到的是同一个函数拼出来的
 * （src/components/portal/docMarkdown.js）。接口地址按构建环境取
 * VITE_LLM_PROXY_BASE，和抽屉一致。
 *
 * 开发时由中间件现场生成，生产构建时直接产出到 dist——两边都不往 public/ 里写：
 * 写进 public/ 的话，一次生产构建就会把开发服务器提供的文档换成生产地址。
 *
 * docMarkdown.js 是 ESM + 无 DOM 的纯函数，这里用 esbuild 打成一个 .mjs 再 import，
 * 每次重新打包，改了文档源头不用重启。
 */
async function loadDocModule(root) {
  const entry = path.resolve(root, 'src/components/portal/docMarkdown.js');
  const tmp = path.resolve(root, 'node_modules/.cache/portal-docs/docMarkdown.mjs');
  await esbuild({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'silent' });
  return import(pathToFileURL(tmp).href + '?t=' + Date.now());
}

/*
 * 文档和前端代码里的接口地址，按构建模式直接从 .env.<mode> 文件读，不走 Vite 的
 * 环境变量合并。原因：Vite 规定「进程里已有的 VITE_* 环境变量优先于 .env 文件」，
 * 而镜像里的 Bun（1.3）执行 bun run build 时会先把 .env.development 自动灌进进程
 * 环境——结果生产镜像的文档和页面全写成了开发地址，构建照样成功、页面照样能开
 * （2026-09-21 上线前按生产 Dockerfile 构建时发现，本机 Bun 1.4 不复现）。
 * 所以这里只认文件，并且生产构建拿到开发地址或空值就直接让构建失败。
 */
function readProxyBase(mode) {
  const file = path.resolve(__dirname, `.env.${mode}`);
  let base = '';
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*VITE_LLM_PROXY_BASE\s*=\s*(.*?)\s*$/);
      if (m) base = m[1].replace(/^['"]|['"]$/g, '');
    }
  }
  return base.replace(/\/+$/, '');
}

function assertProdBase(base) {
  if (!/^https:\/\//.test(base) || /ihainan\.me|localhost|127\.0\.0\.1/.test(base)) {
    throw new Error(
      `[portal-model-docs] 生产构建的 VITE_LLM_PROXY_BASE 不对：「${base}」。` +
        '应当是 web/.env.production 里的生产 LLM Proxy 地址（https，非开发域名）。',
    );
  }
}

async function buildModelDocs(base, root) {
  const mod = await loadDocModule(root);
  const files = {};
  const index = ['# ZGCAI Model Hub 调用文档', '', `接口地址：\`${base}\``, ''];
  for (const id of mod.docModelIds()) {
    files[mod.docSlug(id) + '.md'] = mod.docMarkdown(id, base);
    index.push(`- [${id}](./${mod.docSlug(id)}.md)`);
  }
  files['index.md'] = index.join('\n') + '\n';
  return files;
}

function portalModelDocs() {
  let cfg;
  let base = '';
  return {
    name: 'portal-model-docs',
    // 地址由这里统一注入：页面代码（import.meta.env.VITE_LLM_PROXY_BASE）和
    // 公开文档用的是同一个值，也都不受进程环境变量影响（见 readProxyBase）
    config(_, { mode, command }) {
      base = readProxyBase(mode);
      if (command === 'build' && mode === 'production') assertProdBase(base);
      return {
        define: { 'import.meta.env.VITE_LLM_PROXY_BASE': JSON.stringify(base) },
      };
    },
    configResolved(c) {
      cfg = c;
    },
    // 开发：请求到了才生成，永远是源码的当前状态
    configureServer(server) {
      server.middlewares.use('/docs/models/', async (req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0].replace(/^\//, '')) || 'index.md';
        const files = await buildModelDocs(base, cfg.root);
        if (!files[name]) return next();
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.end(files[name]);
      });
    },
    // 生产构建：直接产出到 dist/docs/models/
    async generateBundle() {
      const files = await buildModelDocs(base, cfg.root);
      for (const [name, source] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName: 'docs/models/' + name, source });
      }
      cfg.logger.info(`[portal-model-docs] ${Object.keys(files).length - 1} 篇调用文档 -> dist/docs/models/`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    portalModelDocs(),
    codeInspectorPlugin({
      bundler: 'vite',
    }),
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!/src\/.*\.js$/.test(id)) {
          return null;
        }

        // Use the exposed transform from vite, instead of directly
        // transforming with esbuild
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic',
        });
      },
    },
    react(),
    vitePluginSemi({
      cssLayer: true,
    }),
  ],
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.json': 'json',
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          'semi-ui': ['@douyinfe/semi-icons', '@douyinfe/semi-ui'],
          tools: ['axios', 'history', 'marked'],
          'react-components': [
            'react-dropzone',
            'react-fireworks',
            'react-telegram-login',
            'react-toastify',
            'react-turnstile',
          ],
          i18n: [
            'i18next',
            'react-i18next',
            'i18next-browser-languagedetector',
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 取视频内容的接口（/v1/videos/:id/content）认登录态，前端要能转发到后端
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/mj': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/pg': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
