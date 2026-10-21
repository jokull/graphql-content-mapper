// Runs tsgo (`tsc` from typescript@7.1) and tsrs over the example and the broken fixtures.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '..')
const checkers = {
  tsgo: resolve(root, 'node_modules/.bin/tsc'),
  tsrs: resolve(root, 'node_modules/.bin/tsrs'),
}

function check(bin, dir) {
  const result = spawnSync(bin, ['-p', '.', '--runExternalCode', '--pretty', 'false'], { cwd: resolve(root, dir), encoding: 'utf8' })
  return { status: result.status, output: (result.stdout + result.stderr).trim() }
}

for (const [name, bin] of Object.entries(checkers)) {
  test(`${name}: example type-checks, with gql.tada inferring from schema.graphql`, () => {
    assert.deepEqual(check(bin, 'example'), { status: 0, output: '' })
  })

  test(`${name}: SDL validation errors are reported in schema.graphql`, () => {
    const { status, output } = check(bin, 'fixtures/broken')
    assert.equal(status, 2)
    assert.equal(output, 'src/schema.graphql(7,11): error graphql2: Unknown type "Image".')
  })

  test(`${name}: SDL syntax errors are reported in schema.graphql`, () => {
    const { status, output } = check(bin, 'fixtures/syntax')
    assert.equal(status, 2)
    assert.equal(output, 'src/schema.graphql(4,6): error graphql1: Syntax Error: Expected ":", found Name "User".')
  })
}
