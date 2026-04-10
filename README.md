# Build Score

「それ、本当に作る必要ある？」を判断するための Claude Code スキル。

社内から届く漠然とした開発リクエストを、6つの質問で整理して **BUILD（作る）/ DEFER（後回し）/ KILL（作らない）** の判定付きブリーフに変換します。

## こんなとき使う

```
経理「請求書の作成を自動化したいんですけど...」
  ↓
エンジニアが Claude Code で /build-score を起動
  ↓
依頼者と一緒に6つの質問に回答（15〜30分）
  ↓
判定付きブリーフが自動生成 → BUILD (score: 4) なら開発GO
```

## インストール

```bash
git clone https://github.com/tango238/build-score.git ~/.claude/skills/build-score
```

Claude Code で `/build-score` が使えるようになります。

## 使い方

### CLI（エンジニア向け）

Claude Code で `/build-score` と入力して開始。

- **単件モード** — 1件ずつヒアリング
- **バッチモード** — 複数リクエストをまとめて登録

### Web UI（非エンジニア向け）

```bash
node ~/.claude/skills/build-score/bin/build-score-web
```

`http://localhost:3456` を開き、ブラウザ上でヒアリングに回答してもらえます。

## 6つの質問

| # | 質問 | わかること |
|---|------|-----------|
| Q1 | これがないと何が起きる？ | 本当に必要か |
| Q2 | 今どうやって回避してる？ | 現状のコストと手順 |
| Q3 | 誰が困ってる？ | 影響範囲 |
| Q4 | 月に何時間かかってる？ | ROI（費用対効果） |
| Q5 | 3ヶ月放置したら？ | 緊急度 |
| Q6 | 最小構成は？ | MVP スコープ |

## スコアと判定

| Score | 判定 | 目安 |
|-------|------|------|
| 5 | BUILD | 月20h超の削減、苦痛なワークアラウンド |
| 4 | BUILD | 月10〜19hの削減、MVPが明確 |
| 3 | DEFER | 月5〜9h、今のやり方でしばらく回せる |
| 2 | DEFER | 月5h未満、放置しても影響なし |
| 1 | KILL | なくても困らない、既存ツールで代替可 |

## プロジェクトへの配置（オプション）

チームで共有する場合、プロジェクトのリポジトリにスキル一式を配置できます。

```bash
cd /path/to/your-project
node ~/.claude/skills/build-score/bin/build-score init
```

## カスタマイズ

### knowledges/ — 社内情報を教える

`build-score/knowledges/` に社内の情報を記述すると、判定精度が上がります。空のままでも動作します。

| ファイル | 書くこと | 効果 |
|---------|---------|------|
| `security-policy.md` | セキュリティルール | 実現不可能な要件を早期に検出 |
| `existing-tools.md` | 利用中のツール一覧 | 既存ツールで代替可能な案件を KILL 判定 |
| `constraints.md` | 技術スタック、リソース上限 | MVP スコープを現実的にする |

### rules/ — 判定基準を調整する

`build-score/rules/` でスコアリングや見積りの基準を変更できます。デフォルトのまま使うこともできます。

| ファイル | 内容 |
|---------|------|
| `priority-score.md` | BUILD/DEFER/KILL の判定閾値 |
| `solution-scale.md` | 実装手段の優先順位（設定変更 → スクリプト → Web システム） |
| `effort-estimate.md` | 工数レベル（1〜5）の定義 |

## License

MIT
