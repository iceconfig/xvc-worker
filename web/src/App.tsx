import { useState, useRef } from 'react'

export default function App() {
  const [youtubeUrl, setYoutubeUrl] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const responseRef = useRef<string>('')
  const responseDivRef = useRef<HTMLDivElement>(null)

  const handleSend = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    setLoading(true)
    setError('')
    responseRef.current = ''
    if (responseDivRef.current) {
      responseDivRef.current.textContent = ''
    }

    try {
      const subtitlesRes = await fetch(`/subtitles?url=${encodeURIComponent(youtubeUrl)}`)

      if (!subtitlesRes.ok) {
        const errorData = await subtitlesRes.json()
        throw new Error(errorData.error || `Failed to fetch subtitles: ${subtitlesRes.status}`)
      }

      const subtitlesData = await subtitlesRes.json()
      
      const deepSeekRes = await fetch('/deepseek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: subtitlesData.text }),
      })

      if (!deepSeekRes.ok) {
        throw new Error(`Request failed: ${deepSeekRes.status} ${deepSeekRes.statusText}`)
      }

      const reader = deepSeekRes.body?.getReader()
      if (!reader) {
        throw new Error('Response body is empty')
      }

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        responseRef.current += chunk
        if (responseDivRef.current) {
          responseDivRef.current.textContent = responseRef.current
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1>YouTube Subtitles + DeepSeek</h1>
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
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div
          ref={responseDivRef}
          style={{
            border: '1px solid #ccc',
            padding: '10px',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minHeight: '20px',
          }}
        />
      </div>
    </>
  )
}
