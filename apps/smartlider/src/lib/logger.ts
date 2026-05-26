// Logger in-app — intercepta console.log/warn/error e guarda em memória
// Use getLogs() para exibir na tela de diagnóstico

export type LogLevel = 'log' | 'warn' | 'error'

export interface LogEntry {
  level:   LogLevel
  msg:     string
  time:    string  // HH:MM:SS
}

const MAX_ENTRIES = 200

const _logs: LogEntry[] = []

function now() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function push(level: LogLevel, args: unknown[]) {
  const msg = args.map(a =>
    typeof a === 'string' ? a : JSON.stringify(a)
  ).join(' ')
  if (_logs.length >= MAX_ENTRIES) _logs.shift()
  _logs.push({ level, msg, time: now() })
}

// Guarda referências originais
const _origLog   = console.log.bind(console)
const _origWarn  = console.warn.bind(console)
const _origError = console.error.bind(console)

export function initLogger() {
  console.log   = (...args) => { _origLog(...args);   push('log',   args) }
  console.warn  = (...args) => { _origWarn(...args);  push('warn',  args) }
  console.error = (...args) => { _origError(...args); push('error', args) }
}

export function getLogs(): LogEntry[] {
  return [..._logs].reverse() // mais recentes primeiro
}

export function clearLogs() {
  _logs.length = 0
}
