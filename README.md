# SDRF Editor

[![License](https://img.shields.io/github/license/2024-denglei/sdrfedit)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/2024-denglei/sdrfedit?style=social)](https://github.com/2024-denglei/sdrfedit/stargazers)

浏览器端 SDRF（Sample and Data Relationship Format）编辑器：创建、编辑、校验、导出蛋白质组学样本与数据关系表。本仓库在 [bigbio/sdrfedit](https://github.com/bigbio/sdrfedit) 基础上增强了 **6 步创建向导** 与可选的 **向导 AI 助手**。

中文使用说明见 [USER.md](USER.md)。

## 功能概览

- **主编辑器**：大表虚拟滚动、本体感知单元格（EBI OLS）、TSV / Excel 导出
- **创建向导（6 步）**：从模板到可提交的 SDRF 草稿
- **校验**：默认走 PRIDE SDRF Validator API；也可选浏览器内 Pyodide 本地校验
- **编辑器 AI 推荐**（可选，纯前端）：用你自己的 LLM Key 做元数据清理建议
- **向导 AI 助手**（可选，需后端）：按步骤给出可一键 Apply 的填写卡片

## 快速开始

### 前端

```bash
npm install
ng serve
```

打开 http://localhost:4200 。

生产构建：

```bash
npm run build
```

构建产物在 `dist/`（本项目也会提交 `dist/`，便于 CDN / 嵌入）。

### 向导 AI 后端（可选）

助手面板需要 FastAPI 服务（LLM、MinerU、规范 RAG、PRIDE / OLS 等）：

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # 填写 LLM_API_KEY 等
python -m app.rag.build_index # 构建规范向量索引
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

健康检查：

```bash
curl http://127.0.0.1:8000/api/health
```

前端通过 `src/environments/environment.ts` 的 `assistantBaseUrl` 连接后端；嵌入部署可用 `window.__SDRF_ASSISTANT_URL__` 或 `localStorage.sdrf_assistant_url` 覆盖。详细配置见 [backend/README.md](backend/README.md)。

## 创建向导（6 步）

| 步骤 | 内容 |
|------|------|
| 1 Experiment Setup | 技术 / 样本 / 实验模板 + **生物样本数** |
| 2 Sample Characteristics | 特征候选值 + **研究因子名与全部候选组** |
| 3 Sample Values | source name、生物重复、多值特征、**按样本选因子** |
| 4 Runs & Files | plex、MS run 打包、raw 入池、**按文件名映射 run + F/Tech** |
| 5 Instrument & Protocol | 仪器、酶切、修饰（UNIMOD / MS） |
| 6 Review & Create | 预览并生成表格进入主编辑器 |

要点：

- **sampleCount** = 各实验条件下生物重复之和（distinct biological `source name`），不是条件数，也不是 raw 文件数
- **Study factor** 在 Step 2 定义候选值，在 Step 3 为每个样本赋值
- AI 建议一律以 **卡片** 形式出现，需用户点击 Apply 才会写入向导

## AI 能力

### 1. 编辑器内推荐（无需后端）

在已打开的表格上，用浏览器内配置的 OpenAI / Anthropic / Gemini / Ollama 等给出修改建议。

可选：构建本地示例知识库以增强建议质量：

```bash
git clone https://github.com/bigbio/sdrf-annotated-datasets.git
node scripts/build-sdrf-index.js ./sdrf-annotated-datasets/datasets
```

### 2. 向导助手（需要后端）

向导旁的聊天面板支持：

1. **PXD 登录号**：拉 PRIDE 元数据与 raw 列表；优先将论文 PDF 经 MinerU 解析进会话，再逐步提出可 Apply 的卡片  
2. **规范问答**：基于 [SDRF 规范](https://sdrf.quantms.org/specification.html) 向量检索作答并引用章节  
3. **自有 PDF / 粘贴方法学**：上传或粘贴后按同样流程建议填写  

本体词通过服务端 EBI OLS 校验，避免模型编造 accession。

## 校验

| 模式 | 说明 |
|------|------|
| PRIDE API | 默认，调用线上 SDRF validator |
| Local browser | 通过 Pyodide 在浏览器运行 `sdrf-pipelines`（`src/assets/wheels/`） |

## 嵌入（CDN）

可将构建产物嵌入其他页面（示例指向本仓库 `main`；也可换分支 / tag）：

```html
<!DOCTYPE html>
<html>
  <head>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/2024-denglei/sdrfedit@main/dist/sdrf-editor/browser/styles.css"
    />
  </head>
  <body>
    <app-root></app-root>
    <script
      src="https://cdn.jsdelivr.net/gh/2024-denglei/sdrfedit@main/dist/sdrf-editor/browser/polyfills.js"
      type="module"
    ></script>
    <script
      src="https://cdn.jsdelivr.net/gh/2024-denglei/sdrfedit@main/dist/sdrf-editor/browser/main.js"
      type="module"
    ></script>
  </body>
</html>
```

改完前端后请重新 `npm run build` 并提交更新后的 `dist/`。

## 目录结构

```text
src/
├── app/components/sdrf-editor/     # 主编辑器
├── app/components/sdrf-wizard/     # 创建向导
├── app/components/wizard-ai-panel/ # 向导 AI 面板
├── app/core/services/              # 解析、校验、导出、向导状态
├── app/core/services/assistant/    # 助手 API 与 action bridge
└── workers/                        # Pyodide 等
backend/                            # 向导 AI FastAPI 服务
├── app/llm/                        # agent、prompts、流式客户端
├── app/parsing/                    # MinerU PDF 解析
├── app/rag/                        # 规范分块与检索
├── app/tools/                      # PRIDE、文献、OLS、模板
└── tests/
sdrf-proteomics/                    # 规范 / 模板相关参考资料（本地）
```

## 相关链接

- 上游项目：[bigbio/sdrfedit](https://github.com/bigbio/sdrfedit)
- [SDRF 规范站](https://sdrf.quantms.org)
- [proteomics-metadata-standard](https://github.com/bigbio/proteomics-metadata-standard)
- [sdrf-pipelines](https://github.com/bigbio/sdrf-pipelines)
- [sdrf-annotated-datasets](https://github.com/bigbio/sdrf-annotated-datasets)

## 贡献

```bash
git checkout -b feature/my-change
npm install
npm run build
# 若改了后端：
cd backend && pytest
```

提交变更；若影响前端产物，请一并更新 `dist/`。

## License

Apache License 2.0
