import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

// 只在当前窗口缓存页面偏好和滚动位置，不把账号内容写入浏览器存储。
const values = new Map<string, unknown>()
const scrolls = new Map<string, number>()

export function usePageState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, update] = useState<T>(() => values.has(key) ? values.get(key) as T : initial)
  const set = useCallback<Dispatch<SetStateAction<T>>>(next => {
    const current = values.has(key) ? values.get(key) as T : initial
    const result = typeof next === 'function' ? (next as (previous: T) => T)(current) : next
    values.set(key, result)
    update(result)
  }, [key, initial])
  return [value, set]
}

export function usePageScroll(key: string) {
  // 回调引用在挂载时立即恢复位置，避免先显示顶部再跳回原处。
  return useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    node.scrollTop = scrolls.get(key) ?? 0
    node.onscroll = () => { scrolls.set(key, node.scrollTop) }
  }, [key])
}
