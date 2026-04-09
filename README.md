# converge

社内要件定義の収束スキル for Claude Code。

要件定義する前にそもそもやる必要がどこまであるかを要求分析、利用ツールの選定、削減工数の算出、スコア数値化するスキル。
漠然とした社内ツールリクエストを固定6質問で収束させ、BUILD / DEFER / KILL 判定付きの1ページブリーフに変換します。
これはドキュメント生成ツールではなく、「作るべきか、やめるべきか」を判断します。

## インストール（30秒）

### 前提条件

- Node.js 18 以上
- Git
- GitHub への認証（SSH鍵 or `gh auth login`）

### Claude Code からインストール

```bash
git clone --single-branch --depth 1 git@github.com:hosty-inhouse/converge.git ~/.claude/skills/converge && cd ~/.claude/skills/converge && node setup
```

これだけで完了。Claude Code で `/converge` が使えるようになります。

### アップデート

```bash
cd ~/.claude/skills/converge && git pull && node setup
```

### プロジェクトへの配置（オプション）

チームで使う場合、プロジェクトのリポジトリにスキルファイルを配置できます:

```bash
cd /path/to/your-project
node ~/.claude/skills/converge/bin/converge init

# アップデート（knowledges/ は保護）
node ~/.claude/skills/converge/bin/converge init --force --keep-knowledges

# セットアップ確認
node ~/.claude/skills/converge/bin/converge check
```

### アンインストール

```bash
rm -rf ~/.claude/skills/converge
```

## Quick Start

```
Claude Code で /converge と入力
→ A) 単件モード を選択
→ 依頼内容をペーストまたは口述
→ 6つの収束質問に順番に答える（依頼者と一緒に）
→ 時給を入力（ROI計算用、デフォルト3,000円/時）
→ ブリーフが requirements/ に出力される
```

想定シーン:

```
経理「請求書の作成を自動化したいんですけど...」
         ↓
エンジニアがターミナルで /converge を起動
         ↓
Q1-Q6を依頼者と一緒に回答（15-30分）
         ↓
requirements/2026-04-08-invoice-automation.md が出力
         ↓
verdict: BUILD (score: 4) → 開発GO
```

## 使い方

### 単件モード（基本）

業務部門から「こういうツール作って」と言われたら、Claude Code で `/converge` を実行。6つの質問に順番に答えるだけでブリーフが生成されます。

### バッチモード（まとめて登録）

複数リクエストが溜まっているとき:

```
/converge
→ B) バッチモード を選択
→ タイトル + 一行説明をリストで入力（推奨上限 5件/回）
→ draft ブリーフが一括作成される
→ 後から個別に深掘り可能
```

### スクリプト（一覧確認・報告）

```bash
# 全ブリーフの一覧表示（優先順位会議用）
node converge/scripts/list-briefs.js

# ROI 集計（マネジメント報告用）
node converge/scripts/roi-summary.js

# 個別のスコア確認
node converge/scripts/score.js requirements/2026-04-08-invoice-automation.md
```

## 配置されるファイル

```
your-project/
  .claude/commands/converge.md   # /converge スラッシュコマンド
  converge/
    SKILL.md                     # スキル本体（対話フロー・ヒアリング台本）
    templates/
      requirement.md             # ブリーフ出力テンプレート
    scripts/
      score.js                   # Priority Score 表示
      list-briefs.js             # 全ブリーフ一覧
      roi-summary.js             # ROI 集計
    knowledges/
      security-policy.md         # セキュリティ制約
      existing-tools.md          # 社内既存ツール一覧
      constraints.md             # 技術制約
    rules/
      priority-score.md          # Priority Score ルブリック（カスタマイズ可）
      solution-scale.md          # 実装規模の優先順位（カスタマイズ可）
  requirements/                  # ブリーフ出力先
```

## 初期設定

`converge/knowledges/` の3ファイルを社内の実情報で埋めてください。サンプルが入っているので、それを書き換えます。

| ファイル | 書くこと | 効果 |
|---------|---------|------|
| `security-policy.md` | セキュリティルール（外部クラウド禁止等） | 実現不可能な要件を早期に検出 |
| `existing-tools.md` | 社内で使えるツール一覧 | 既存ツールで代替可能な場合にKILL判定 |
| `constraints.md` | 技術スタック、デプロイ頻度、リソース上限 | MVPスコープを現実的にする |

空のままでも動作しますが、精度が下がります。

## 収束シーケンス

6つの質問を順番に進めます。明らかに回答済みの質問はスキップ可能。

| # | 質問 | 目的 | 判明すること |
|---|------|------|-------------|
| Q1 | これがないと何が起きる？ | KILL候補の検出 | 本当に必要かどうか |
| Q2 | 今、誰が、どうやって回避している？ | ワークアラウンドの把握 | 現在の手順とコスト |
| Q3 | 誰が困っている？ | 影響範囲の特定 | 人数とソリューション規模 |
| Q4 | 月に何時間かかっている？ | ROI 定量化 | 削減効果（人数×時間） |
| Q5 | 3ヶ月何もしなかったら？ | 緊急度の判定 | BUILD/DEFERの分岐 |
| Q6 | 最小構成は何？ | スコープの収束 | MVP機能（最大3つ） |

### Q3 のソリューション規模判定

| 影響人数 | ソリューション規模 | 例 |
|---------|-------------------|-----|
| 1人 | スクリプト / Claude Code Skill / CLI | 個人の定型作業を自動化 |
| 2-5人 | 共有スクリプト / 簡易Webツール | チーム内の共通作業を効率化 |
| 6人以上 or 複数部門 | Webシステム（認証・ユーザー管理・データ連携） | 部門横断の業務基盤 |

## レビューフェーズ（Q6完了後、自動実施）

単件モードでQ1-Q6が完了すると、ブリーフ出力前に3つのレビューが自動実行されます:

**Step 1: 既存サービス・ツール調査**
WebSearchで既存のSaaS、無料ツール、OSSを検索。完全に代替可能ならKILL判定に変更。

**Step 2: 実装規模の最小化チェック**
`converge/rules/solution-scale.md` の優先順位に従い、最も軽量な手段を推奨。デフォルト:

| 優先度 | 手段 | 例 |
|--------|------|-----|
| 1 | 既存ツールの設定変更 | Slackワークフロー、Google Forms通知 |
| 2 | Claude Code Skill / スラッシュコマンド | 対話型ワークフロー |
| 3 | シェルスクリプト / `claude -p` | cron + バッチ処理 |
| 4 | 既存スキルの組み合わせ | GAS + Slack Webhook |
| 5 | 簡易Webツール（認証なし） | 静的HTML + API |
| 6 | Webシステム（認証・DB付き） | フルスタックアプリ |

**Step 3: 批判的レビュー（CEO/経営視点）**
開発コスト対効果、依頼者のバイアス、導入後の利用率、タイミングを批判的に評価。

## Priority Score

| Score | Verdict | 条件 |
|-------|---------|------|
| 5 | BUILD | 月間20h+ / 苦痛なワークアラウンド / 3ヶ月で業務に支障 |
| 4 | BUILD | 月間10-19h / ワークアラウンドあり / MVP が明確 |
| 3 | DEFER | 月間5-9h / ワークアラウンドで当面回せる |
| 2 | DEFER | 月間5h未満 or 3ヶ月放置で影響なし |
| 1 | KILL | なくても困らない or 既存ツールで代替可能 |

## DEFER 案件の再評価

DEFER 判定のブリーフは `status: deferred` になります。次回 `/converge` 実行時に、3ヶ月以上前の DEFER 案件があれば自動通知されます。

## ブリーフ出力例

```markdown
---
title: 請求書自動生成ツール
date: 2026-04-08
requester: 経理部 田中
priority_score: 4
affected_users: 3
solution_scale: simple_web
monthly_hours_current: 15
monthly_hours_projected: 3
verdict: BUILD
status: reviewed
---

## Problem Statement

毎月の請求書作成に経理部が15時間費やしている。
手作業でExcelテンプレートに転記しており、転記ミスが月2-3件発生。

## Current Workaround

Excelテンプレートに手動転記。ダブルチェックで2名体制。

## Affected Users

- 影響人数: 3人
- ソリューション規模: simple_web（共有Webツール）

## ROI Estimate

- 月間削減（1人あたり）: 12時間
- 影響人数: 3人
- 時給: 3,000円
- 月間削減コスト: 108,000円
- 年間削減コスト: 1,296,000円

## MVP Scope

- 売上データからの自動転記
- PDF出力
- 月次バッチ実行

## Verdict: BUILD

月間15時間×3人の削減効果。ワークアラウンド（手動転記）が苦痛で転記ミスも発生。
3ヶ月放置すると繁忙期に対応できないリスクあり。最小構成が明確。
```

## CLIコマンド

| コマンド | 説明 |
|---------|------|
| `converge init` | プロジェクトにスキル一式を配置 |
| `converge init --force` | 既存ファイルを上書きして再配置 |
| `converge init --force --keep-knowledges` | スキル更新、knowledges/ は保護 |
| `converge check` | セットアップ状態を確認 |
| `converge help` | ヘルプを表示 |

## License

MIT
