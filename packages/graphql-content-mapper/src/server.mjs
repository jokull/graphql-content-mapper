#!/usr/bin/env node
// TypeScript 7.1 content mapper for GraphQL schemas: JSON-RPC 2.0 over stdio with Content-Length framing.
// Protocol: https://github.com/microsoft/typescript-go/pull/4712
import process from 'node:process'
import { transformSchema } from './transform.mjs'

const projects = new Map()

function send(message) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }))
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`)
  process.stdout.write(body)
}

const methods = {
  initialize(params) {
    // JS string indices are UTF-16 code units, so prefer that and avoid converting offsets.
    const positionEncoding = params.positionEncodings.includes('utf-16') ? 'utf-16' : params.positionEncodings[0]
    return { positionEncoding, diagnosticSource: 'graphql' }
  },
  openProject(params) {
    projects.set(params.projectHandle, { options: params.options ?? {} })
    return {}
  },
  closeProject(params) {
    projects.delete(params.projectHandle)
    return null
  },
  transform(params) {
    const project = projects.get(params.projectHandle) ?? { options: {} }
    return transformSchema(params.content, project.options, params.fileName)
  },
}

function handle(request) {
  if (request.id === undefined) return
  const method = methods[request.method]
  if (!method) {
    send({ id: request.id, error: { code: -32601, message: `Unknown method: ${request.method}` } })
    return
  }
  try {
    send({ id: request.id, result: method(request.params) })
  } catch (error) {
    process.stderr.write(`${error.stack ?? error}\n`)
    send({ id: request.id, error: { code: -32603, message: String(error.message ?? error) } })
  }
}

let pending = Buffer.alloc(0)
process.stdin.on('data', (chunk) => {
  pending = Buffer.concat([pending, chunk])
  for (;;) {
    const headerEnd = pending.indexOf('\r\n\r\n')
    if (headerEnd === -1) return
    const match = /Content-Length:\s*(\d+)/i.exec(pending.subarray(0, headerEnd).toString())
    if (!match) throw new Error('missing Content-Length header')
    const start = headerEnd + 4
    const length = Number(match[1])
    if (pending.length < start + length) return
    const body = pending.subarray(start, start + length).toString()
    pending = pending.subarray(start + length)
    handle(JSON.parse(body))
  }
})
process.stdin.on('end', () => process.exit(0))
