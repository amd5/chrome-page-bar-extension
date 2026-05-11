# Page Info Bottom Bar

这是一个 Manifest V3 Chrome 扩展，会在 HTTP/HTTPS 页面底部自动注入一个常驻信息栏。

信息栏显示：

- 当前页面 URL（桌面端鼠标划到左侧 URL 区域时显示；窄屏布局下直接显示截断 URL）
- 页面加载时长
- IP 地址
- 城市
- Server 响应头
- 检测到的运行时 / 框架
- 检测到的 CDN

点击信息栏中的任意字段，可以复制对应字段的值。

## 在 Chrome 中加载

1. 打开 `chrome://extensions/`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择当前项目目录。

## 运行测试

```bash
npm test
```

测试使用 Node.js 内置测试运行器，主要覆盖 `page-info-core.js` 中的检测和提取逻辑。

## 文件结构

- `manifest.json` — 扩展清单、权限、content script、background service worker 配置。
- `content.js` — 页面底部栏注入、SPA URL 监听、布局避让、点击复制。
- `background.js` — Chrome 事件监听、响应头处理、DNS/IP/地理位置查询。
- `page-info-core.js` — 可复用的纯函数逻辑，供 background 和测试共用。
- `style.css` — 底部栏样式和响应式布局。
- `tests/page-info-core.test.js` — 检测逻辑和提取逻辑的 Node 测试。
- `icons/` — 扩展图标资源。

## 权限说明

- `webRequest`：读取页面请求的响应信息和响应头。
- `<all_urls>`：让扩展能在所有 HTTP/HTTPS 页面上运行，并监听这些页面的请求。
- `https://cloudflare-dns.com/*`：通过 DNS-over-HTTPS 查询域名 A 记录，作为 IP 获取 fallback。
- `https://dns.google/*`：备用 DNS-over-HTTPS 查询服务。
- `https://ip.22kf.com/*`：根据 IP 查询位置文本，用于显示城市。

## SPA 行为

扩展会监听：

- `pushState`
- `replaceState`
- hash 变化
- 轻量 URL 轮询

当 SPA 路由变化时，content script 会通知 background 更新当前 tab 记录的 URL / hostname，并刷新工具栏显示。

需要注意的是，客户端路由变化不会产生新的主文档响应，所以 server/runtime/CDN 等基于响应头的信息，仍然来自最近一次真实页面加载，直到浏览器发生新的完整导航。

## 代理 / PAC 场景

如果浏览器使用本地代理或 PAC，Chrome 可能会把远程地址报告为：

```text
127.0.0.1:1080
```

扩展会把本地/内网 IPv4 地址视为不可用，不直接展示这类代理地址，而是改用当前页面 hostname 的 DNS A 记录解析结果。

## 已知限制

- Chrome 扩展不能在浏览器外框底部创建真正的自定义工具栏，所以本扩展使用页面内注入的底部栏。
- 运行时和 CDN 检测依赖网站暴露出来的响应头、cookie 等信息，无法保证所有网站都能准确识别。
- 城市查询依赖第三方 IP 查询服务可用性。
- 不查询 IPv6，不展示多个 IP，不区分真实源站 IP 和 CDN 节点 IP。
- 性能指标目前只显示页面加载时长。
