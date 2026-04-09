const fs = require('fs')
const path = require('path')

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/-$/, '')
}

function saveBrief(briefContent, meta, projectRoot) {
  const reqDir = path.join(projectRoot, 'requirements')
  if (!fs.existsSync(reqDir)) {
    fs.mkdirSync(reqDir, { recursive: true })
  }

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
    fs.writeFileSync(newPath, briefContent, 'utf-8')
    return path.relative(projectRoot, newPath)
  }

  fs.writeFileSync(filePath, briefContent, 'utf-8')
  return path.relative(projectRoot, filePath)
}

module.exports = { saveBrief, slugify }
