@AGENTS.md

## Session-Log

### 2026-06-30

**Erledigt:**
- [ ] Bedingte Gewohnheiten: Habits können jetzt eine automatische Bedingung haben (z.B. "erledigt wenn Bildschirmzeit < 2h") — gespeichert als JSONB in `habits.condition`
- [ ] Auto-Markierung in TodayScreen: prüft Bedingungen beim Laden der Bildschirmzeit, markiert automatisch
- [ ] 3-Tab-Navigation (Heute / Gewohnheiten / Rückblick), Einstellungen als Modal
- [ ] Einstellungen-Button (Feather-Icon, kein Emoji) oben rechts im Rückblick-Tab
- [ ] Optimistisches Todo-Insert: Todo erscheint sofort, verschwindet bei DB-Fehler
- [ ] Validierung Habit-Name: rotes Input + Fehlermeldung wenn kein Titel eingegeben

**Offene Punkte / bekannte Schwächen:**
- Bildschirmzeit hat kein RLS — alle User sehen dieselben Daten (`screen_time`-Tabelle)
- Keine Fehleranzeige wenn Supabase-Calls (z.B. Habit-Insert) fehlschlagen
- Keine Tests; Utility-Funktionen (`parseInput`, `formatMinutes`, `todayISO`) wären gute Kandidaten für Unit Tests
