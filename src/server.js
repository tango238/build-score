const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function checkClaude() {
  try {
    execSync('claude --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function startServer(port) {
  if (!checkClaude()) {
    console.error('エラー: claude CLI が見つかりません。インストールしてください。')
    process.exit(1)
  }

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const htmlPath = path.join(__dirname, '..', 'templates', 'web', 'index.html')
      const html = fs.readFileSync(htmlPath, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    if (req.method === 'POST' && req.url === '/api/step') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        try {
          const data = JSON.parse(body)
          data.projectRoot = process.cwd()
          const { handleStep } = require('./conversation.js')
          const result = await handleStep(data)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(result))
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: error.message }))
        }
      })
      return
    }

    res.writeHead(404)
    res.end('Not Found')
  })

  server.listen(port, () => {
    console.log('')
    console.log('  converge-web — ブラウザ版ヒアリングUI')
    console.log('')
    console.log(`  http://localhost:${port}`)
    console.log('')
    console.log('  Ctrl+C で終了')
    console.log('')
  })
}

module.exports = { startServer }
