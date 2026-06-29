import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Check, Muted, ScreenTitle, SectionLabel, SoftButton } from '../components/ui';
import { Todo } from '../lib/types';

export default function TodosScreen({ userId }: { userId: string }) {
  const [open, setOpen] = useState<Todo[]>([]);
  const [done, setDone] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });
    const all = (data as Todo[]) ?? [];
    setOpen(all.filter((t) => !t.done));
    setDone(all.filter((t) => t.done).slice(0, 10));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setAdding(true);
    await supabase.from('todos').insert({ user_id: userId, title: trimmed });
    setTitle('');
    setAdding(false);
    load();
  }

  async function complete(t: Todo) {
    setOpen((prev) => prev.filter((x) => x.id !== t.id));
    await supabase.from('todos').update({ done: true }).eq('id', t.id);
    load();
  }

  async function reopen(t: Todo) {
    await supabase.from('todos').update({ done: false }).eq('id', t.id);
    load();
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <ScreenTitle subtitle="Was du erledigen willst.">Todos</ScreenTitle>

      <Card style={{ marginBottom: theme.spacing(3) }}>
        <TextInput
          placeholder="Neues Todo …"
          placeholderTextColor={theme.colors.faint}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={add}
          style={styles.input}
        />
        <SoftButton label="Hinzufügen" onPress={add} loading={adding} />
      </Card>

      <SectionLabel>Offen</SectionLabel>
      {open.length === 0 ? (
        <Muted style={{ marginBottom: theme.spacing(3) }}>Alles erledigt. Ruhig.</Muted>
      ) : (
        <Card style={{ marginBottom: theme.spacing(3) }}>
          {open.map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => complete(t)}
              style={[styles.row, i < open.length - 1 && styles.rowDivider]}
            >
              <Text style={styles.rowText}>{t.title}</Text>
              <Check on={false} />
            </Pressable>
          ))}
        </Card>
      )}

      {done.length > 0 ? (
        <>
          <SectionLabel>Erledigt</SectionLabel>
          <Card>
            {done.map((t, i) => (
              <Pressable
                key={t.id}
                onPress={() => reopen(t)}
                style={[styles.row, i < done.length - 1 && styles.rowDivider]}
              >
                <Text style={[styles.rowText, styles.doneText]}>{t.title}</Text>
                <Check on={true} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <View style={{ height: theme.spacing(6) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },
  input: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: 12,
    fontSize: theme.font.body,
    color: theme.colors.text,
    marginBottom: theme.spacing(1.5),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowText: { fontSize: theme.font.body, color: theme.colors.text, flex: 1 },
  doneText: { color: theme.colors.faint, textDecorationLine: 'line-through' },
});
