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

## 当前范围

本扩展当前刻意采用“页面内注入的常驻底部栏”方案，不包含 popup、options 页面或浏览器外框工具栏。目标是让页面诊断信息在浏览过程中持续可见。

## 在 Chrome 中加载

1. 打开 `chrome://extensions/`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择当前项目目录。

本地开发时直接加载仓库根目录即可，这样 Chrome 会直接使用当前目录中的 `manifest.json`、脚本、样式和图标资源。

## 本地调试

### 调试 background service worker

1. 打开 `chrome://extensions/`。
2. 找到 **Page Info Bottom Bar**。
3. 点击扩展卡片中的 **service worker** 链接。
4. 在该 DevTools 中查看 `background.js` 的日志、网络请求和异常。

`background.js` 主要负责：

- 监听 `chrome.webRequest.onResponseStarted`
- 在内存中缓存每个 tab 的页面信息
- 做 DNS A 记录 fallback 解析
- 调用 IP 转城市接口
- 把最新信息回推给 content script

### 调试 content script

在目标网页上打开 DevTools，查看页面控制台以及 DOM 变化，确认 `content.js` 的行为是否正常。

`content.js` 主要负责：

- 把底部栏注入到页面中
- 追踪 SPA URL 变化
- 调整页面底部 padding 以避免遮挡
- 从 `sessionStorage` 恢复上一次页面状态
- 点击字段时复制内容

### 建议验证场景

- 打开普通多页面网站，确认完整导航后 server/runtime/CDN 字段会更新。
- 打开 SPA 网站，通过 `pushState` / `replaceState` 路由切换，确认 URL 会变化且不会重复插入底部栏。
- 缩小视口宽度，确认响应式布局下仍能显示 URL。
- 测试底部已有 fixed/sticky 元素的页面，确认避让逻辑仍能保证页面内容可见。

## 运行测试

```bash
npm test
```

测试使用 Node.js 内置测试运行器，主要覆盖 `page-info-core.js` 中的纯函数检测和提取逻辑。

## 文件结构

- `manifest.json` — 扩展清单、权限、content script、background service worker 配置。
- `content.js` — 页面底部栏注入、SPA URL 监听、布局避让、点击复制。
- `background.js` — Chrome 事件监听、响应头处理、DNS/IP/地理位置查询。
- `page-info-core.js` — 可复用的纯函数逻辑，供 background 和测试共用。
- `style.css` — 底部栏样式和响应式布局。
- `tests/page-info-core.test.js` — 检测逻辑和提取逻辑的 Node 测试。
- `icons/` — 扩展图标资源。
- `PRIVACY.md` — 隐私和数据处理说明。
- `CHANGELOG.md` — 版本变更记录。

## 权限说明

`manifest.json` 当前声明了：

- `webRequest`：读取页面请求的响应信息和响应头。
- `<all_urls>`：让扩展能在所有 HTTP/HTTPS 页面上运行，并监听这些页面的请求。
- `https://cloudflare-dns.com/*`：通过 DNS-over-HTTPS 查询域名 A 记录。
- `https://dns.google/*`：备用 DNS-over-HTTPS 查询服务。
- `https://ip.22kf.com/*`：根据 IP 查询位置文本，用于显示城市。

## 数据来源

扩展运行时依赖以下输入：

- 当前页面 URL
- 主文档请求的响应头
- Chrome 在可用时提供的远端 IP
- 当 Chrome 未提供可用公网 IPv4 时的 DNS-over-HTTPS 解析结果
- `https://ip.22kf.com/` 返回的城市信息

隐私相关说明以 `PRIVACY.md` 为准，应与上述行为保持一致。

## 消息流

- `background.js` 负责收集网络侧页面信息，并按 tab 缓存。
- `content.js` 在页面启动后通过 `getPageInfo` 拉取当前状态。
- 当 SPA 路由变化时，`content.js` 发送 `pageLocationChanged`，让 background 更新当前 tab 状态。
- `background.js` 再通过 `pageInfoUpdated` 把最新信息推回页面。

## SPA 行为

扩展会监听：

- `pushState`
- `replaceState`
- hash 变化
- 轻量 URL 轮询

当 SPA 路由变化时，content script 会通知 background 更新当前 tab 记录的 URL / hostname，并刷新底部栏显示。

需要注意的是，客户端路由变化不会产生新的主文档响应，所以 server/runtime/CDN 等基于响应头的信息，仍然来自最近一次真实页面加载，直到浏览器发生新的完整导航。

## 打包规范

用于 Chrome Web Store 上传时，建议生成一个只包含扩展运行时文件的干净 zip：

- `manifest.json`
- `background.js`
- `content.js`
- `page-info-core.js`
- `style.css`
- `icons/`

不要把以下仓库开发文件打进商店上传包：

- `.git/`
- `.idea/`
- `tests/`
- `README.md`
- `README.zh-CN.md`
- `CHANGELOG.md`
- `package.json`

一个实用的打包流程是：

1. 新建一个临时干净目录。
2. 只复制扩展运行时需要的文件。
3. 对该目录内容打 zip。
4. 将 zip 上传到 Chrome Web Store。

## 发布前检查清单

发布新版本前建议至少完成：

1. 更新 `manifest.json` 中的版本号。
2. 如果本地工具也依赖 `package.json` 版本，则同步更新它。
3. 更新 `CHANGELOG.md`。
4. 运行 `npm test`。
5. 在 Chrome 中重新加载已解压扩展并手工验证主流程。
6. 准备截图和商店文案。
7. 确认 `PRIVACY.md` 仍与扩展真实行为一致。
8. 生成干净的上传 zip。

## 商店素材

当前仓库已经具备：

- `icons/icon16.png`
- `icons/icon32.png`
- `icons/icon48.png`
- `icons/icon128.png`

在正式上架前仍建议补齐：

- 桌面端标准页面截图，展示底部栏整体效果
- 窄屏布局截图，展示 URL 响应式展示方式
- SPA 路由切换场景截图
- 商店短描述
- 商店长描述
- 基于 `PRIVACY.md` 的隐私政策链接

## 已知限制

- Chrome 扩展不能在浏览器外框底部创建真正的自定义工具栏，所以本扩展使用页面内注入的底部栏。
- 如果浏览器使用本地代理或 PAC，Chrome 可能会把远程地址报告为 `127.0.0.1` 这类本地/内网地址；扩展会把这类地址视为不可用，并改用当前页面 hostname 的 DNS A 记录结果。
- 运行时和 CDN 检测依赖网站暴露出来的响应头、cookie 等信息，无法保证所有网站都能准确识别。
- 城市查询依赖第三方 IP 查询服务可用性。
- 当前仅处理 IPv4，不做完整 IPv6 支持。
- SPA 路由切换时展示的是最近一次真实文档响应对应的 header 信息，直到浏览器再次发生完整导航。
