#!/usr/bin/env node
// roi-summary.js — ROI自動集計
// 使い方: node build-score/scripts/roi-summary.js [requirements-dir] [hourly-rate]

const fs = require('fs')
const path = require('path')

const dir = process.argv[2] || 'requirements'
const defaultRate = Number(process.argv[3]) || 3000

if (!fs.existsSync(dir)) {
  console.error(`エラー: ディレクトリが見つかりません: ${dir}`)
  process.exit(1)
}

function extractField(content, field) {
  const match = content.match(new RegExp(`^${field}:\\s*(.+)`, 'm'))
  return match ? match[1].trim() : null
}

function pad(str, len) {
  const s = String(str || '?')
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length)
}

function padNum(str, len) {
  const s = String(str)
  return s.length >= len ? s : ' '.repeat(len - s.length) + s
}

console.log('=== ROI サマリー ===')
console.log(`時給: ${defaultRate}円（デフォルト）`)
console.log('')

console.log(`${pad('Title', 40)} ${padNum('現在(h)', 8)} ${padNum('予想(h)', 8)} ${padNum('削減(円/月)', 10)} Verdict`)
console.log(`${pad('----------------------------------------', 40)} ${padNum('--------', 8)} ${padNum('--------', 8)} ${padNum('----------', 10)} --------`)

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== '.gitkeep')

let totalHoursSaved = 0
let totalMonthlyCost = 0

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8')
  const title = extractField(content, 'title')
  const current = extractField(content, 'monthly_hours_current')
  const projected = extractField(content, 'monthly_hours_projected')
  const verdict = extractField(content, 'verdict')

  if (!current || current === 'unknown' || !projected) {
    console.log(`${pad(title, 40)} ${padNum(current || '?', 8)} ${padNum(projected || '?', 8)} ${padNum('---', 10)} ${verdict || '?'}`)
    continue
  }

  const saved = Number(current) - Number(projected)
  const monthlyCost = Math.round(saved * defaultRate)
  totalHoursSaved += saved
  totalMonthlyCost += monthlyCost

  console.log(`${pad(title, 40)} ${padNum(current, 8)} ${padNum(projected, 8)} ${padNum(monthlyCost, 10)} ${verdict || '?'}`)
}

const annualCost = totalMonthlyCost * 12

console.log('')
console.log('--- 合計 ---')
console.log(`月間削減時間: ${totalHoursSaved}時間`)
console.log(`月間削減コスト: ${totalMonthlyCost}円`)
console.log(`年間削減コスト: ${annualCost}円`)
