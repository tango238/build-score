# converge-web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ブラウザ上でQ1〜Q6の対話型ヒアリングを行い、claude -p でブリーフを生成するWebサーバーを作成する

**Architecture:** Node.js標準モジュールのみのHTTPサーバー。フロントエンドは単一HTMLのSPA。各ステップでclaude -pを呼び出し、CLI版と同じ精度のブリーフを生成する。会話コンテキストはLocalStorageで管理し、サーバーはステートレス。

**Tech Stack:** Node.js (http, fs, path, child_process), vanilla HTML/CSS/JS, claude CLI

---

## File Structure

| File | Responsibility |
|------|---------------|
| `bin/converge-web` | CLIエントリポイント。ポート引数を解析し server.js を起動 |
| `src/server.js` | HTTPサーバー。静的ファイル配信 + `/api/step` エンドポイント |
| `src/conversation.js` | claude -p プロンプト構築、実行、JSONレスポンスのパース |
| `templates/web/index.html` | フロントエンドSPA。メタ情報入力→対話→結果の全画面を含む |
| `templates/commands/converge-web.md` | `/converge-web` スラッシュコマンド定義 |

---

### Task 1: CLIエントリポイント + HTTPサーバー骨格

**Files:**
- Create: `bin/converge-web`
- Create: `src/server.js`

- [ ] **Step 1: bin/converge-web を作成**

```javascript
#!/usr/bin/env node

const { startServer } = require('../src/server.js')

const args = process.argv.slice(2)
let port = 3456

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1], 10)
  }
}

startServer(port)
```

- [ ] **Step 2: src/server.js の骨格を作成**

```javascript
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function checkClaude() {
  try {
    execSync('claude --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function startServer(port) {
  if (!checkClaude()) {
    console.error('エラー: claude CLI が見つかりません。インストールしてください。')
    process.exit(1)
  }

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const htmlPath = path.join(__dirname, '..', 'templates', 'web', 'index.html')
      const html = fs.readFileSync(htmlPath, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    if (req.method === 'POST' && req.url === '/api/step') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        try {
          const data = JSON.parse(body)
          const { handleStep } = require('./conversation.js')
          const result = await handleStep(data)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(result))
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: error.message }))
        }
      })
      return
    }

    res.writeHead(404)
    res.end('Not Found')
  })

  server.listen(port, () => {
    console.log('')
    console.log('  converge-web — ブラウザ版ヒアリングUI')
    console.log('')
    console.log(`  http://localhost:${port}`)
    console.log('')
    console.log('  Ctrl+C で終了')
    console.log('')
  })
}

module.exports = { startServer }
```

- [ ] **Step 3: bin/converge-web に実行権限を付与**

Run: `chmod +x bin/converge-web`

- [ ] **Step 4: サーバー起動を確認**

Run: `node bin/converge-web &`
Expected: `converge-web — ブラウザ版ヒアリングUI` と `http://localhost:3456` が表示される
Run: `curl -s http://localhost:3456/` (404でOK、HTMLファイルはまだない)
Run: `kill %1`

- [ ] **Step 5: コミット**

```bash
git add bin/converge-web src/server.js
git commit -m "feat: converge-web CLIエントリポイントとHTTPサーバー骨格"
```

---

### Task 2: conversation.js — claude -p プロンプト構築と実行

**Files:**
- Create: `src/conversation.js`

- [ ] **Step 1: conversation.js を作成**

```javascript
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const TIMEOUT_MS = 5 * 60 * 1000

function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function loadContext(projectRoot) {
  const rulesDir = path.join(projectRoot, 'converge', 'rules')
  const knowledgesDir = path.join(projectRoot, 'converge', 'knowledges')

  const priorityScore = readFileIfExists(path.join(rulesDir, 'priority-score.md'))
  const solutionScale = readFileIfExists(path.join(rulesDir, 'solution-scale.md'))
  const effortEstimate = readFileIfExists(path.join(rulesDir, 'effort-estimate.md'))
  const securityPolicy = readFileIfExists(path.join(knowledgesDir, 'security-policy.md'))
  const existingTools = readFileIfExists(path.join(knowledgesDir, 'existing-tools.md'))
  const constraints = readFileIfExists(path.join(knowledgesDir, 'constraints.md'))

  return { priorityScore, solutionScale, effortEstimate, securityPolicy, existingTools, constraints }
}

function buildConversationHistory(conversation) {
  if (!conversation || conversation.length === 0) return ''

  return conversation
    .map((entry) => `### ${entry.step}\nユーザーの回答: ${entry.userAnswer}\nAIの応答: ${entry.aiResponse}`)
    .join('\n\n')
}

const STEP_INSTRUCTIONS = {
  q1: `現在のステップはQ1「これがないと何が起きる？」です。
ユーザーの回答を評価してください。
- 「なくても困らない」という趣旨ならKILL候補であることを伝えつつ、確認してください
- 具体的な業務影響が出ていれば、回答を要約して次に進む旨を伝えてください
- 回答が曖昧な場合は「先週、この作業がなかったとしたら何が変わりましたか？」とフォローアップしてください
- 回答が十分なら nextStep を "q2" にしてください`,

  q2: `現在のステップはQ2「今、誰が、どうやって回避している？」です。
ユーザーの回答を評価してください。
- 現在の手順が具体的に描写されたら次に進んでください
- 曖昧な場合は「Excel? メール? 手作業?」と具体的なツール名を出してフォローアップしてください
- 「特に何もしていない」場合は「その作業をスキップしたとき、誰が最初に困りますか？」と聞いてください
- 回答が十分なら nextStep を "q3" にしてください`,

  q3: `現在のステップはQ3「誰が困っている？」です。
ユーザーの回答を評価してください。
- 影響を受ける人数と、個人/チーム/部門のどのレベルかを明確にしてください
- ソリューション規模の目安: 1人→スクリプト、2-5人→簡易Webツール、6人以上→Webシステム
- 不明な場合は「あなた以外にこの作業をしている人を1人でも思い浮かべられますか？」と聞いてください
- 回答が十分なら nextStep を "q4" にしてください`,

  q4: `現在のステップはQ4「月に何時間かかっている？」です。
ユーザーの回答を評価してください。
- 月間時間の推定値が出たら次に進んでください
- 曖昧な場合は「先週1週間で、この作業に何回関わりましたか？1回あたり何分くらい？」と分解して推定してください
- 推定不能な場合は unknown として記録し、スコアが1段階下がることを伝えてください
- 回答が十分なら nextStep を "q5" にしてください`,

  q5: `現在のステップはQ5「3ヶ月何もしなかったら？」です。
ユーザーの回答を評価してください。
- 影響の有無と程度を明確にしてください
- 曖昧な場合は選択肢を提示: 「A) 業務に支障が出る B) 不便だが回せる C) 特に変わらない」
- 回答が十分なら nextStep を "q6" にしてください`,

  q6: `現在のステップはQ6「最小構成は何？」です。
ユーザーの回答を評価してください。
- MVP機能が最大3つに絞られたら次に進んでください
- 3つ以上出てきたら「その中で一番効果が大きいのは？」と絞ってください
- 「わからない」場合は「今一番時間がかかっている作業はどれですか？それを自動化するだけでも使いますか？」
- 回答が十分なら nextStep を "review" にしてください`,

  review: `Q1〜Q6のヒアリングが完了しました。レビューフェーズを実行してください。

Step 1: 既存サービス・ツール調査
- 一般化されたカテゴリ用語で検索キーワードを考え、代替可能なサービスがないか分析してください
- knowledges/existing-tools.md の社内ツールも確認してください
- 完全に代替可能ならKILL判定に変更を提案してください

Step 2: 実装規模の最小化チェック
- rules/solution-scale.md の優先順位に従い、最も軽量な手段を推奨してください

Step 3: 批判的レビュー（CEO/経営視点）
- 前提チャレンジ: これは正しい問題か？代理問題ではないか？
- Dream State Mapping: 12ヶ月後の理想状態にこのリクエストは向かうか？
- 反転思考: 何がこのプロジェクトを失敗させるか？

レビュー結果を提示した上で、セカンドオピニオンを取るか選択肢を出してください。
choices を使って確認してください。
nextStep を "review-confirm" にしてください。`,

  'review-confirm': `ユーザーの選択に基づいて処理してください。
- セカンドオピニオンを取る場合: 独立した視点で批判的レビューを行い、結果を提示してください
- スキップの場合: そのまま進んでください
次に、全情報を元にROI計算、Priority Score、工数見積り、verdictを算出してください。
nextStep を "generate" にしてください。`,

  generate: `全ヒアリング結果とレビュー結果を元に、最終的なブリーフを生成してください。

以下のフォーマットでMarkdownブリーフを生成してください:
---
title: (タイトル)
date: (今日の日付 YYYY-MM-DD)
requester: (依頼者)
priority_score: (1-5)
affected_users: (人数)
solution_scale: (script/shared_script/simple_web/web_system)
monthly_hours_current: (月間時間)
monthly_hours_projected: (自動化後の月間時間)
effort_level: (1-5)
verdict: (BUILD/DEFER/KILL)
status: reviewed
---

各セクション（Problem Statement, Current Workaround, Affected Users, ROI Estimate, MVP Scope, Effort Estimate, Verdict）を含めてください。

aiResponse にブリーフの要約を、brief にMarkdownブリーフ全文を含めてください。
done を true にしてください。`
}

function buildPrompt(data) {
  const { step, meta, conversation, userInput, projectRoot } = data
  const ctx = loadContext(projectRoot || process.cwd())
  const history = buildConversationHistory(conversation)
  const instruction = STEP_INSTRUCTIONS[step]

  if (!instruction) {
    throw new Error(`Unknown step: ${step}`)
  }

  return `あなたは社内要件定義の収束スキル「converge」のAIアシスタントです。
日本語で回答してください。

## ルール
${ctx.priorityScore}

${ctx.solutionScale}

${ctx.effortEstimate}

## 社内情報
${ctx.securityPolicy ? `### セキュリティポリシー\n${ctx.securityPolicy}` : '(未設定)'}

${ctx.existingTools ? `### 既存ツール\n${ctx.existingTools}` : '(未設定)'}

${ctx.constraints ? `### 技術制約\n${ctx.constraints}` : '(未設定)'}

## リクエスト情報
タイトル: ${meta.title}
依頼者: ${meta.requester}
時給: ${meta.hourlyRate}円

## これまでの会話
${history || '(まだ会話はありません)'}

## 現在のステップ: ${step}
${userInput ? `ユーザーの入力: ${userInput}` : ''}

## 指示
${instruction}

## 出力形式
必ず以下のJSON形式で回答してください。JSON以外のテキストは含めないでください。
{
  "aiResponse": "ユーザーに表示するメッセージ（Markdown可）",
  "nextStep": "次のステップID",
  "choices": null または [{"value": "選択値", "label": "表示ラベル"}],
  "done": false,
  "brief": null または "Markdownブリーフ全文（generateステップのみ）"
}`
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const child = execFile('claude', ['-p'], { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          reject(new Error('claude -p がタイムアウトしました（5分）。もう一度お試しください。'))
        } else {
          reject(new Error(`claude -p エラー: ${error.message}`))
        }
        return
      }
      resolve(stdout)
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

function parseResponse(raw, currentStep) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      aiResponse: raw.trim(),
      nextStep: currentStep,
      choices: null,
      done: false,
      brief: null,
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      aiResponse: parsed.aiResponse || raw.trim(),
      nextStep: parsed.nextStep || currentStep,
      choices: parsed.choices || null,
      done: parsed.done || false,
      brief: parsed.brief || null,
    }
  } catch {
    return {
      aiResponse: raw.trim(),
      nextStep: currentStep,
      choices: null,
      done: false,
      brief: null,
    }
  }
}

async function handleStep(data) {
  const prompt = buildPrompt(data)
  const raw = await callClaude(prompt)
  const result = parseResponse(raw, data.step)

  if (result.done && result.brief) {
    const { saveBrief } = require('./brief-writer.js')
    const briefPath = saveBrief(result.brief, data.meta, data.projectRoot || process.cwd())
    result.briefPath = briefPath
  }

  return result
}

module.exports = { handleStep, buildPrompt, parseResponse, loadContext }
```

- [ ] **Step 2: 動作確認（モジュールの読み込み）**

Run: `node -e "const { buildPrompt } = require('./src/conversation.js'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: コミット**

```bash
git add src/conversation.js
git commit -m "feat: conversation.js — claude -p プロンプト構築と実行"
```

---

### Task 3: brief-writer.js — ブリーフのファイル保存

**Files:**
- Create: `src/brief-writer.js`

- [ ] **Step 1: brief-writer.js を作成**

```javascript
const fs = require('fs')
const path = require('path')

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/-$/, '')
}

function saveBrief(briefContent, meta, projectRoot) {
  const reqDir = path.join(projectRoot, 'requirements')
  if (!fs.existsSync(reqDir)) {
    fs.mkdirSync(reqDir, { recursive: true })
  }

  const today = new Date().toISOString().slice(0, 10)
  const slug = slugify(meta.title)
  const filename = `${today}-${slug}.md`
  const filePath = path.join(reqDir, filename)

  if (fs.existsSync(filePath)) {
    const base = `${today}-${slug}`
    let counter = 2
    let newPath = path.join(reqDir, `${base}-${counter}.md`)
    while (fs.existsSync(newPath)) {
      counter++
      newPath = path.join(reqDir, `${base}-${counter}.md`)
    }
    fs.writeFileSync(newPath, briefContent, 'utf-8')
    return path.relative(projectRoot, newPath)
  }

  fs.writeFileSync(filePath, briefContent, 'utf-8')
  return path.relative(projectRoot, filePath)
}

module.exports = { saveBrief, slugify }
```

- [ ] **Step 2: 動作確認**

Run: `node -e "const { slugify } = require('./src/brief-writer.js'); console.log(slugify('請求書自動生成ツール'))"`
Expected: スラッグ文字列が出力される

- [ ] **Step 3: コミット**

```bash
git add src/brief-writer.js
git commit -m "feat: brief-writer.js — ブリーフのファイル保存"
```

---

### Task 4: フロントエンド — メタ情報入力画面

**Files:**
- Create: `templates/web/index.html`

- [ ] **Step 1: index.html の全体構造 + メタ情報画面を作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>converge — 社内要件定義ヒアリング</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px;
      min-height: 100vh;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: #1a1a1a;
    }
    .subtitle {
      color: #666;
      margin-bottom: 32px;
      font-size: 14px;
    }
    .screen { display: none; }
    .screen.active { display: block; }

    /* Progress bar */
    .progress {
      display: flex;
      gap: 4px;
      margin-bottom: 24px;
    }
    .progress-step {
      flex: 1;
      height: 4px;
      background: #ddd;
      border-radius: 2px;
      transition: background 0.3s;
    }
    .progress-step.done { background: #2563eb; }
    .progress-step.current { background: #60a5fa; }

    /* Form */
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 14px;
    }
    .hint {
      font-size: 13px;
      color: #888;
      margin-bottom: 6px;
    }
    input[type="text"], input[type="number"], textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      line-height: 1.5;
      transition: border-color 0.2s;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    textarea { min-height: 120px; resize: vertical; }

    /* Buttons */
    .btn {
      display: inline-block;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary {
      background: #2563eb;
      color: white;
    }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-primary:disabled {
      background: #93c5fd;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: #e5e7eb;
      color: #374151;
    }
    .btn-secondary:hover { background: #d1d5db; }
    .btn-choice {
      display: block;
      width: 100%;
      padding: 14px 16px;
      margin-bottom: 8px;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 15px;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.2s, background 0.2s;
    }
    .btn-choice:hover {
      border-color: #2563eb;
      background: #eff6ff;
    }

    /* Chat */
    .chat {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
      max-height: 60vh;
      overflow-y: auto;
      padding: 4px;
    }
    .msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 15px;
      line-height: 1.5;
      word-break: break-word;
    }
    .msg-ai {
      align-self: flex-start;
      background: white;
      border: 1px solid #e5e7eb;
    }
    .msg-user {
      align-self: flex-end;
      background: #2563eb;
      color: white;
    }
    .msg-ai p { margin-bottom: 8px; }
    .msg-ai p:last-child { margin-bottom: 0; }

    /* Loading */
    .typing {
      align-self: flex-start;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px 20px;
    }
    .typing span {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #999;
      border-radius: 50%;
      margin: 0 2px;
      animation: bounce 1.4s infinite;
    }
    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-8px); }
    }

    /* Input area */
    .input-area {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    .input-area textarea {
      flex: 1;
      min-height: 60px;
      max-height: 200px;
    }

    /* Result */
    .brief-preview {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 16px;
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.6;
      max-height: 60vh;
      overflow-y: auto;
    }
    .file-path {
      background: #f3f4f6;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
      margin-bottom: 16px;
    }

    /* Helper button */
    .help-toggle {
      font-size: 13px;
      color: #2563eb;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 0;
      text-decoration: underline;
    }
    .help-text {
      display: none;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px;
      margin-top: 6px;
      font-size: 14px;
      color: #92400e;
    }
    .help-text.show { display: block; }
  </style>
</head>
<body>
  <div class="container">

    <!-- Screen: Meta -->
    <div id="screen-meta" class="screen active">
      <h1>converge</h1>
      <p class="subtitle">社内要件定義ヒアリング</p>

      <div class="form-group">
        <label for="meta-title">リクエストのタイトル</label>
        <p class="hint">「○○を自動化したい」「○○ツールが欲しい」など</p>
        <input type="text" id="meta-title" placeholder="例: 請求書自動生成ツール">
      </div>

      <div class="form-group">
        <label for="meta-requester">依頼者</label>
        <p class="hint">部署名 + お名前</p>
        <input type="text" id="meta-requester" placeholder="例: 経理部 田中">
      </div>

      <div class="form-group">
        <label for="meta-rate">想定時給（円）</label>
        <p class="hint">ROI計算に使います。わからなければそのまま</p>
        <input type="number" id="meta-rate" value="3000" min="0">
      </div>

      <button class="btn btn-primary" onclick="startHearing()">ヒアリングを開始する</button>
    </div>

    <!-- Screen: Chat -->
    <div id="screen-chat" class="screen">
      <div class="progress" id="progress"></div>
      <div class="chat" id="chat"></div>
      <div id="input-container">
        <!-- Dynamic: textarea+send or choice buttons -->
      </div>
    </div>

    <!-- Screen: Result -->
    <div id="screen-result" class="screen">
      <h1>ブリーフが完成しました</h1>
      <div class="file-path" id="result-path"></div>
      <div class="brief-preview" id="result-brief"></div>
      <button class="btn btn-primary" onclick="startOver()">もう1件入力する</button>
    </div>

  </div>

<script>
// --- State ---
const STEPS = ['q1','q2','q3','q4','q5','q6','review','generate'];
const STEP_LABELS = {
  q1: 'Q1: これがないと何が起きる？',
  q2: 'Q2: 今、誰が、どうやって回避している？',
  q3: 'Q3: 誰が困っている？',
  q4: 'Q4: 月に何時間かかっている？',
  q5: 'Q5: 3ヶ月何もしなかったら？',
  q6: 'Q6: 最小構成は何？',
  review: 'レビュー中...',
  generate: 'ブリーフ生成中...',
};
const STEP_HINTS = {
  q1: '「もしこのツールが永遠に作られなかったとしたら、何が困りますか？」を考えてみてください。',
  q2: '「今、その作業は誰がやっていますか？どんな手順で？Excel? メール? 手作業?」',
  q3: '「この問題で困っているのは、あなただけですか？チーム全体ですか？同じ作業をしている人は他に何人？」',
  q4: '「先週1週間で、この作業に何回関わりましたか？1回あたり何分くらい？」で月間を推定できます。',
  q5: '「もし3ヶ月間このままだったら、何が起きますか？誰かが辞める？クレームが来る？何も変わらない？」',
  q6: '「全部は作れません。1つだけ機能を選ぶとしたら？それがあれば、明日から使いますか？」',
};

function getMeta() {
  const raw = localStorage.getItem('converge_meta');
  return raw ? JSON.parse(raw) : null;
}
function getConversation() {
  const raw = localStorage.getItem('converge_conversation');
  return raw ? JSON.parse(raw) : [];
}
function getCurrentStep() {
  return localStorage.getItem('converge_currentStep') || 'q1';
}
function saveMeta(meta) {
  localStorage.setItem('converge_meta', JSON.stringify(meta));
}
function saveConversation(conv) {
  localStorage.setItem('converge_conversation', JSON.stringify(conv));
}
function saveCurrentStep(step) {
  localStorage.setItem('converge_currentStep', step);
}

// --- Navigation ---
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startHearing() {
  const title = document.getElementById('meta-title').value.trim();
  const requester = document.getElementById('meta-requester').value.trim();
  const rate = parseInt(document.getElementById('meta-rate').value, 10) || 3000;

  if (!title) { alert('タイトルを入力してください'); return; }
  if (!requester) { alert('依頼者を入力してください'); return; }

  // Clear previous session data, keep only new meta
  localStorage.removeItem('converge_conversation');
  localStorage.removeItem('converge_currentStep');

  saveMeta({ title, requester, hourlyRate: rate });
  saveCurrentStep('q1');

  showScreen('screen-chat');
  renderChat();
}

function startOver() {
  localStorage.removeItem('converge_meta');
  localStorage.removeItem('converge_conversation');
  localStorage.removeItem('converge_currentStep');
  document.getElementById('meta-title').value = '';
  document.getElementById('meta-requester').value = '';
  document.getElementById('meta-rate').value = '3000';
  showScreen('screen-meta');
}

// --- Progress Bar ---
function renderProgress() {
  const currentStep = getCurrentStep();
  const currentIdx = STEPS.indexOf(currentStep);
  const el = document.getElementById('progress');
  el.innerHTML = STEPS.map((s, i) => {
    const cls = i < currentIdx ? 'done' : i === currentIdx ? 'current' : '';
    return `<div class="progress-step ${cls}"></div>`;
  }).join('');
}

// --- Chat Rendering ---
function renderChat() {
  renderProgress();
  const chat = document.getElementById('chat');
  const conv = getConversation();
  const currentStep = getCurrentStep();

  chat.innerHTML = '';

  // Render conversation history
  for (const entry of conv) {
    if (entry.step.startsWith('q')) {
      addMsgToChat(chat, 'ai', `**${STEP_LABELS[entry.step]}**\n\n${entry.aiPrompt || ''}`);
    }
    addMsgToChat(chat, 'user', entry.userAnswer);
    addMsgToChat(chat, 'ai', entry.aiResponse);
  }

  // Show current question
  if (STEP_LABELS[currentStep] && !currentStep.startsWith('review') && currentStep !== 'generate') {
    addMsgToChat(chat, 'ai', `**${STEP_LABELS[currentStep]}**`);
  }

  renderInputArea(currentStep);
  chat.scrollTop = chat.scrollHeight;
}

function addMsgToChat(chat, type, text) {
  const div = document.createElement('div');
  div.className = `msg msg-${type}`;
  div.innerHTML = simpleMarkdown(text);
  chat.appendChild(div);
}

function simpleMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// --- Input Area ---
function renderInputArea(step, choices) {
  const container = document.getElementById('input-container');

  if (choices && choices.length > 0) {
    container.innerHTML = choices.map(c =>
      `<button class="btn-choice" onclick="sendChoice('${c.value}', '${c.label}')">${c.label}</button>`
    ).join('');
    return;
  }

  if (step === 'generate' || step === 'review') {
    container.innerHTML = '';
    return;
  }

  const hint = STEP_HINTS[step] || '';
  container.innerHTML = `
    ${hint ? `<button class="help-toggle" onclick="toggleHelp()">ヒントを見る</button><div class="help-text" id="help-text">${hint}</div>` : ''}
    <div class="input-area">
      <textarea id="user-input" placeholder="回答を入力してください..." rows="3"></textarea>
      <button class="btn btn-primary" id="send-btn" onclick="sendAnswer()">送信</button>
    </div>
    <button class="btn-choice" style="margin-top:8px; text-align:center; color:#888;" onclick="sendAnswer('わからない')">わからない</button>
  `;
}

function toggleHelp() {
  const el = document.getElementById('help-text');
  if (el) el.classList.toggle('show');
}

// --- API Call ---
async function sendAnswer(override) {
  const input = override || document.getElementById('user-input').value.trim();
  if (!input) return;

  const meta = getMeta();
  const conversation = getConversation();
  const step = getCurrentStep();

  // Show user message
  const chat = document.getElementById('chat');
  addMsgToChat(chat, 'user', input);

  // Show loading
  const container = document.getElementById('input-container');
  container.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch('/api/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, meta, conversation, userInput: input })
    });
    const data = await res.json();

    if (data.error) {
      addMsgToChat(chat, 'ai', `エラーが発生しました: ${data.error}\n\nもう一度お試しください。`);
      renderInputArea(step);
      return;
    }

    // Save to conversation
    conversation.push({ step, userAnswer: input, aiResponse: data.aiResponse });
    saveConversation(conversation);

    // Show AI response
    addMsgToChat(chat, 'ai', data.aiResponse);

    if (data.done && data.brief) {
      // Show result screen
      document.getElementById('result-path').textContent = data.briefPath || 'requirements/';
      document.getElementById('result-brief').textContent = data.brief;
      showScreen('screen-result');
      return;
    }

    // Move to next step
    const nextStep = data.nextStep || step;
    saveCurrentStep(nextStep);
    renderProgress();

    if (nextStep === 'review' && step !== 'review') {
      // Auto-trigger review
      addMsgToChat(chat, 'ai', '**レビューフェーズを開始します...**');
      container.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
      await autoStep(nextStep);
    } else if (nextStep === 'generate') {
      // Auto-trigger generate
      addMsgToChat(chat, 'ai', '**ブリーフを生成しています...**');
      container.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
      await autoStep(nextStep);
    } else if (data.choices) {
      renderInputArea(nextStep, data.choices);
    } else {
      // Show next question
      if (STEP_LABELS[nextStep] && nextStep !== step) {
        addMsgToChat(chat, 'ai', `**${STEP_LABELS[nextStep]}**`);
      }
      renderInputArea(nextStep);
    }

    chat.scrollTop = chat.scrollHeight;
  } catch (err) {
    addMsgToChat(chat, 'ai', `通信エラーが発生しました。サーバーが起動しているか確認してください。`);
    renderInputArea(step);
  }
}

async function sendChoice(value, label) {
  const meta = getMeta();
  const conversation = getConversation();
  const step = getCurrentStep();

  const chat = document.getElementById('chat');
  addMsgToChat(chat, 'user', label);

  const container = document.getElementById('input-container');
  container.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';

  try {
    const res = await fetch('/api/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, meta, conversation, userInput: value })
    });
    const data = await res.json();

    conversation.push({ step, userAnswer: label, aiResponse: data.aiResponse });
    saveConversation(conversation);

    addMsgToChat(chat, 'ai', data.aiResponse);

    if (data.done && data.brief) {
      document.getElementById('result-path').textContent = data.briefPath || 'requirements/';
      document.getElementById('result-brief').textContent = data.brief;
      showScreen('screen-result');
      return;
    }

    const nextStep = data.nextStep || step;
    saveCurrentStep(nextStep);
    renderProgress();

    if (nextStep === 'generate') {
      addMsgToChat(chat, 'ai', '**ブリーフを生成しています...**');
      container.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
      await autoStep(nextStep);
    } else if (data.choices) {
      renderInputArea(nextStep, data.choices);
    } else {
      renderInputArea(nextStep);
    }

    chat.scrollTop = chat.scrollHeight;
  } catch (err) {
    addMsgToChat(chat, 'ai', `通信エラーが発生しました。`);
    renderInputArea(step);
  }
}

async function autoStep(step) {
  const meta = getMeta();
  const conversation = getConversation();
  const chat = document.getElementById('chat');
  const container = document.getElementById('input-container');

  try {
    const res = await fetch('/api/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, meta, conversation, userInput: '' })
    });
    const data = await res.json();

    conversation.push({ step, userAnswer: '(auto)', aiResponse: data.aiResponse });
    saveConversation(conversation);

    addMsgToChat(chat, 'ai', data.aiResponse);

    if (data.done && data.brief) {
      document.getElementById('result-path').textContent = data.briefPath || 'requirements/';
      document.getElementById('result-brief').textContent = data.brief;
      showScreen('screen-result');
      return;
    }

    const nextStep = data.nextStep || step;
    saveCurrentStep(nextStep);
    renderProgress();

    if (data.choices) {
      renderInputArea(nextStep, data.choices);
    } else if (nextStep === 'generate' && step !== 'generate') {
      addMsgToChat(chat, 'ai', '**ブリーフを生成しています...**');
      container.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
      await autoStep(nextStep);
    } else {
      renderInputArea(nextStep);
    }

    chat.scrollTop = chat.scrollHeight;
  } catch (err) {
    addMsgToChat(chat, 'ai', `通信エラーが発生しました。`);
    renderInputArea(step);
  }
}

// --- Init ---
(function init() {
  const meta = getMeta();
  const conv = getConversation();
  if (meta && conv.length > 0) {
    showScreen('screen-chat');
    renderChat();
  }
})();
</script>
</body>
</html>
```

- [ ] **Step 2: サーバーを起動してHTMLが表示されるか確認**

Run: `node bin/converge-web &`
Run: `curl -s http://localhost:3456/ | head -5`
Expected: `<!DOCTYPE html>` で始まるHTMLが返る
Run: `kill %1`

- [ ] **Step 3: コミット**

```bash
git add templates/web/index.html
git commit -m "feat: フロントエンドSPA — メタ情報入力 + チャットUI + 結果画面"
```

---

### Task 5: スラッシュコマンド + check.js 更新

**Files:**
- Create: `templates/commands/converge-web.md`
- Modify: `src/check.js`

- [ ] **Step 1: converge-web.md スラッシュコマンドを作成**

```markdown
Run `node bin/converge-web` in the project root to start the converge web hearing UI.
Tell the user that the web UI is available at http://localhost:3456 and that they can share this URL with the person who will answer the hearing questions.
Wait for the server process to finish (Ctrl+C).
```

- [ ] **Step 2: src/check.js に converge-web 関連のチェックを追加**

`src/check.js` の checks 配列に以下を追加:

```javascript
{
  name: 'bin/converge-web',
  path: path.join(projectRoot, 'bin', 'converge-web'),
  required: false,
},
```

`bin/` のファイルはプロジェクトに配置されないので `required: false` とする。

- [ ] **Step 3: コミット**

```bash
git add templates/commands/converge-web.md src/check.js
git commit -m "feat: /converge-web スラッシュコマンドと check.js 更新"
```

---

### Task 6: package.json + README 更新

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: package.json に converge-web の bin エントリを追加**

`bin` フィールドに追加:

```json
"bin": {
  "converge": "bin/converge",
  "converge-web": "bin/converge-web"
},
```

- [ ] **Step 2: README.md に converge-web セクションを追加**

Quick Start セクションの後に以下を追加:

```markdown
## Web版ヒアリングUI

非エンジニアの実務担当者がブラウザ上でヒアリングに回答できるWeb版。

### 起動

Claude Code で:
```
/converge-web
```

またはターミナルで:
```bash
node bin/converge-web
node bin/converge-web --port 8080  # ポート指定
```

`http://localhost:3456` をブラウザで開き、担当者に回答してもらいます。

### 流れ

1. タイトル・依頼者名・時給を入力
2. Q1〜Q6に1問ずつチャット形式で回答
3. AIがレビュー（既存サービス調査、実装規模チェック、批判的レビュー）
4. ブリーフが requirements/ に自動生成
```

CLIコマンドテーブルにも追加:

```markdown
| `converge-web` | ブラウザ版ヒアリングUIを起動 |
| `converge-web --port 8080` | ポート指定で起動 |
```

- [ ] **Step 3: コミット**

```bash
git add package.json README.md
git commit -m "docs: converge-web のドキュメントとpackage.json更新"
```

---

### Task 7: 統合テスト

- [ ] **Step 1: サーバー起動確認**

Run: `node bin/converge-web &`
Expected: `http://localhost:3456` が表示される

- [ ] **Step 2: HTML配信確認**

Run: `curl -s http://localhost:3456/ | grep '<title>'`
Expected: `<title>converge — 社内要件定義ヒアリング</title>`

- [ ] **Step 3: API エンドポイント確認（claude -p なし、エラーハンドリング確認）**

Run: `curl -s -X POST http://localhost:3456/api/step -H 'Content-Type: application/json' -d '{"step":"q1","meta":{"title":"test","requester":"test","hourlyRate":3000},"conversation":[],"userInput":"テスト回答"}'`
Expected: JSON レスポンスが返る（claude がインストールされていれば aiResponse が含まれる）

- [ ] **Step 4: 404 確認**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3456/notfound`
Expected: `404`

- [ ] **Step 5: サーバー停止**

Run: `kill %1`

- [ ] **Step 6: init テスト（converge-web.md が配置されるか）**

Run: `cd /tmp && mkdir converge-web-test && cd converge-web-test && node /Users/go/work/hosty/converge/bin/converge init 2>&1 | grep converge-web`
Expected: `+ .claude/commands/converge-web.md` が表示される
Run: `rm -rf /tmp/converge-web-test`

- [ ] **Step 7: 最終コミット**

```bash
git add -A
git commit -m "feat: converge-web 統合テスト完了"
git push origin main
```
