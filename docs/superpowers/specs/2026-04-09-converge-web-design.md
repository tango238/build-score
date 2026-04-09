# converge-web 設計スペック

## 概要

`converge-web` は converge のブラウザ版ヒアリングUI。エンジニアがコマンドで起動し、実務担当者がブラウザ上でQ1〜Q6に1問ずつ回答する。各ステップで `claude -p` を呼び出し、CLI版（/converge）と同じ対話フロー（スキップ判断、フォローアップ質問、レビューフェーズの確認）を再現する。

## 背景・動機

- /converge はClaude Codeの操作が必要で、非エンジニアが直接使えない
- インストールと起動はエンジニアが行い、入力は各実務担当者に行ってもらいたい
- CLI版と結果の精度を同一にしたい

## ユーザーフロー

1. エンジニアが `node bin/converge-web` で起動
2. `http://localhost:3456` が開く（ブラウザ自動起動）
3. 担当者がメタ情報を入力（タイトル、依頼者名、時給）
4. Q1〜Q6を1問ずつ対話形式で進める
   - 回答送信 → AIがフォローアップ or スキップ判断 → 次の質問
   - AIの応答はチャット風に表示
5. レビューフェーズ（Step 1〜3）
   - 既存サービス調査 → 結果表示 + 確認
   - 実装規模チェック → 結果表示
   - 批判的レビュー → 前提チャレンジ確認 + セカンドオピニオン確認
6. ブリーフプレビュー表示 + requirements/ に保存
7. 「もう1件入力する」で最初に戻る

## アーキテクチャ

```
┌─────────────┐     POST /api/step      ┌──────────────┐     stdin/stdout     ┌───────────┐
│   Browser    │ ──────────────────────→ │  Node.js     │ ──────────────────→  │ claude -p │
│  (SPA)       │ ←────────────────────── │  HTTP Server │ ←────────────────── │           │
│  LocalStorage│     JSON response       │  (stateless) │                     │           │
└─────────────┘                          └──────────────┘                     └───────────┘
```

### ステートレスサーバー

- サーバーはセッション状態を持たない
- 全会話履歴はブラウザの LocalStorage に保存
- 各リクエストでクライアントが全履歴を送信
- サーバーはそれを claude -p のプロンプトに組み立てて実行

## API設計

### POST /api/step

リクエスト:
```json
{
  "step": "q1",
  "meta": {
    "title": "請求書自動生成ツール",
    "requester": "経理部 田中",
    "hourlyRate": 3000
  },
  "conversation": [
    { "step": "q1", "userAnswer": "...", "aiResponse": "..." },
    { "step": "q2", "userAnswer": "...", "aiResponse": "..." }
  ],
  "userInput": "現在の回答テキスト or 選択肢"
}
```

レスポンス:
```json
{
  "aiResponse": "AIの応答テキスト（Markdown）",
  "nextStep": "q2",
  "choices": null,
  "done": false
}
```

choices がある場合（確認が必要なステップ）:
```json
{
  "aiResponse": "既存サービス調査をしてよいですか？",
  "nextStep": "review-confirm",
  "choices": [
    { "value": "yes", "label": "検索してください" },
    { "value": "skip", "label": "スキップ" }
  ],
  "done": false
}
```

最終レスポンス:
```json
{
  "aiResponse": "ブリーフを生成しました。",
  "nextStep": null,
  "brief": "（Markdownブリーフ全文）",
  "briefPath": "requirements/2026-04-09-invoice-automation.md",
  "done": true
}
```

### GET /

フロントエンドHTMLを返す。

## ステップ管理

| step | 内容 | claude -p への指示 |
|------|------|-------------------|
| meta | メタ情報入力 | claude -p 呼び出しなし（クライアントのみ） |
| q1 | Q1: これがないと何が起きる？ | 回答を評価。フォローアップが必要なら質問、不要なら次へ |
| q2 | Q2: 今、誰が、どうやって回避している？ | 同上 |
| q3 | Q3: 誰が困っている？ | 同上 + ソリューション規模判定 |
| q4 | Q4: 月に何時間かかっている？ | 同上 |
| q5 | Q5: 3ヶ月何もしなかったら？ | 同上 |
| q6 | Q6: 最小構成は何？ | 同上 + MVP機能を最大3つに絞る |
| review | レビューフェーズ | Step 1〜3 をフル実行。途中で確認が必要な場合は choices を返す |
| generate | ブリーフ生成 | 全情報を元にブリーフを生成して requirements/ に保存 |

## claude -p プロンプト構築

各ステップで以下の構造のプロンプトを構築する:

```
あなたは社内要件定義の収束スキル「converge」のAIアシスタントです。
日本語で回答してください。

## ルール
{rules/priority-score.md の内容}
{rules/solution-scale.md の内容}
{rules/effort-estimate.md の内容}

## 社内情報
{knowledges/security-policy.md の内容（あれば）}
{knowledges/existing-tools.md の内容（あれば）}
{knowledges/constraints.md の内容（あれば）}

## リクエスト情報
タイトル: {meta.title}
依頼者: {meta.requester}
時給: {meta.hourlyRate}円

## これまでの会話
Q1: {conversation[0].userAnswer}
AI応答: {conversation[0].aiResponse}
Q2: {conversation[1].userAnswer}
...

## 現在のステップ: {step}
ユーザーの回答: {userInput}

## 指示
{ステップに応じた指示}

回答はJSON形式で返してください:
{ "aiResponse": "...", "nextStep": "...", "choices": null }
```

## フロントエンド設計

### 技術

- 単一HTML（templates/web/index.html）
- インラインCSS + JavaScript
- 外部依存なし
- LocalStorage でステート管理

### LocalStorage スキーマ

```json
{
  "converge_meta": { "title": "...", "requester": "...", "hourlyRate": 3000 },
  "converge_conversation": [
    { "step": "q1", "userAnswer": "...", "aiResponse": "..." }
  ],
  "converge_currentStep": "q2"
}
```

### 画面構成

**メタ情報入力画面**
- タイトル（必須）
- 依頼者名（必須）
- 想定時給（デフォルト3,000円）
- 「開始」ボタン

**対話画面（Q1〜Q6 + レビュー）**
- チャット風レイアウト
  - 左: AIの質問・応答（吹き出し）
  - 右: ユーザーの回答（吹き出し）
- 下部: テキストエリア + 送信ボタン
- choices がある場合: テキストエリアの代わりにボタン群を表示
- ローディング中: タイピングアニメーション（「...」の点滅）
- 上部: プログレスバー（Q1〜Q6 + レビュー + 完了）

**結果画面**
- ブリーフのMarkdownをHTMLに整形表示
- 保存先ファイルパス表示
- 「もう1件入力する」ボタン（LocalStorageクリア + メタ情報画面へ）

### UIの配慮（リテラシーが低いユーザー向け）

- 各質問に「ヒント」ボタン — SKILL.mdの聴き方ガイドから抜粋した補助テキストを表示
- 「わからない」ボタン — フォールバック質問をAIに依頼
- テキストエリアは大きめ（最低4行）
- 送信はEnterではなくボタンクリック（改行入力を妨げない）
- フォントサイズは16px以上（モバイル対応）

## ファイル構成

```
bin/converge-web            # CLIエントリポイント（#!/usr/bin/env node）
src/server.js               # HTTPサーバー + /api/step エンドポイント
src/conversation.js         # claude -p プロンプト構築 + 実行 + レスポンスパース
templates/web/index.html    # フロントエンド SPA
```

## コマンド

```bash
node bin/converge-web                # localhost:3456 で起動
node bin/converge-web --port 8080    # ポート指定
```

## エラーハンドリング

- **claude -p のJSON出力パース失敗**: aiResponse としてテキスト全体を返し、nextStep は現在のステップを維持（リトライ可能）
- **claude -p のタイムアウト**: 5分でタイムアウト。「応答に時間がかかっています。もう一度お試しください」を返す
- **claude CLI が見つからない**: サーバー起動時にチェックし、エラーメッセージを表示して終了

## 制約・前提

- Node.js 18以上
- `claude` CLI がインストール済みで PATH に通っている
- 同時利用は1人を想定（排他制御なし）
- 外部npm依存なし（Node.js標準モジュールのみ）

## 今後の拡張可能性（スコープ外）

- ダッシュボード表示（ブリーフ一覧、ROI集計）
- 複数人同時利用（セッション管理追加）
- 認証機能
