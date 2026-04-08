# @hosty-jp/converge

社内要件定義の収束スキル for Claude Code。

漠然とした社内ツールリクエストを固定6質問で収束させ、BUILD / DEFER / KILL 判定付きの1ページブリーフに変換する。これはドキュメント生成ツールではなく、「作るべきか、やめるべきか」を判断するキルゲート。

## インストール

### 前提条件

- Node.js 18 以上
- Git
- GitHub への認証（SSH鍵 or `gh auth login`）

### GitHub private repo から直接インストール

```bash
# 対象プロジェクトに移動
cd /path/to/your-project

# SSH認証の場合
npx github:hosty-inhouse/converge init

# HTTPS認証の場合
npx git+https://github.com/hosty-inhouse/converge.git init

# セットアップ確認
npx github:hosty-inhouse/converge check
```

Windows（PowerShell）でも macOS/Linux でも同じコマンドで動作します。

### アップデート

```bash
# スキルだけ更新、knowledges/（社内情報）は保護
npx github:hosty-inhouse/converge init --force --keep-knowledges
```

### ローカルから（開発時）

```bash
node /path/to/rd-cc/bin/converge init
node /path/to/rd-cc/bin/converge check
node /path/to/rd-cc/bin/converge init --force --keep-knowledges
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
  requirements/                  # ブリーフ出力先
```

## 使い方

### 初期設定（init 後に1回だけ）

`converge/knowledges/` の3ファイルを社内の実情報で埋める。サンプルが入っているので、それを書き換える。

| ファイル | 書くこと | 効果 |
|---------|---------|------|
| `security-policy.md` | セキュリティルール（外部クラウド禁止等） | 実現不可能な要件を早期に検出 |
| `existing-tools.md` | 社内で使えるツール一覧 | 既存ツールで代替可能な場合にKILL判定 |
| `constraints.md` | 技術スタック、デプロイ頻度、リソース上限 | MVPスコープを現実的にする |

空のままでも動作するが、精度が下がる。

### 単件モード（基本の使い方）

業務部門から「こういうツール作って」と言われたら、Claude Code で:

```
/converge
→ A) 単件モード を選択
→ 依頼内容をペーストまたは口述
→ 6つの収束質問に順番に答える（依頼者と一緒に）
→ 時給を入力（ROI計算用、デフォルト3,000円/時）
→ ブリーフが requirements/ に出力される
→ 内容を確認して完了
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

### バッチモード（まとめて登録）

「あれもこれも」と複数リクエストが溜まっているとき:

```
/converge
→ B) バッチモード を選択
→ タイトル + 一行説明をリストで入力（推奨上限 5件/回）
→ draft ブリーフが一括作成される
→ 「個別に深掘りしたいリクエストはありますか？」
  → ある場合: その場で単件モードの Q1 から開始
  → ない場合: 終了
```

バッチで作成した draft ブリーフは `priority_score: 0` / `verdict: PENDING` の状態。後から `/converge` を再実行して個別に深掘りする。

### レビューフェーズ（Q6完了後、自動実施）

単件モードでQ1-Q6が完了すると、ブリーフ出力前に3つのレビューが自動実行される:

**Step 1: 既存サービス・ツール調査**
WebSearchで既存のSaaS、無料ツール、OSSを検索。完全に代替可能ならKILL判定に変更。

**Step 2: 実装規模の最小化チェック**
以下の優先順で、最も軽量な実装手段を推奨する:

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

### スクリプト（一覧確認・報告）

```bash
# 全ブリーフの一覧表示（優先順位会議用）
node converge/scripts/list-briefs.js

# 出力例:
# Score Verdict  Status     Title                                    Date
# ----- -------- ---------- ---------------------------------------- ----------
# 5     BUILD    reviewed   請求書自動生成ツール                     2026-04-08
# 3     DEFER    deferred   在庫管理ダッシュボード                   2026-04-05
# 1     KILL     reviewed   社内Wiki検索ボット                       2026-04-01
#
# --- サマリー ---
# 合計: 3件 (BUILD: 1 / DEFER: 1 / KILL: 1 / Draft: 0)
```

```bash
# ROI 集計（マネジメント報告用）
node converge/scripts/roi-summary.js

# 出力例:
# === ROI サマリー ===
# 時給: 3000円（デフォルト）
#
# Title                                    現在(h)  予想(h)  削減(円/月) Verdict
# 請求書自動生成ツール                         15        3      36000 BUILD
# 在庫管理ダッシュボード                        8        3      15000 DEFER
#
# --- 合計 ---
# 月間削減時間: 17時間
# 月間削減コスト: 51000円
# 年間削減コスト: 612000円
```

```bash
# 個別のスコア確認
node converge/scripts/score.js requirements/2026-04-08-invoice-automation.md
```

### DEFER 案件の再評価

DEFER 判定のブリーフは `status: deferred` になる。次回 `/converge` 実行時に、3ヶ月以上前の DEFER 案件があれば自動通知される:

```
以下のDEFER案件が3ヶ月以上経過しています。再評価しますか？
- 在庫管理ダッシュボード (deferred: 2026-04-05)
```

再評価する場合、前回のブリーフを読み込み、Q1-Q6の差分のみ確認する。

## 収束シーケンス

6つの質問を順番に進める。明らかに回答済みの質問はスキップ可能。各質問に「わからない」への対応（フォールバック質問）が用意されている。

| # | 質問 | 目的 | 判明すること |
|---|------|------|-------------|
| Q1 | これがないと何が起きる？ | KILL候補の検出 | 本当に必要かどうか |
| Q2 | 今、誰が、どうやって回避している？ | ワークアラウンドの把握 | 現在の手順とコスト |
| Q3 | 誰が困っている？ | 影響範囲の特定 | 人数とソリューション規模 |
| Q4 | 月に何時間かかっている？ | ROI 定量化 | 削減効果（人数×時間） |
| Q5 | 3ヶ月何もしなかったら？ | 緊急度の判定 | BUILD/DEFERの分岐 |
| Q6 | 最小構成は何？ | スコープの収束 | MVP機能（最大3つ） |

### Q3 のソリューション規模判定

Q3 の回答から、作るべきものの規模を判定する:

| 影響人数 | ソリューション規模 | 例 |
|---------|-------------------|-----|
| 1人 | スクリプト / Claude Code Skill / CLI | 個人の定型作業を自動化 |
| 2-5人 | 共有スクリプト / 簡易Webツール | チーム内の共通作業を効率化 |
| 6人以上 or 複数部門 | Webシステム（認証・ユーザー管理・データ連携） | 部門横断の業務基盤 |

この判定がQ6（最小構成）でのアーキテクチャ・技術選定に直結する。

## Priority Score

| Score | Verdict | 条件 |
|-------|---------|------|
| 5 | BUILD | 月間20h+ / 苦痛なワークアラウンド / 3ヶ月で業務に支障 |
| 4 | BUILD | 月間10-19h / ワークアラウンドあり / MVP が明確 |
| 3 | DEFER | 月間5-9h / ワークアラウンドで当面回せる |
| 2 | DEFER | 月間5h未満 or 3ヶ月放置で影響なし |
| 1 | KILL | なくても困らない or 既存ツールで代替可能 |

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

## Raw Notes

（ヒアリング時のメモをここに記録）
```

## CLIコマンド

| コマンド | 説明 |
|---------|------|
| `converge init` | プロジェクトにスキル一式を配置 |
| `converge init --force` | 既存ファイルを上書きして再配置 |
| `converge check` | セットアップ状態を確認（knowledges/ がサンプルのままかも検出） |
| `converge help` | ヘルプを表示 |
