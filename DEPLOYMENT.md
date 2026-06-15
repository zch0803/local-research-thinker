# Local MiroThinker 部署指南

这份文档说明如何把当前软件复制到另一台电脑上运行。项目是纯 Node.js 本地网页服务，不需要数据库，也不依赖 npm 第三方包。

## 1. 准备环境

目标电脑需要：

- Node.js 18 或更高版本，建议 Node.js 20 LTS。
- 能访问你选择的大模型 API，例如 DeepSeek、Gemini、OpenAI-compatible 服务。
- 如果使用 DuckDuckGo HTML 搜索，需要能访问 DuckDuckGo。
- 如果使用 Serper、Tavily，需要对应 API Key。

检查 Node.js：

```bash
node -v
npm -v
```

如果没有安装 Node.js，到 https://nodejs.org/ 下载 LTS 版本。

## 2. 拷贝项目

把整个 `mirothinker` 文件夹复制到另一台电脑，例如：

```text
mirothinker/
  package.json
  server.js
  README.md
  DEPLOYMENT.md
  public/
    index.html
    app.js
    styles.css
```

因为项目没有第三方 npm 依赖，通常不需要运行 `npm install`。

## 3. 启动服务

进入项目目录：

```bash
cd mirothinker
npm start
```

看到类似输出即可：

```text
Local MiroThinker is running at http://localhost:5173
```

浏览器打开：

```text
http://localhost:5173
```

## 3A. 使用图形启动器

如果你拿到的是已经打包好的分发目录或压缩包，优先使用图形启动器：

- 启动器路径：`LocalMiroThinkerLauncher.exe`
- 压缩包路径：`LocalMiroThinker-win-x64.zip`

双击 `LocalMiroThinkerLauncher.exe` 后会出现一个小窗口，里面有：

- `Start Service`
- `Open App`
- `Stop Service`

这版启动器会优先使用分发包内附带的 `runtime/node.exe`，所以目标电脑通常不需要另装 Node.js。

## 4. 配置模型

打开页面右上角设置按钮，可以配置：

- 预设模型：DeepSeek v4 Flash、DeepSeek v4 Pro、Gemini Pro/Flash、OpenAI compatible、Custom。
- Base URL：OpenAI-compatible API 地址。
- Model：模型名。
- API Key：模型服务密钥。

常用示例：

### DeepSeek

```text
Base URL: https://api.deepseek.com/v1
Model: deepseek-v4-flash
```

或：

```text
Model: deepseek-v4-pro
```

### Gemini OpenAI-compatible

```text
Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
Model: gemini-3.1-pro
```

或：

```text
Model: gemini-3.5-flash
```

如果你的账号或地区只开放了 Gemini 2.5，可以选择：

```text
Model: gemini-2.5-pro
Model: gemini-2.5-flash
```

配置后点击“测试 API”，显示连接成功后即可使用。

## 5. 用环境变量预配置

也可以用环境变量启动，适合服务器或固定部署。

### Windows PowerShell

```powershell
$env:LLM_BASE_URL="https://api.deepseek.com/v1"
$env:LLM_MODEL="deepseek-v4-flash"
$env:DEEPSEEK_API_KEY="sk-..."
npm start
```

### macOS / Linux

```bash
export LLM_BASE_URL="https://api.deepseek.com/v1"
export LLM_MODEL="deepseek-v4-flash"
export DEEPSEEK_API_KEY="sk-..."
npm start
```

也可以使用通用变量：

```bash
export LLM_API_KEY="..."
```

## 6. 搜索源配置

默认搜索源是 DuckDuckGo HTML：

- 不需要 API Key。
- 不需要付费。
- 稳定性和频率没有官方保障。

更稳定的商业搜索源：

### Serper

```bash
export SEARCH_PROVIDER="serper"
export SERPER_API_KEY="..."
```

### Tavily

```bash
export SEARCH_PROVIDER="tavily"
export TAVILY_API_KEY="..."
```

医学、论文、PubMed、DOI 等问题会额外调用 NCBI PubMed E-utilities，不需要 PubMed API Key。

## 7. 局域网访问

默认服务监听本机端口 `5173`。如果同一局域网的其他设备要访问：

1. 确认目标电脑防火墙允许 Node.js 或端口 `5173`。
2. 查看目标电脑内网 IP。
3. 其他设备访问：

```text
http://目标电脑IP:5173
```

注意：当前页面会把 API Key 保存在浏览器 localStorage。多人共用时建议每个人在自己的浏览器里配置，或改为只使用服务端环境变量。

## 8. 更换端口

默认端口是 `5173`。可以用 `PORT` 改：

### Windows PowerShell

```powershell
$env:PORT="8080"
npm start
```

### macOS / Linux

```bash
PORT=8080 npm start
```

## 9. 后台常驻运行

简单方式是保持终端窗口打开。

如果是 Linux 服务器，可以用 `systemd` 或 `pm2`。本项目没有强制依赖这些工具。

PM2 示例：

```bash
npm install -g pm2
pm2 start server.js --name local-mirothinker
pm2 save
```

Windows 可以使用任务计划程序、NSSM，或保持 PowerShell 窗口运行。

## 9A. 重新生成分发包

如果你在源代码上做了修改，想重新生成可分发包：

```powershell
cd C:\Users\zhao9\Desktop\mirothinker
powershell -ExecutionPolicy Bypass -File scripts\build-distribution.ps1
```

生成结果：

- 分发目录：`dist\LocalMiroThinker`
- 压缩包：`dist\LocalMiroThinker-win-x64.zip`

## 10. 迁移历史会话

历史会话保存在浏览器 localStorage，不在项目文件夹里。

图形启动器里设置的端口保存在启动器目录下的 `launcher.config` 文件中。

如果只复制项目文件，另一台电脑不会带上旧浏览器里的历史会话。当前版本还没有导出/导入会话按钮。如果需要迁移历史，可以后续增加导出 JSON 和导入 JSON 功能。

## 11. 常见问题

### 页面能打开，但回答提示未配置模型

检查右上角设置里的 API Key，或者启动时是否设置了 `LLM_API_KEY` / `DEEPSEEK_API_KEY`。

### 测试 API 失败

检查：

- Base URL 是否是 OpenAI-compatible 地址。
- Model 名称是否当前账号可用。
- API Key 是否正确。
- 目标电脑网络是否能访问模型服务。

### 搜索结果不稳定

DuckDuckGo HTML 不保证稳定。如果长期使用，建议切换到 Serper 或 Tavily。

### PubMed 能不能查

可以。学术、医学、论文、DOI、PubMed 相关问题会同时使用 PubMed E-utilities 和网页搜索。

### API Key 安全

如果在页面设置 API Key，它会保存在当前浏览器 localStorage。单机使用通常足够；如果部署给多人使用，建议改成环境变量方式，并隐藏前端 API Key 输入。
