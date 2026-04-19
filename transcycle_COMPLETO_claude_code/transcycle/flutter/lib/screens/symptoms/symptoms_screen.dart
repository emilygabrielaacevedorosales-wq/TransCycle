import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import '../../theme/app_theme.dart';
import '../../models/cycle_models.dart';
import '../../services/api_service.dart';

class SymptomsScreen extends StatefulWidget {
  const SymptomsScreen({super.key});
  @override
  State<SymptomsScreen> createState() => _SymptomsScreenState();
}

class _SymptomsScreenState extends State<SymptomsScreen> {
  final _api = ApiService();
  final _auth = LocalAuthentication();

  final _scores = <String, int>{
    'moodScore': 7, 'breastTenderness': 4, 'fatigueLevel': 4,
    'digestiveChanges': 3, 'libidoScore': 6, 'skinChanges': 5,
    'brainFog': 3, 'emotionalLability': 5,
  };

  final _labels = {
    'moodScore': 'Estado de ánimo', 'breastTenderness': 'Sensibilidad mamaria',
    'fatigueLevel': 'Fatiga', 'digestiveChanges': 'Cambios digestivos',
    'libidoScore': 'Libido', 'skinChanges': 'Cambios en piel',
    'brainFog': 'Niebla mental', 'emotionalLability': 'Labilidad emocional',
  };

  bool _saving = false;
  List<dynamic> _history = [];
  bool _loadingHistory = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      final h = await _api.getSymptomHistory(limit: 7);
      setState(() { _history = h; _loadingHistory = false; });
    } catch (_) {
      setState(() => _loadingHistory = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    HapticFeedback.mediumImpact();
    try {
      final entry = SymptomEntry(
        moodScore:         _scores['moodScore']!,
        breastTenderness:  _scores['breastTenderness']!,
        fatigueLevel:      _scores['fatigueLevel']!,
        digestiveChanges:  _scores['digestiveChanges']!,
        libidoScore:       _scores['libidoScore']!,
        skinChanges:       _scores['skinChanges']!,
        brainFog:          _scores['brainFog']!,
        emotionalLability: _scores['emotionalLability']!,
      );
      await _api.logSymptoms(entry);
      HapticFeedback.lightImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Síntomas guardados'), backgroundColor: TCColors.pinkAccent));
      }
      await _loadHistory();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red.shade300));
    } finally {
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Síntomas')),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Form card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: TCColors.bg2,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: TCColors.border, width: 0.5),
            ),
            child: Column(
              children: [
                // Grid de sliders 2 columnas
                GridView.builder(
                  shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2, childAspectRatio: 2.8,
                    crossAxisSpacing: 16, mainAxisSpacing: 4,
                  ),
                  itemCount: _scores.length,
                  itemBuilder: (_, i) {
                    final key = _scores.keys.elementAt(i);
                    return _SliderRow(
                      label: _labels[key]!,
                      value: _scores[key]!,
                      onChanged: (v) {
                        setState(() => _scores[key] = v);
                        HapticFeedback.selectionClick();
                      },
                    );
                  },
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                      ? const SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Guardar registro de hoy'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // Historial
          const Text('HISTORIAL RECIENTE',
            style: TextStyle(fontSize: 10, letterSpacing: 0.1, color: TCColors.textTertiary)),
          const SizedBox(height: 10),
          if (_loadingHistory)
            const Center(child: CircularProgressIndicator(color: TCColors.pinkAccent))
          else
            ..._history.map((entry) => _HistoryRow(entry: entry)).toList(),
        ],
      ),
    ),
  );
}

class _SliderRow extends StatelessWidget {
  final String label;
  final int value;
  final ValueChanged<int> onChanged;
  const _SliderRow({required this.label, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(label,
            style: const TextStyle(fontSize: 11, color: TCColors.textSecondary),
            overflow: TextOverflow.ellipsis)),
          Text('$value', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
        ],
      ),
      SliderTheme(
        data: SliderThemeData(
          trackHeight: 3,
          thumbRadius: 7,
          activeTrackColor: TCColors.pinkAccent,
          inactiveTrackColor: TCColors.bg3,
          thumbColor: TCColors.pinkAccent,
          overlayRadius: 14,
        ),
        child: Slider(
          value: value.toDouble(), min: 1, max: 10, divisions: 9,
          onChanged: (v) => onChanged(v.round()),
        ),
      ),
    ],
  );
}

class _HistoryRow extends StatelessWidget {
  final dynamic entry;
  const _HistoryRow({required this.entry});

  @override
  Widget build(BuildContext context) {
    final scores = [
      entry['mood_score'], entry['breast_tenderness'], entry['fatigue_level'],
      entry['digestive_changes'], entry['libido_score'],
      entry['skin_changes'], entry['brain_fog'], entry['emotional_lability'],
    ].where((v) => v != null).map((v) => (v as num).toInt()).toList();

    final colors = [
      TCColors.pinkAccent, TCColors.follicularLate, TCColors.lutealLate,
      TCColors.teal, TCColors.pinkAccent, TCColors.follicularLate,
      TCColors.teal, TCColors.lutealEarly,
    ];

    final date = DateTime.tryParse(entry['logged_at'] ?? '');
    final label = date != null ? _relativeDate(date) : '—';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: TCColors.bg2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: TCColors.border, width: 0.5),
      ),
      child: Row(
        children: [
          SizedBox(width: 72, child: Text(label,
            style: const TextStyle(fontSize: 11, color: TCColors.textTertiary))),
          const SizedBox(width: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(scores.length, (i) => Padding(
              padding: const EdgeInsets.only(right: 3),
              child: Container(
                width: 6, height: (scores[i] * 2.4).toDouble(),
                decoration: BoxDecoration(
                  color: colors[i % colors.length],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            )),
          ),
          const Spacer(),
          if (entry['virtual_cycle_day'] != null)
            Text('Día ${entry['virtual_cycle_day']}',
              style: const TextStyle(fontSize: 10, color: TCColors.textTertiary)),
        ],
      ),
    );
  }

  static Color get teal => const Color(0xFF8BBFB8);

  String _relativeDate(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inDays == 0) return 'Hoy';
    if (diff.inDays == 1) return 'Ayer';
    return 'Hace ${diff.inDays}d';
  }
}
