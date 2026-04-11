const fs = require('fs')
const path = require('path')

const STEP_LABELS = {
  q1: 'Q1: これがないと何が起きる？',
  q2: 'Q2: 今、誰が、どうやって回避している？',
  q3: 'Q3: 誰が困っている？',
  q4: 'Q4: 月に何時間かかっている？',
  q5: 'Q5: 3ヶ月何もしなかったら？',
  q6: 'Q6: 最小構成は何？',
}

const STEP_ORDER = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']

function slugify(text) {
  return text
    .replace(/[\s　]+/g, '-')
    .replace(/[\/\\:*?"<>|#%&{}@!`^~]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-$/, '')
}

function buildVerbatimRawNotes(conversation) {
  const lines = [
    '## Raw Notes',
    '',
    'ヒアリング中のユーザー回答（逐語）。同一質問に対するフォローアップ回答は複数記録。',
    '',
  ]

  const answersByStep = {}
  if (Array.isArray(conversation)) {
    for (const entry of conversation) {
      if (!entry || typeof entry.userAnswer !== 'string') continue
      const answer = entry.userAnswer.trim()
      if (!answer || answer === '(auto)') continue
      if (!STEP_LABELS[entry.step]) continue
      if (!answersByStep[entry.step]) answersByStep[entry.step] = []
      answersByStep[entry.step].push(answer)
    }
  }

  for (const step of STEP_ORDER) {
    lines.push(`### ${STEP_LABELS[step]}`)
    const answers = answersByStep[step]
    if (!answers || answers.length === 0) {
      lines.push('- (未回答)')
    } else {
      for (const answer of answers) {
        const escaped = answer.replace(/\r\n/g, '\n').replace(/\n/g, '\n  ')
        lines.push(`- ${escaped}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n').replace(/\n+$/, '\n')
}

function replaceRawNotes(briefContent, verbatim) {
  const match = briefContent.match(/\n?## Raw Notes\b/)
  if (match) {
    const head = briefContent.slice(0, match.index).replace(/\s*$/, '')
    return `${head}\n\n${verbatim}`
  }
  return `${briefContent.replace(/\s*$/, '')}\n\n${verbatim}`
}

function saveBrief(briefContent, meta, projectRoot, conversation) {
  const reqDir = path.join(projectRoot, 'requirements')
  if (!fs.existsSync(reqDir)) {
    fs.mkdirSync(reqDir, { recursive: true })
  }

  const verbatim = buildVerbatimRawNotes(conversation)
  const finalContent = replaceRawNotes(briefContent, verbatim)

  const today = new Date().toISOString().slice(0, 10)
  const slug = slugify(meta.title)
  const filename = `${today}-${slug}.md`
  const filePath = path.join(reqDir, filename)

  if (fs.existsSync(filePath)) {
    const base = `${today}-${slug}`
    let counter = 2
    let newPath = path.join(reqDir, `${base}-${counter}.md`)
    while (fs.existsSync(newPath)) {
      counter++
      newPath = path.join(reqDir, `${base}-${counter}.md`)
    }
    fs.writeFileSync(newPath, finalContent, 'utf-8')
    return path.relative(projectRoot, newPath)
  }

  fs.writeFileSync(filePath, finalContent, 'utf-8')
  return path.relative(projectRoot, filePath)
}

module.exports = { saveBrief, slugify, buildVerbatimRawNotes, replaceRawNotes }
