const fs = require('fs')
const path = require('path')

async function check() {
  const projectRoot = process.cwd()
  console.log('\n  @hosty-jp/converge check')
  console.log(`  Project: ${projectRoot}\n`)

  const checks = [
    {
      name: 'converge/SKILL.md',
      path: path.join(projectRoot, 'converge', 'SKILL.md'),
      required: true,
    },
    {
      name: 'converge/templates/requirement.md',
      path: path.join(projectRoot, 'converge', 'templates', 'requirement.md'),
      required: true,
    },
    {
      name: 'converge/scripts/score.js',
      path: path.join(projectRoot, 'converge', 'scripts', 'score.js'),
      required: true,
    },
    {
      name: 'converge/scripts/list-briefs.js',
      path: path.join(projectRoot, 'converge', 'scripts', 'list-briefs.js'),
      required: true,
    },
    {
      name: 'converge/scripts/roi-summary.js',
      path: path.join(projectRoot, 'converge', 'scripts', 'roi-summary.js'),
      required: true,
    },
    {
      name: 'converge/knowledges/security-policy.md',
      path: path.join(projectRoot, 'converge', 'knowledges', 'security-policy.md'),
      required: false,
    },
    {
      name: 'converge/knowledges/existing-tools.md',
      path: path.join(projectRoot, 'converge', 'knowledges', 'existing-tools.md'),
      required: false,
    },
    {
      name: 'converge/knowledges/constraints.md',
      path: path.join(projectRoot, 'converge', 'knowledges', 'constraints.md'),
      required: false,
    },
    {
      name: '.claude/commands/converge.md',
      path: path.join(projectRoot, '.claude', 'commands', 'converge.md'),
      required: true,
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
      console.log(`  x ${c.name} (見つかりません — npx @hosty-jp/converge init を実行)`)
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
