// gql.tada with no ts-plugin, no `gql.tada generate-output` and no graphql-env.d.ts: the content mapper turns
// schema.graphql into the introspection type and the `setupSchema` augmentation that `graphql()` reads.
import { graphql, type ResultOf, type VariablesOf } from 'gql.tada'
import type { CreatePostInput, Role, User } from './schema.graphql'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

export const MeQuery = graphql(`
  query Me {
    me {
      id
      name
      role
      posts(first: 3) { title tags }
    }
  }
`)

type Me = NonNullable<ResultOf<typeof MeQuery>['me']>
export type MeTests = [
  Expect<Equal<Me['id'], string>>,
  Expect<Equal<Me['name'], string | null>>,
  Expect<Equal<Me['role'], 'ADMIN' | 'EDITOR' | 'VIEWER'>>,
  Expect<Equal<Me['posts'], { title: string; tags: (string | null)[] | null }[]>>,
]

export const SearchQuery = graphql(`
  query Search($term: String!) {
    search(term: $term) {
      __typename
      ... on User { email }
      ... on Post { title }
    }
  }
`)

export type SearchTests = [
  Expect<Equal<VariablesOf<typeof SearchQuery>, { term: string }>>,
  Expect<Equal<ResultOf<typeof SearchQuery>['search'][number], { __typename: 'User'; email: string } | { __typename: 'Post'; title: string }>>,
]

// The plain schema types come from the same file.
export type PlainTests = [
  Expect<Equal<Role, 'ADMIN' | 'EDITOR' | 'VIEWER'>>,
  Expect<Equal<User['createdAt'], string>>,
  Expect<Equal<User['email'], string>>,
  Expect<Equal<CreatePostInput['tags'], Array<string> | null | undefined>>,
]

export function greet(user: Pick<User, 'name' | 'role'>): string {
  return `${user.name ?? 'anonymous'} (${user.role.toLowerCase()})`
}
