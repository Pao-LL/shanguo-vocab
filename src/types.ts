export type Sense = { pos: string; cn: string }
export type Sentence = { c: string; cn: string }
export type Phrase = { c: string; cn: string }
export type Syno = { pos: string; cn: string; ws: string[] }
export type RelWord = { pos: string; words: { c: string; cn: string }[] }
export type Etymon = { t: string; d: string }

export type Word = {
  id: number
  word: string
  phonetic0: string
  phonetic1: string
  trans: Sense[]
  sentences: Sentence[]
  phrases: Phrase[]
  synos: Syno[]
  relWords: { root: string; rels: RelWord[] }
  etymology: Etymon[]
}

export type PageSize = 5 | 10 | 20

export type Book = {
  id: string
  name: string
  createdAt: number
  order: number[]
  cursor: number
  pageSize: PageSize
}

export type AppState = {
  books: Book[]
  favorites: string[]
  favCursor: number
  favPageSize: PageSize
}

declare global {
  interface Window {
    vocabStore?: {
      loadState: () => Promise<AppState>
      saveState: (state: AppState) => Promise<AppState>
      loadDict: () => Promise<Word[]>
    }
  }
}