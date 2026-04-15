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
  const rulesDir = path.join(projectRoot, 'build-score', 'rules')
  const knowledgesDir = path.join(projectRoot, 'build-score', 'knowledges')

  return {
    priorityScore: readFileIfExists(path.join(rulesDir, 'priority-score.md')),
    solutionScale: readFileIfExists(path.join(rulesDir, 'solution-scale.md')),
    effortEstimate: readFileIfExists(path.join(rulesDir, 'effort-estimate.md')),
    securityPolicy: readFileIfExists(path.join(knowledgesDir, 'security-policy.md')),
    existingTools: readFileIfExists(path.join(knowledgesDir, 'existing-tools.md')),
    constraints: readFileIfExists(path.join(knowledgesDir, 'constraints.md')),
  }
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
- 一般化されたカテゴリ用語で既存ソリューションを評価してください
- knowledges の社内ツール情報も確認してください
- 完全に代替可能ならKILL判定に変更を提案してください

Step 2: 実装規模の最小化チェック
- rules/solution-scale.md の優先順位に従い、最も軽量な手段を推奨してください

Step 3: 批判的レビュー（CEO/経営視点）
- 前提チャレンジ: これは正しい問題か？代理問題ではないか？
- Dream State Mapping: 12ヶ月後の理想状態にこのリクエストは向かうか？
- 反転思考: 何がこのプロジェクトを失敗させるか？

レビュー結果をまとめて提示してください。
そのうえで、セカンドオピニオンを取るか選択肢を出してください。

choices を以下のように設定:
[{"value": "yes", "label": "セカンドオピニオンを取る（推奨）"}, {"value": "skip", "label": "スキップして結果に進む"}]

nextStep を "review-confirm" にしてください。`,

  'review-confirm': `ユーザーの選択に基づいて処理してください。
- "yes" または "セカンドオピニオンを取る" の場合: 独立した視点から批判的にレビューし、最も強い解釈、見落とされているリスク、間違っている前提、BUILD/DEFER/KILLの推奨を提示
- "skip" または "スキップ" の場合: そのまま続行

次に、全情報を元に以下を算出:
1. ROI計算（月間削減時間、月間/年間削減コスト）
2. Priority Score（rules/priority-score.md のルブリックに従う）
3. 工数見積り（rules/effort-estimate.md の4軸評価に従う）
4. Verdict（BUILD/DEFER/KILL）

算出結果をユーザーに提示してください。
nextStep を "generate" にしてください。`,

  revalidate: `すでに生成済みのブリーフを、ユーザーのQ1〜Q6の回答とレビュー結果に照らし合わせて再検証してください。

## 再検証の観点
1. **整合性チェック**: 生成ブリーフの各セクション（Problem Statement / Current Workaround / Affected Users / ROI Estimate / MVP Scope / Solution Approach / Effort Estimate / Critical Review / Verdict / Raw Notes）が、Q1〜Q6の回答と矛盾していないか
2. **計算の妥当性**: ROI計算（月間削減時間 × 時給 × 人数）、Priority Score、Effort Estimate の算出が rules に沿っており、数値に誤りがないか
3. **判定の妥当性**: BUILD/DEFER/KILL の判定が Priority Score と Critical Review の内容から妥当に導かれているか
4. **記載漏れ**: 会話の中で触れられた重要情報（特定のツール名、人数、時間、制約）がブリーフから漏れていないか
5. **過剰/不足**: 会話にない情報を勝手に追加していないか、逆に重要な情報を省略していないか

## 出力方針
- 再検証の結果、問題がなければ "changesFound": false としてください
- 問題があれば、修正後のブリーフ全文を "brief" フィールドに格納し、"changesFound": true としてください（変更なしの場合は元のブリーフをそのまま "brief" に返してください）
- "aiResponse" には、再検証の結果サマリ（検出した問題・修正内容・検証OKなら「問題なし」）をMarkdownで記述してください

## 出力形式
必ず以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。
{
  "aiResponse": "再検証結果のサマリ（Markdown）",
  "nextStep": null,
  "choices": null,
  "done": true,
  "brief": "修正後のブリーフ全文（変更なしの場合は元のブリーフをそのまま返す）",
  "changesFound": true または false
}`,

  generate: `全ヒアリング結果とレビュー結果を元に、最終的なブリーフを生成してください。

以下のMarkdownフォーマットでブリーフ全文を生成し、"brief" フィールドに格納してください:

---
title: (タイトル)
date: (今日の日付 YYYY-MM-DD)
requester: (依頼者)
priority_score: (1-5)
affected_users: (人数 or unknown)
solution_scale: (script/shared_script/simple_web/web_system)
monthly_hours_current: (月間時間 or unknown)
monthly_hours_projected: (自動化後の推定月間時間)
effort_level: (1-5)
verdict: (BUILD/DEFER/KILL)
status: reviewed
---

## Problem Statement
(問題の要約)

## Current Workaround
(現在の回避方法)

## Affected Users
- 影響人数: X人
- ソリューション規模: (規模)

## ROI Estimate
- 月間削減（1人あたり）: X時間
- 影響人数: X人
- 時給: X円
- 月間削減コスト: X円
- 年間削減コスト: X円

## MVP Scope
- (機能1)
- (機能2)
- (機能3)

## Solution Approach
(Step 2 実装規模チェックの結果。推奨手段とその理由。代替手段がある場合は優先順位テーブルで提示)

## Effort Estimate
- 工数レベル: X / 5（目安期間）

### 根拠
| 評価軸 | 評価 | 理由 |
|--------|------|------|
| 機能の技術的難易度 | 高/中/低 | (理由) |
| 利用ツール・構築ツールの難易度 | 高/中/低 | (理由) |
| 要件定義の難易度 | 高/中/低 | (理由) |
| 運用・インフラの複雑さ | 高/中/低 | (理由) |

## Critical Review

### 前提チャレンジ
(Step 3 の前提チャレンジ結果。問題のフレーミングは正しいか、代理問題ではないか)

### リスク評価
| 失敗シナリオ | 確率 | 影響度 | 対策 |
|-------------|------|--------|------|
| (シナリオ1) | 高/中/低 | 高/中/低 | (対策) |
| (シナリオ2) | 高/中/低 | 高/中/低 | (対策) |

### セカンドオピニオン
(実施した場合: 指摘事項の要約。スキップした場合: 「スキップ」)

## Verdict: (BUILD/DEFER/KILL)
(判定理由の要約)

## Raw Notes
(Q1〜Q6の回答を以下の形式で要約)
- **Q1（これがないと何が起きる？）:** ...
- **Q2（今、誰が、どうやって回避している？）:** ...
- **Q3（誰が困っている？）:** ...
- **Q4（月に何時間かかっている？）:** ...
- **Q5（3ヶ月何もしなかったら？）:** ...
- **Q6（最小構成は何？）:** ...

aiResponse にはブリーフの要約を含めてください。
brief にはMarkdownブリーフ全文を含めてください。
done を true にしてください。
nextStep は null にしてください。`,
}

function buildPrompt(data) {
  const { step, meta, conversation, userInput, projectRoot, currentBrief } = data
  const ctx = loadContext(projectRoot || process.cwd())
  const history = buildConversationHistory(conversation)
  const instruction = STEP_INSTRUCTIONS[step]

  if (!instruction) {
    throw new Error(`Unknown step: ${step}`)
  }

  const briefSection = step === 'revalidate' && currentBrief
    ? `\n## 再検証対象のブリーフ（生成済み）\n\`\`\`markdown\n${currentBrief}\n\`\`\`\n`
    : ''

  return `あなたは社内要件定義の収束スキル「build-score」のAIアシスタントです。
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
${briefSection}
## 現在のステップ: ${step}
${userInput ? `ユーザーの入力: ${userInput}` : ''}

## 指示
${instruction}

## 出力形式
必ず以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。
{
  "aiResponse": "ユーザーに表示するメッセージ（Markdown可）",
  "nextStep": "次のステップID",
  "choices": null,
  "done": false,
  "brief": null
}`
}

function callClaude(prompt, cwd) {
  return new Promise((resolve, reject) => {
    const child = execFile('claude', ['-p'], { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024, cwd: cwd || process.cwd() }, (error, stdout) => {
      if (error) {
        if (error.killed) {
          reject(new Error('応答に時間がかかっています（5分タイムアウト）。もう一度お試しください。'))
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
  const trimmed = raw.trim()

  // ```json ... ``` ブロックの抽出
  const jsonBlockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1])
      return normalizeResponse(parsed, currentStep)
    } catch {
      // fallthrough
    }
  }

  // 生JSON
  try {
    const parsed = JSON.parse(trimmed)
    return normalizeResponse(parsed, currentStep)
  } catch {
    // fallthrough
  }

  // JSONを含む部分を探す
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return normalizeResponse(parsed, currentStep)
    } catch {
      // fallthrough
    }
  }

  // フォールバック
  return {
    aiResponse: trimmed,
    nextStep: currentStep,
    choices: null,
    done: false,
    brief: null,
    changesFound: null,
  }
}

function normalizeResponse(parsed, currentStep) {
  return {
    aiResponse: parsed.aiResponse || '',
    nextStep: parsed.nextStep || currentStep,
    choices: parsed.choices || null,
    done: parsed.done || false,
    brief: parsed.brief || null,
    changesFound: typeof parsed.changesFound === 'boolean' ? parsed.changesFound : null,
  }
}

async function handleStep(data) {
  const projectRoot = data.projectRoot || process.cwd()
  const prompt = buildPrompt(data)
  const raw = await callClaude(prompt, projectRoot)
  const result = parseResponse(raw, data.step)

  if (result.done && result.brief) {
    // revalidate で変更がない場合はファイルを書き換えない（元のブリーフを保持）
    const shouldSave = data.step !== 'revalidate' || result.changesFound === true
    if (shouldSave) {
      const { saveBrief } = require('./brief-writer.js')
      const briefPath = saveBrief(result.brief, data.meta, projectRoot)
      result.briefPath = briefPath
    }
  }

  return result
}

module.exports = { handleStep, buildPrompt, parseResponse, loadContext }
