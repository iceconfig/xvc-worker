import { useState, useRef, useEffect } from 'react'
import { marked } from 'marked'

interface TaskProgress {
  type: 'progress'
  taskId: string
  progress: number
  stage: string
  currentSegment?: number
  totalSegments?: number
}

interface TaskChunk {
  type: 'chunk'
  taskId: string
  text: string
}

interface TaskDone {
  type: 'done'
  taskId: string
}

interface TaskError {
  type: 'error'
  taskId: string
  message: string
}

type WebSocketMessage = TaskProgress | TaskChunk | TaskDone | TaskError

export default function App() {
  const [youtubeUrl, setYoutubeUrl] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [stage, setStage] = useState<string>('')
  const responseRef = useRef<string>('')
  const responseDivRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const bufferRef = useRef<string>('')  // 未渲染的 markdown

  // 清理 WebSocket 连接
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // 渲染单个 chunk
  const renderChunk = (markdown: string) => {
    const div = document.createElement('div')
    div.innerHTML = marked.parse(markdown) as string
    responseDivRef.current?.appendChild(div)
    // 自动滚动到底部
    if (responseDivRef.current) {
      responseDivRef.current.scrollTop = responseDivRef.current.scrollHeight
    }
  }

  const handleSend = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    setLoading(true)
    setError('')
    setProgress(0)
    setStage('')
    responseRef.current = ''
    bufferRef.current = ''  // 清空 buffer
    if (responseDivRef.current) {
      responseDivRef.current.innerHTML = ''  // 清空容器
    }

    try {
      // 1. 发送 POST 请求创建任务
      const analyzeRes = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
      })

      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json()
        throw new Error(errorData.error || `Request failed: ${analyzeRes.status}`)
      }

      const { task_id, ws_url } = await analyzeRes.json()
      console.log(`[Task] Created task: ${task_id}`)

      // 2. 建立 WebSocket 连接
      const ws = new WebSocket(ws_url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] 连接已建立')
        setStage('Connected to server')
      }

      ws.onmessage = (event) => {
        const data: WebSocketMessage = JSON.parse(event.data)

        if (data.type === 'progress') {
          // 更新进度条
          setProgress(data.progress)
          setStage(data.stage)
          console.log(`[Progress] ${data.progress}% - ${data.stage}`)
        } else if (data.type === 'chunk') {
          // 流式渲染 Markdown
          bufferRef.current += data.text
          const parts = bufferRef.current.split('\n\n')
          // 保留最后一段（可能不完整）
          bufferRef.current = parts.pop() || ''
          // 渲染完整的段落
          for (const part of parts) {
            if (part.trim()) {
              renderChunk(part + '\n\n')
            }
          }
        } else if (data.type === 'done') {
          // 任务完成 - 渲染剩余的 buffer
          if (bufferRef.current.trim()) {
            renderChunk(bufferRef.current)
            bufferRef.current = ''
          }
          // 任务完成
          console.log('[WebSocket] 任务完成')
          setStage('Completed')
          setProgress(100)
          setLoading(false)
          ws.close()
          wsRef.current = null
        } else if (data.type === 'error') {
          // 错误处理
          setError(data.message)
          setLoading(false)
          ws.close()
          wsRef.current = null
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] 错误:', error)
        setError('WebSocket connection error')
        setLoading(false)
      }

      ws.onclose = () => {
        console.log('[WebSocket] 连接已关闭')
        wsRef.current = null
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  return (
    <>
      <h1>YouTube Subtitles + DeepSeek (Async)</h1>
      <hr style={{ margin: '20px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            YouTube URL
          </label>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{ padding: '10px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
            disabled={loading}
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !youtubeUrl.trim()}
          style={{ padding: '10px 20px', fontSize: '14px' }}
        >
          {loading ? 'Processing...' : 'Send'}
        </button>

        {/* 进度条 */}
        {loading && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{stage || 'Starting...'}</span>
              <span style={{ fontSize: '14px' }}>{progress}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#4caf50',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div
          ref={responseDivRef}
          style={{
            border: '1px solid #ccc',
            padding: '10px',
            borderRadius: '4px',
            minHeight: '20px',
            maxHeight: '500px',
            overflowY: 'auto',
          }}
        />
      </div>
    </>
  )
}
