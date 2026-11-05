let current: HTMLAudioElement | null = null

export function playPronunciation(word: string, accent: "uk" | "us") {
  const type = accent === "uk" ? "1" : "2"
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
  if (current) {
    current.pause()
    current.src = ""
  }
  current = new Audio(url)
  current.play().catch(() => {})
}