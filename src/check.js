const fs = require('fs')
const path = require('path')

async function check() {
  const projectRoot = process.cwd()
  console.log('\n  build-score check')
  console.log(`  Project: ${projectRoot}\n`)

  const checks = [
    {
      name: 'build-score/SKILL.md',
      path: path.join(projectRoot, 'build-score', 'SKILL.md'),
      required: true,
    },
    {
      name: 'build-score/templates/requirement.md',
      path: path.join(projectRoot, 'build-score', 'templates', 'requirement.md'),
      required: true,
    },
    {
      name: 'build-score/scripts/score.js',
      path: path.join(projectRoot, 'build-score', 'scripts', 'score.js'),
      required: true,
    },
    {
      name: 'build-score/scripts/list-briefs.js',
      path: path.join(projectRoot, 'build-score', 'scripts', 'list-briefs.js'),
      required: true,
    },
    {
      name: 'build-score/scripts/roi-summary.js',
      path: path.join(projectRoot, 'build-score', 'scripts', 'roi-summary.js'),
      required: true,
    },
    {
      name: 'build-score/knowledges/security-policy.md',
      path: path.join(projectRoot, 'build-score', 'knowledges', 'security-policy.md'),
      required: false,
    },
    {
      name: 'build-score/knowledges/existing-tools.md',
      path: path.join(projectRoot, 'build-score', 'knowledges', 'existing-tools.md'),
      required: false,
    },
    {
      name: 'build-score/knowledges/constraints.md',
      path: path.join(projectRoot, 'build-score', 'knowledges', 'constraints.md'),
      required: false,
    },
    {
      name: '.claude/commands/build-score.md',
      path: path.join(projectRoot, '.claude', 'commands', 'build-score.md'),
      required: true,
    },
    {
      name: '.claude/commands/build-score-web.md',
      path: path.join(projectRoot, '.claude', 'commands', 'build-score-web.md'),
      required: false,
    },
    {
      name: 'requirements/',
      path: path.join(projectRoot, 'requirements'),
      required: true,
      isDir: true,
    },
  ]

  let allOk = true

  for (const c of checks) {
    const exists = c.isDir
      ? fs.existsSync(c.path) && fs.statSync(c.path).isDirectory()
      : fs.existsSync(c.path)

    if (exists) {
      // knowledges/ のファイルはサンプルのままか確認
      if (c.path.includes('knowledges') && exists) {
        const content = fs.readFileSync(c.path, 'utf-8')
        if (content.includes('記述例') || content.includes('記述してください')) {
          console.log(`  ! ${c.name} (サンプルのまま — 社内情報で更新してください)`)
        } else {
          console.log(`  + ${c.name}`)
        }
      } else {
        console.log(`  + ${c.name}`)
      }
    } else if (c.required) {
      console.log(`  x ${c.name} (見つかりません — npx build-score init を実行)`)
      allOk = false
    } else {
      console.log(`  - ${c.name} (オプション)`)
    }
  }

  // requirements/ 内のブリーフ数
  const reqDir = path.join(projectRoot, 'requirements')
  if (fs.existsSync(reqDir)) {
    const briefs = fs.readdirSync(reqDir).filter((f) => f.endsWith('.md'))
    console.log(`\n  ブリーフ数: ${briefs.length}件`)
  }

  console.log(allOk ? '\n  ステータス: OK\n' : '\n  ステータス: 要セットアップ\n')
}

module.exports = { check }
