# graphql-content-mapper

Proof of concept: a [TypeScript 7.1 content mapper](https://github.com/microsoft/typescript-go/pull/4712) that makes
a GraphQL schema file a first-class TypeScript module. It works with gql.tada on TypeScript 7 without the
TypeScript plugin, without `gql.tada generate-output`, and without a generated `graphql-env.d.ts`.

TypeScript 7 has no tsserver plugin API, so GraphQLSP can't run
([GraphQLSP#421](https://github.com/0no-co/GraphQLSP/issues/421)), and the gql.tada CLI crashes on TS 7's missing JS
API ([gql.tada#572](https://github.com/0no-co/gql.tada/issues/572)). gql.tada's type inference still works on TS 7;
what broke is getting the schema's introspection type into the program. A content mapper does that inside the
compiler.

## How it works

```jsonc
// tsconfig.json
{
  "contentMappers": [
    {
      "package": "graphql-content-mapper",
      "extensions": [".graphql"],
      "options": { "scalars": { "DateTime": "string" } }
    }
  ],
  "include": ["src"] // picks up src/schema.graphql
}
```

When `schema.graphql` enters the program, TypeScript spawns the mapper and sends it the SDL. The mapper parses and
validates it with graphql-js, and returns TypeScript containing:

1. gql.tada's `introspection` type and the `declare module 'gql.tada' { interface setupSchema … }` augmentation,
   built with `@gql.tada/internal`, so `graphql()` imported from `'gql.tada'` is typed with no further setup.
2. A plain TypeScript type for every named type in the schema (`User`, `Role`, `CreatePostInput`,
   `SearchResult`, `Scalars`), with descriptions as JSDoc:

   ```ts
   import type { User, Role } from './schema.graphql'
   ```

3. A span map that ties every type, field and enum-value name back to its spot in the SDL.
4. SDL syntax and validation errors, reported in the `.graphql` file:

   ```
   src/schema.graphql(7,11): error graphql2: Unknown type "Image".
   ```

The schema file is the mapper's only input, so TypeScript's own file watching re-runs it when the schema changes.

## Try it

```sh
pnpm install
pnpm test          # tsgo + tsrs CLI checks, and a span-map check through the TS 7.1 JS API
pnpm check:tsgo    # tsc -p . --runExternalCode in example/ and fixtures/
pnpm check:tsrs    # the same with tsrs, the Rust port of TS 7
```

- [example/src/queries.ts](example/src/queries.ts): gql.tada queries plus type-level assertions on the inferred
  results and the plain schema types.
- `fixtures/broken`, `fixtures/syntax`: invalid schemas.

## Verified

| | tsgo (`typescript@7.1.0-beta`) | tsrs `0.18.0-ts7.1.0-dev.20260929` |
| --- | --- | --- |
| gql.tada `ResultOf` / `VariablesOf` inferred from the mapped schema | yes | yes |
| Plain schema types importable from `./schema.graphql` | yes | yes |
| SDL syntax and validation errors at the right line and column | yes | yes |
| Span map consumed (via `typescript/sync` API) | yes | n/a (no JS API) |
| Editor: hover / go-to-definition into the SDL | not tried yet | tsrs LSP doesn't support mappers yet |

## Gaps

- **Documents aren't validated.** A misspelled field (`me { nmae }`) type-checks and comes back as `unknown`.
  GraphQLSP used to report it. Options:
  - run the GraphQL VS Code extension (graphql-config) for in-string diagnostics and completion;
  - a language server on the TS 7.1 API;
  - a mapper-side precompiled `Documents` map, so invalid documents fail at the `graphql()` call (see Next).
- **Scalars are configured twice.** The mapper's `scalars` option types the plain types; gql.tada still takes its
  `scalars` via `initGraphQLTada`.
- **Opt-in required.** `tsc` needs `--runExternalCode`, and VS Code only runs mappers in trusted workspaces.
- **TypeScript dependency.** `@gql.tada/internal` `require`s `typescript` at load time. That works with 7.1, but it's
  only used for config loading, so the mapper could drop it.

## Next

- Editor check in VS Code with TypeScript 7.1 (hover on `User` → SDL, go-to-definition, schema edits re-checking
  queries).
- A precompiled document map. With `dynamicConfig` + `watchedFiles`, the mapper scans `graphql()` calls, validates
  them with graphql-js, and emits `interface Documents { "<source>": TypedDocumentNode<…> }`. Lookups replace
  type-level parsing, and invalid documents become errors at the call site.
- Benchmark type-level gql.tada vs precompiled lookups on a large schema, under tsgo and tsrs.
