#!/usr/bin/env node
// score.js — Priority Score 計算
// 使い方: node converge/scripts/score.js requirements/2026-04-08-example.md

const fs = require('fs')

const file = process.argv[2]

if (!file) {
  console.error('使い方: node converge/scripts/score.js <requirement-file>')
  process.exit(1)
}

if (!fs.existsSync(file)) {
  console.error(`エラー: ファイルが見つかりません: ${file}`)
  process.exit(1)
}

const content = fs.readFileSync(file, 'utf-8')

function extractField(field) {
  const match = content.match(new RegExp(`^${field}:\\s*(.+)`, 'm'))
  return match ? match[1].trim() : null
}

const title = extractField('title')
const hours = extractField('monthly_hours_current')
const verdict = extractField('verdict')
const score = extractField('priority_score')

console.log('=== Priority Score ===')
console.log(`Title:   ${title || '?'}`)
console.log(`Hours:   ${hours || 'unknown'}/月`)
console.log(`Score:   ${score || '未評価'}`)
console.log(`Verdict: ${verdict || '未判定'}`)
console.log('')
console.log('--- ルブリック ---')
console.log('5 (BUILD): 月間20h+ / 苦痛なワークアラウンド / 3ヶ月で業務に支障')
console.log('4 (BUILD): 月間10-19h / ワークアラウンドあり / MVPが明確')
console.log('3 (DEFER): 月間5-9h / ワークアラウンドで回せる')
console.log('2 (DEFER): 月間5h未満 or 3ヶ月放置で影響なし')
console.log('1 (KILL):  なくても困らない or 既存ツールで代替可能')
