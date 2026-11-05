import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Layers, Pencil, Plus, Star, Trash2, Volume2 } from "lucide-react"
import type { AppState, Book, PageSize, Word } from "./types"
import { playPronunciation } from "./audio"
import { highlightPhrase } from "./highlight"

const LS_KEY = "shanguo-vocab-state-v2"
const PAGE_SIZES: PageSize[] = [5, 10, 20]
const FAV_ID = "__fav"

type Mode = "library" | "book" | "card"

const emptyState = (): AppState => ({ books: [], favorites: [], favCursor: 0, favPageSize: 10 })

function shuffleIndices(n: number) {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function loadState(): Promise<AppState> {
  if (window.vocabStore?.loadState) return window.vocabStore.loadState()
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) {
      const legacy = localStorage.getItem("shanguo-vocab-books-v1")
      if (legacy) return { ...emptyState(), books: JSON.parse(legacy) }
      return emptyState()
    }
    const data = JSON.parse(raw)
    return {
      books: data.books || [],
      favorites: data.favorites || [],
      favCursor: data.favCursor || 0,
      favPageSize: data.favPageSize || 10,
    }
  } catch {
    return emptyState()
  }
}

async function saveState(state: AppState) {
  if (window.vocabStore?.saveState) return window.vocabStore.saveState(state)
  localStorage.setItem(LS_KEY, JSON.stringify(state))
  return state
}

function SenseList({ word, large }: { word: Word; large?: boolean }) {
  return (
    <ul className={large ? "space-y-3" : "space-y-1.5"}>
      {word.trans.map((t, i) => (
        <li key={i} className={large ? "text-[18px] leading-8" : "text-[15px] leading-7"}>
          {t.pos ? <span className="text-mute mr-2">{t.pos}</span> : null}
          <span>{t.cn}</span>
        </li>
      ))}
    </ul>
  )
}

function Speak({ word }: { word: string }) {
  return (
    <span className="inline-flex items-center">
      <button type="button" className="icon-btn" aria-label="英音" onClick={(e) => { e.stopPropagation(); playPronunciation(word, "uk") }}>
        <Volume2 size={16} />
        <span className="text-xs text-mute pr-1">英</span>
      </button>
      <button type="button" className="icon-btn" aria-label="美音" onClick={(e) => { e.stopPropagation(); playPronunciation(word, "us") }}>
        <Volume2 size={16} />
        <span className="text-xs text-mute pr-1">美</span>
      </button>
    </span>
  )
}

function StarBtn({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={on ? "取消收藏" : "收藏"}
      aria-pressed={on}
      className={`icon-btn ${on ? "star-on" : "text-mute"}`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Star size={18} fill={on ? "#2DD4BF" : "none"} />
    </button>
  )
}

function Pager({
  label,
  disablePrev,
  disableNext,
  onPrev,
  onNext,
}: {
  label: string
  disablePrev: boolean
  disableNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <button type="button" className="ghost-btn" onClick={onPrev} disabled={disablePrev}>
        <ChevronLeft size={18} />
        上一页
      </button>
      <div className="text-sm text-mute">{label}</div>
      <button type="button" className="ghost-btn" onClick={onNext} disabled={disableNext}>
        下一页
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

export default function App() {
  const [words, setWords] = useState<Word[] | null>(null)
  const [state, setState] = useState<AppState>(emptyState)
  const [openId, setOpenId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("library")
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState("")

  const persist = useCallback(async (next: AppState) => {
    setState(next)
    await saveState(next)
  }, [])

  useEffect(() => {
    const loadWords = async () => {
      if (window.vocabStore?.loadDict) {
        setWords(await window.vocabStore.loadDict())
        return
      }
      const r = await fetch("./dicts/kaoyanshanguo2025.json")
      setWords(await r.json())
    }
    loadWords().catch(() => setWords([]))
    loadState().then(setState)
  }, [])

  const favSet = useMemo(() => new Set(state.favorites), [state.favorites])

  const favBook: Book | null = useMemo(() => {
    if (!words) return null
    const order = words.map((w, i) => (favSet.has(w.word) ? i : -1)).filter((i) => i >= 0)
    return {
      id: FAV_ID,
      name: "收藏",
      createdAt: 0,
      order,
      cursor: Math.min(state.favCursor, Math.max(0, order.length - 1)),
      pageSize: state.favPageSize,
    }
  }, [words, favSet, state.favCursor, state.favPageSize])

  const book = openId === FAV_ID ? favBook : state.books.find((b) => b.id === openId) ?? null
  const total = book?.order.length ?? 0
  const pageCount = book && total ? Math.max(1, Math.ceil(total / book.pageSize)) : 1
  const pageIndex = book && total ? Math.floor(Math.min(book.cursor, total - 1) / book.pageSize) : 0

  const pageWords = useMemo(() => {
    if (!book || !words || total === 0) return []
    const start = pageIndex * book.pageSize
    return book.order.slice(start, start + book.pageSize).map((idx, i) => ({
      pos: start + i,
      word: words[idx],
    }))
  }, [book, words, pageIndex, total])

  function patch(partial: Partial<AppState>) {
    void persist({ ...state, ...partial })
  }

  function patchBook(id: string, next: Partial<Book>) {
    if (id === FAV_ID) {
      patch({
        favCursor: next.cursor ?? state.favCursor,
        favPageSize: next.pageSize ?? state.favPageSize,
      })
      return
    }
    patch({ books: state.books.map((b) => (b.id === id ? { ...b, ...next } : b)) })
  }

  function createBook() {
    if (!words) return
    const n = state.books.filter((b) => b.name.startsWith("单词本")).length + 1
    const next: Book = {
      id: uid(),
      name: `单词本 ${n}`,
      createdAt: Date.now(),
      order: shuffleIndices(words.length),
      cursor: 0,
      pageSize: 10,
    }
    patch({ books: [next, ...state.books] })
  }

  function removeBook(id: string) {
    patch({ books: state.books.filter((b) => b.id !== id) })
    if (openId === id) {
      setOpenId(null)
      setMode("library")
    }
  }

  function toggleFav(word: string) {
    const has = favSet.has(word)
    const favorites = has ? state.favorites.filter((w) => w !== word) : [...state.favorites, word]
    let favCursor = state.favCursor
    if (has && openId === FAV_ID && book) {
      favCursor = Math.min(book.cursor, Math.max(0, favorites.length - 1))
    }
    patch({ favorites, favCursor })
  }

  function goCursor(nextCursor: number) {
    if (!book || total === 0) return
    patchBook(book.id, { cursor: Math.min(Math.max(0, nextCursor), total - 1) })
  }

  const currentWord = book && words && total > 0 ? words[book.order[Math.min(book.cursor, total - 1)]] : null

  useEffect(() => {
    if (mode !== "card" || !book) return
    const cursor = book.cursor
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goCursor(cursor - 1)
      if (e.key === "ArrowRight") goCursor(cursor + 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mode, book?.id, book?.cursor])

  if (!words) {
    return <div className="min-h-screen grid place-items-center text-mute">载入词库…</div>
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-[1080px] px-5 py-10 md:px-12 md:py-14">
        {mode === "library" || !book ? (
          <Library
            books={state.books}
            words={words}
            favCount={state.favorites.length}
            favWord={favBook && favBook.order.length ? words[favBook.order[favBook.cursor]]?.word : ""}
            onCreate={createBook}
            onOpen={(id, nextMode) => {
              setOpenId(id)
              setMode(nextMode)
            }}
            onDelete={removeBook}
            renameId={renameId}
            renameVal={renameVal}
            setRenameId={setRenameId}
            setRenameVal={setRenameVal}
            onRename={(id) => {
              const name = renameVal.trim()
              if (name) patchBook(id, { name })
              setRenameId(null)
            }}
          />
        ) : mode === "book" ? (
          <BookView
            book={book}
            total={total}
            pageIndex={pageIndex}
            pageCount={pageCount}
            pageWords={pageWords}
            favSet={favSet}
            onBack={() => {
              setOpenId(null)
              setMode("library")
            }}
            onCards={() => setMode("card")}
            onPageSize={(pageSize) => patchBook(book.id, { pageSize })}
            onPrevPage={() => goCursor(Math.max(0, (pageIndex - 1) * book.pageSize))}
            onNextPage={() => goCursor(Math.min(total - 1, (pageIndex + 1) * book.pageSize))}
            onSelect={(pos) => goCursor(pos)}
            onToggleFav={toggleFav}
          />
        ) : (
          <CardView
            book={book}
            total={total}
            word={currentWord}
            starred={!!currentWord && favSet.has(currentWord.word)}
            onBack={() => {
              setOpenId(null)
              setMode("library")
            }}
            onBook={() => setMode("book")}
            onPrev={() => goCursor((book.cursor ?? 0) - 1)}
            onNext={() => goCursor((book.cursor ?? 0) + 1)}
            onToggleFav={() => currentWord && toggleFav(currentWord.word)}
          />
        )}
      </div>
    </div>
  )
}

function Library({
  books,
  words,
  favCount,
  favWord,
  onCreate,
  onOpen,
  onDelete,
  renameId,
  renameVal,
  setRenameId,
  setRenameVal,
  onRename,
}: {
  books: Book[]
  words: Word[]
  favCount: number
  favWord: string
  onCreate: () => void
  onOpen: (id: string, mode: Mode) => void
  onDelete: (id: string) => void
  renameId: string | null
  renameVal: string
  setRenameId: (id: string | null) => void
  setRenameVal: (v: string) => void
  onRename: (id: string) => void
}) {
  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8 border-b border-line">
        <div>
          <p className="text-sm text-mute mb-3">闪过 2025 · {words.length} 词</p>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold leading-none">闪过</h1>
        </div>
        <button type="button" onClick={onCreate} className="solid-btn">
          <Plus size={16} />
          新建
        </button>
      </header>

      <section className="py-8 border-b border-line flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl">收藏</h2>
          <p className="text-sm text-mute mt-2">
            {favCount} 词{favWord ? ` · ${favWord}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="ghost-btn" disabled={favCount === 0} onClick={() => onOpen(FAV_ID, "book")}>
            <BookOpen size={16} />
            单词本
          </button>
          <button type="button" className="solid-btn" disabled={favCount === 0} onClick={() => onOpen(FAV_ID, "card")}>
            <Layers size={16} />
            卡片
          </button>
        </div>
      </section>

      {books.length === 0 ? (
        <button type="button" onClick={onCreate} className="w-full py-24 text-mute border-b border-line hover:text-ink transition-colors duration-200">
          打乱一份新的单词本
        </button>
      ) : (
        <ul>
          {books.map((b) => {
            const cur = words[b.order[b.cursor]]
            return (
              <li key={b.id} className="py-7 border-b border-line">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {renameId === b.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          onRename(b.id)
                        }}
                      >
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onBlur={() => onRename(b.id)}
                          className="w-full max-w-sm border border-ink bg-sheet px-3 py-2 font-serif text-2xl"
                        />
                      </form>
                    ) : (
                      <h2 className="font-serif text-3xl">{b.name}</h2>
                    )}
                    <p className="mt-3 text-sm text-mute">第 {b.cursor + 1} / {words.length}</p>
                    <p className="font-serif text-[28px] mt-1 leading-none">{cur?.word ?? "—"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" aria-label="重命名" className="icon-btn" onClick={() => { setRenameId(b.id); setRenameVal(b.name) }}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" aria-label="删除" className="icon-btn text-mute" onClick={() => onDelete(b.id)}>
                      <Trash2 size={16} />
                    </button>
                    <button type="button" onClick={() => onOpen(b.id, "book")} className="ghost-btn">
                      <BookOpen size={16} />
                      单词本
                    </button>
                    <button type="button" onClick={() => onOpen(b.id, "card")} className="solid-btn">
                      <Layers size={16} />
                      卡片
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function BookView({
  book,
  total,
  pageIndex,
  pageCount,
  pageWords,
  favSet,
  onBack,
  onCards,
  onPageSize,
  onPrevPage,
  onNextPage,
  onSelect,
  onToggleFav,
}: {
  book: Book
  total: number
  pageIndex: number
  pageCount: number
  pageWords: { pos: number; word: Word }[]
  favSet: Set<string>
  onBack: () => void
  onCards: () => void
  onPageSize: (n: PageSize) => void
  onPrevPage: () => void
  onNextPage: () => void
  onSelect: (pos: number) => void
  onToggleFav: (word: string) => void
}) {
  const label = total === 0 ? "空" : `${pageIndex + 1} / ${pageCount} · 第 ${Math.min(book.cursor, Math.max(total - 1, 0)) + 1} / ${total}`
  return (
    <div>
      <header className="flex flex-wrap items-center gap-3 pb-6 border-b border-line">
        <button type="button" onClick={onBack} className="ghost-btn">
          <ArrowLeft size={16} />
          书库
        </button>
        <h1 className="font-serif text-3xl">{book.name}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={onCards} className="solid-btn" disabled={total === 0}>
            <Layers size={16} />
            卡片
          </button>
          <div className="flex overflow-hidden rounded-full border border-line">
            {PAGE_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPageSize(n)}
                className={`min-h-11 min-w-11 duration-180 ${book.pageSize === n ? "bg-accent text-ink" : "hover:bg-accent/15"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </header>

      {total === 0 ? (
        <div className="py-24 text-center text-mute">还没有收藏</div>
      ) : (
        <>
          <Pager label={label} disablePrev={pageIndex === 0} disableNext={pageIndex >= pageCount - 1} onPrev={onPrevPage} onNext={onNextPage} />
          <ol className="border-t border-line">
            {pageWords.map(({ pos, word }) => {
              const active = pos === book.cursor
              return (
                <li key={`${word.word}-${pos}`} className={`border-b border-line ${active ? "row-current" : ""}`}>
                  <div
                    className="py-6 pr-2 pl-4 md:pl-5 flex gap-6 items-start"
                    onClick={() => onSelect(pos)}
                    onKeyDown={(e) => { if (e.key === "Enter") onSelect(pos) }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="w-8 shrink-0 text-mute tabular-nums text-sm pt-2">{pos + 1}</span>
                    <div className="w-[200px] shrink-0">
                      <div className="font-serif text-[32px] leading-none">{word.word}</div>
                      <div className="text-mute text-sm mt-3 leading-6">
                        英 /{word.phonetic0}/
                        <br />
                        美 /{word.phonetic1}/
                      </div>
                      <div className="flex items-center -ml-2 mt-2">
                        <Speak word={word.word} />
                        <StarBtn on={favSet.has(word.word)} onToggle={() => onToggleFav(word.word)} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <SenseList word={word} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          <Pager label={label} disablePrev={pageIndex === 0} disableNext={pageIndex >= pageCount - 1} onPrev={onPrevPage} onNext={onNextPage} />
        </>
      )}
    </div>
  )
}

function CardView({
  book,
  total,
  word,
  starred,
  onBack,
  onBook,
  onPrev,
  onNext,
  onToggleFav,
}: {
  book: Book
  total: number
  word: Word | null
  starred: boolean
  onBack: () => void
  onBook: () => void
  onPrev: () => void
  onNext: () => void
  onToggleFav: () => void
}) {
  if (!word || total === 0) {
    return (
      <div>
        <button type="button" onClick={onBack} className="ghost-btn mb-8">
          <ArrowLeft size={16} />
          书库
        </button>
        <div className="text-mute">还没有收藏</div>
      </div>
    )
  }
  return (
    <div>
      <header className="flex flex-wrap items-center gap-3 pb-6 border-b border-line mb-12">
        <button type="button" onClick={onBack} className="ghost-btn">
          <ArrowLeft size={16} />
          书库
        </button>
        <h1 className="font-serif text-3xl">{book.name}</h1>
        <button type="button" onClick={onBook} className="ml-auto ghost-btn">
          <BookOpen size={16} />
          单词本
        </button>
      </header>

      <article className="max-w-[720px]">
        <div className="flex items-center justify-between text-sm text-mute">
          <span>第 {book.cursor + 1} / {total}</span>
          <StarBtn on={starred} onToggle={onToggleFav} />
        </div>
        <h2 className="mt-6 font-serif text-6xl md:text-7xl leading-none">{word.word}</h2>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-mute">
          <span>英 /{word.phonetic0}/</span>
          <span>美 /{word.phonetic1}/</span>
          <Speak word={word.word} />
        </div>
        <div className="mt-10 pt-8 border-t border-line">
          <SenseList word={word} large />
        </div>
        {word.sentences?.length > 0 && (
          <section className="mt-10 pt-8 border-t border-line">
            <h3 className="text-sm text-mute mb-4">例句</h3>
            <ul className="space-y-6">
              {word.sentences.map((s, i) => (
                <li key={i}>
                  <p className="font-serif text-[22px] leading-8">{highlightPhrase(s.c, word.word)}</p>
                  <p className="text-mute mt-1 leading-7">{s.cn}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-12 flex justify-between border-t border-line pt-6">
          <button type="button" onClick={onPrev} disabled={book.cursor === 0} className="ghost-btn">
            上一张
          </button>
          <button type="button" onClick={onNext} disabled={book.cursor >= total - 1} className="solid-btn">
            下一张
          </button>
        </div>
      </article>
    </div>
  )
}
