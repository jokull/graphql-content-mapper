// Loads example/ through TypeScript 7.1's JS API (which runs the content mapper) and checks that every name the
// mapper maps back to the SDL resolves, through TypeScript's own span map, to the same text in schema.graphql.
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { API } from 'typescript/sync'

const project = resolve(import.meta.dirname, '../example/tsconfig.json')
const schemaFile = resolve(import.meta.dirname, '../example/src/schema.graphql')

test('TypeScript maps virtual type and field names back to schema.graphql', () => {
  const api = new API({ cwd: resolve(import.meta.dirname, '../example'), runExternalCode: true })
  try {
    const snapshot = api.createSnapshot({ openProjects: [project] })
    const program = snapshot.getProgram(snapshot.getConfiguredProject(project).id)
    const file = program.getSourceFile(schemaFile)
    assert.ok(file, 'schema.graphql is in the program')
    assert.ok(file.spanMap, 'schema.graphql has a span map')
    assert.match(file.text, /export interface User extends Node \{/)

    const virtualUser = file.text.indexOf('export interface User') + 'export interface '.length
    const mapped = file.spanMap.virtualToOriginalPosition(virtualUser)
    assert.equal(file.originalText.slice(mapped.position, mapped.position + 4), 'User')
    assert.equal(file.originalText.lastIndexOf('type ', mapped.position), mapped.position - 'type '.length)

    for (const segment of file.spanMap.segments) {
      assert.equal(
        file.text.slice(segment.virtualStart, segment.virtualEnd),
        file.originalText.slice(segment.originalStart, segment.originalEnd),
      )
    }
    assert.ok(file.spanMap.segments.length > 20, `expected many mapped names, got ${file.spanMap.segments.length}`)
  } finally {
    api.close?.()
  }
})
