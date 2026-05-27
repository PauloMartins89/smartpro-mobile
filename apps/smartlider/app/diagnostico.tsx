// @ts-nocheck
import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Share } from 'react-native'
import { useNavigation } from 'expo-router'
import { useEffect } from 'react'
import { getLogs, clearLogs, type LogEntry } from '../src/lib/logger'
import { C } from '../src/lib/theme'

const LEVEL_COLOR = { log: '#F0F6FC', warn: '#D29922', error: '#F85149' }
const LEVEL_BG    = { log: 'transparent', warn: '#2D1B00', error: '#2D0000' }

export default function DiagnosticoScreen() {
  const nav = useNavigation()
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    nav.setOptions({ title: 'Diagnóstico', headerShown: true })
    setLogs(getLogs())
  }, [])

  const refresh = useCallback(() => setLogs(getLogs()), [])

  const limpar = useCallback(() => {
    clearLogs()
    setLogs([])
  }, [])

  const compartilhar = useCallback(async () => {
    const texto = getLogs()
      .slice().reverse()
      .map(l => `[${l.time}] ${l.level.toUpperCase()} ${l.msg}`)
      .join('\n')
    await Share.share({ message: texto, title: 'Logs SmartLíder' })
  }, [])

  const renderItem = ({ item }: { item: LogEntry }) => (
    <View style={[styles.row, { backgroundColor: LEVEL_BG[item.level] }]}>
      <Text style={styles.time}>{item.time}</Text>
      <Text style={[styles.level, { color: LEVEL_COLOR[item.level] }]}>
        {item.level.toUpperCase()}
      </Text>
      <Text style={styles.msg} selectable>{item.msg}</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Barra de ações */}
      <View style={styles.toolbar}>
        <Text style={styles.count}>{logs.length} entradas</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} onPress={refresh}>
            <Text style={styles.btnText}>↻ Atualizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={compartilhar}>
            <Text style={styles.btnText}>⬆ Enviar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={limpar}>
            <Text style={[styles.btnText, { color: '#F85149' }]}>✕ Limpar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {logs.length === 0
        ? <View style={styles.empty}>
            <Text style={styles.emptyText}>Sem logs. Navegue pelo app e atualize.</Text>
          </View>
        : <FlatList
            data={logs}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={{ padding: 8 }}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  toolbar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#30363D' },
  count:     { color: '#8B949E', fontSize: 12 },
  actions:   { flexDirection: 'row', gap: 8 },
  btn:       { backgroundColor: '#161B22', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#30363D' },
  btnDanger: { borderColor: '#F85149' },
  btnText:   { color: '#F0F6FC', fontSize: 12, fontWeight: '600' },
  list:      { flex: 1 },
  row:       { borderRadius: 6, padding: 8, marginBottom: 4, borderWidth: 1, borderColor: '#21262D' },
  time:      { color: '#8B949E', fontSize: 10, marginBottom: 2 },
  level:     { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  msg:       { color: '#F0F6FC', fontSize: 12, fontFamily: 'monospace' },
  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#8B949E', fontSize: 14 },
})
