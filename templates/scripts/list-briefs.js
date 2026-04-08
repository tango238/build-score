#!/usr/bin/env node
// list-briefs.js — ブリーフサマリー一覧
// 使い方: node converge/scripts/list-briefs.js [requirements-dir]

const fs = require('fs')
const path = require('path')

const dir = process.argv[2] || 'requirements'

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

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== '.gitkeep')

// ヘッダー
console.log(`${pad('Score', 5)} ${pad('Verdict', 8)} ${pad('Status', 10)} ${pad('Title', 40)} Date`)
console.log(`${pad('-----', 5)} ${pad('--------', 8)} ${pad('----------', 10)} ${pad('----------------------------------------', 40)} ----------`)

const briefs = []
const counts = { build: 0, defer: 0, kill: 0, draft: 0 }

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8')
  const title = extractField(content, 'title')
  const score = extractField(content, 'priority_score')
  const verdict = extractField(content, 'verdict')
  const status = extractField(content, 'status')
  const date = extractField(content, 'date')

  briefs.push({ score: Number(score) || 0, title, verdict, status, date })

  if (verdict === 'BUILD') counts.build++
  if (verdict === 'DEFER') counts.defer++
  if (verdict === 'KILL') counts.kill++
  if (status === 'draft') counts.draft++
}

briefs
  .sort((a, b) => b.score - a.score)
  .forEach((b) => {
    console.log(
      `${pad(b.score, 5)} ${pad(b.verdict, 8)} ${pad(b.status, 10)} ${pad(b.title, 40)} ${b.date || '?'}`
    )
  })

console.log('')
console.log('--- サマリー ---')
console.log(
  `合計: ${files.length}件 (BUILD: ${counts.build} / DEFER: ${counts.defer} / KILL: ${counts.kill} / Draft: ${counts.draft})`
)
