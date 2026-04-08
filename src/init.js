const fs = require('fs')
const path = require('path')

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates')

function getProjectRoot() {
  return process.cwd()
}

function getAllTemplateFiles(dir, base = '') {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const relativePath = path.join(base, entry.name)
    if (entry.isDirectory()) {
      results.push(...getAllTemplateFiles(path.join(dir, entry.name), relativePath))
    } else {
      results.push(relativePath)
    }
  }

  return results
}

async function init(options = {}) {
  const projectRoot = getProjectRoot()
  console.log('\n  @hosty-jp/converge init')
  console.log(`  Project: ${projectRoot}\n`)

  const templateFiles = getAllTemplateFiles(TEMPLATES_DIR)
  const copied = []
  const skipped = []

  for (const relPath of templateFiles) {
    const srcPath = path.join(TEMPLATES_DIR, relPath)

    // commands/converge.md → .claude/commands/converge.md
    // それ以外 → converge/ 配下
    let destRelPath
    if (relPath.startsWith('commands' + path.sep)) {
      destRelPath = path.join('.claude', relPath)
    } else {
      destRelPath = path.join('converge', relPath)
    }

    const destPath = path.join(projectRoot, destRelPath)

    if (fs.existsSync(destPath) && !options.force) {
      skipped.push(destRelPath)
      continue
    }

    // --force でも knowledges/ は保護（--keep-knowledges）
    if (options.keepKnowledges && destRelPath.includes(path.join('converge', 'knowledges'))) {
      if (fs.existsSync(destPath)) {
        skipped.push(destRelPath + ' (knowledges 保護)')
        continue
      }
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.copyFileSync(srcPath, destPath)
    copied.push(destRelPath)
  }

  // requirements/ ディレクトリを作成
  const reqDir = path.join(projectRoot, 'requirements')
  if (!fs.existsSync(reqDir)) {
    fs.mkdirSync(reqDir, { recursive: true })
    const gitkeep = path.join(reqDir, '.gitkeep')
    fs.writeFileSync(gitkeep, '')
    copied.push('requirements/.gitkeep')
  }

  if (copied.length > 0) {
    console.log('  配置したファイル:')
    for (const f of copied) {
      console.log(`    + ${f}`)
    }
  }

  if (skipped.length > 0) {
    console.log('\n  スキップ (既存ファイル、--force で上書き):')
    for (const f of skipped) {
      console.log(`    - ${f}`)
    }
  }

  console.log('\n  セットアップ完了!')
  console.log('\n  次のステップ:')
  console.log('    1. converge/knowledges/ の中身を社内情報で埋める')
  console.log('    2. Claude Code で /converge を実行')
  console.log('')
}

module.exports = { init }
