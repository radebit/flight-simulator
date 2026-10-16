# OpenResty / Nginx 部署

应用构建后由 HTML、JavaScript、CSS、GLB 和 WAV 等静态文件组成。OpenResty 可以直接提供这些文件，无需启动 `npm run dev`，也无需代理 5173 端口。

## 默认部署到根目录

```bash
npm ci
npm run build
```

项目默认使用根路径 `/`。将 `dist/` **里面的内容**直接上传到站点根目录，目录应类似：

```text
站点根目录/
├── index.html
├── favicon.svg
├── assets/
├── models/a320/
└── audio/a320/
```

访问自己的站点根地址即可。不要多套一层 `dist/`；模型和声音已经包含在构建产物中，也要完整上传。

## 可选：部署到子目录

仅在需要子目录时，通过构建参数指定基础路径。例如部署到 `/flight-simulator/`：

```bash
npm run build -- --base=/flight-simulator/
```

将 `dist/` 内的全部内容上传到站点根目录下对应的 `flight-simulator/` 文件夹，再访问该子目录。可将参数替换为任意子目录，如 `--base=/apps/simulator/`，并使用与之匹配的上传目录和访问路径。路径以 `/` 开头和结尾。

此参数只影响本次构建，不修改项目配置；下次执行 `npm run build` 仍生成根目录版本。脚本、样式和图标由 Vite 根据 `base` 处理，公共模型与音频通过 `import.meta.env.BASE_URL` 解析。更换部署路径后需要重新构建并上传完整产物。

## OpenResty 配置

默认根目录部署参考 [配置片段](openresty.conf)，在现有 HTTPS `server` 块中调整 `location /`，避免重复定义。

示例假设文件在 `/var/www/web/`。将 `root /var/www/web;` 改成实际站点根目录；使用 1Panel / Docker 时，应填写 **OpenResty 容器内**能访问到的路径。保留现有站点的域名和证书配置。

如果使用上述子目录构建，文件位于 `/var/www/web/flight-simulator/`，可在 HTTPS `server` 块中使用以下配置：

```nginx
location = /flight-simulator {
    return 301 /flight-simulator/;
}

location ^~ /flight-simulator/ {
    root /var/www/web;
    index index.html;
    try_files $uri $uri/ =404;
}
```

子目录名称必须与 `--base` 参数一致。这里的 `root` 仍指向站点根目录，Nginx 会拼接请求路径；重定向用于补齐子目录地址末尾的 `/`。

当前导航由页面状态管理，没有需要服务端回退的深层路由。`try_files $uri $uri/ =404` 会让不存在的脚本和模型返回真实的 404，便于发现漏传文件；本应用不需要把缺失的 `.js` / `.glb` 请求改写成 `index.html`。

在实际 OpenResty 运行环境中检查配置后再重载，例如：

```bash
nginx -t
nginx -s reload
```

如果通过面板管理 OpenResty，则使用面板的配置检查和重载功能。

## 常见问题

### 首页有响应，但页面白屏

检查浏览器 Network 中的资源路径，确认与构建参数和部署目录一致：

| 资源 | 默认根目录构建 | 子目录构建示例 |
| --- | --- | --- |
| 脚本 | `/assets/index-<hash>.js` | `/flight-simulator/assets/index-<hash>.js` |
| 机模 | `/models/a320/exterior.glb` | `/flight-simulator/models/a320/exterior.glb` |
| 驾驶舱 | `/models/a320/cockpit.glb` | `/flight-simulator/models/a320/cockpit.glb` |
| 音频 | `/audio/a320/button.wav` | `/flight-simulator/audio/a320/button.wav` |

如果路径不匹配，按目标路径重新构建并上传 `dist/` 的全部内容。确认 `index.html` 与带哈希的 `assets/` 来自同一次构建，并刷新浏览器；若 CDN 缓存了旧 HTML，再清理对应页面缓存。

### 带 `:82` 的地址连接超时

如果域名经过 Cloudflare，注意其默认代理的 HTTPS 端口包含 443 和 8443，**不包含 82**。优先使用站点已有的标准 HTTPS 443，不需要为了这个静态应用增加新的公网端口。

如果标准 HTTPS 地址也无法连接，应检查域名解析、现有 HTTPS 监听、证书和源站连通性。仅增加前端加载超时不能修复连接问题。

### 模型加载慢或失败

外部机模约 10 MB、驾驶舱约 51 MB，初次加载受带宽影响。确认文件完整上传、响应是二进制模型而非 HTML 错误页，并查看请求是否被服务端或 CDN 中断。浏览器还需要启用 WebGL / 硬件加速。

### 没有声音

先点击「进入驾驶舱」或某个控件以允许浏览器播放音频，再检查静音、音量和模拟是否暂停。确认 `audio/a320/` 下的 WAV 请求返回成功；切到后台标签页时应用会主动停止输出声音。

## 快速检查

以下使用示例域名，请替换为自己的站点。子目录部署时，在每个请求路径前加上构建时指定的子目录。

```bash
curl -I https://example.com/
curl -I https://example.com/models/a320/exterior.glb
curl -I https://example.com/audio/a320/button.wav
```

首页、实际脚本文件及模型 / 音频应返回成功状态，脚本应有正确的 JavaScript MIME 类型。最终还需在浏览器进入驾驶舱，确认模型、原位按钮、仪表和音效可以正常运行。

参考：[Vite 部署基础路径](https://vite.dev/guide/build.html#public-base-path)、[Nginx 静态文件服务](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/)、[Cloudflare 代理端口](https://developers.cloudflare.com/fundamentals/reference/network-ports/)。
