import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme.dart';
import '../../models/cycle_models.dart';
import '../../services/api_service.dart';
import '../../widgets/cycle_ring.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiService();
  CycleStatus? _status;
  List<RingDayData> _ringDays = [];
  bool _loading = true;
  String? _error;

  final _phaseNames = {
    'follicular_early':  'Folicular temprana',
    'follicular_late':   'Folicular tardía',
    'ovulation_virtual': 'Ovulación virtual',
    'luteal_early':      'Lútea temprana',
    'luteal_late':       'Lútea tardía',
    'trough':            'Valle del ciclo',
  };

  final _phaseDescriptions = {
    'follicular_early':  'E2 en ascenso. Energía moderada, estado de ánimo estable.',
    'follicular_late':   'E2 en niveles altos. Semana de mayor vitalidad.',
    'ovulation_virtual': 'Pico máximo de E2. Mayor energía y conexión corporal.',
    'luteal_early':      'P4 en ascenso. Posible sensibilidad mamaria.',
    'luteal_late':       'P4 alta. Mayor sensibilidad emocional.',
    'trough':            'Mínimos hormonales. Valle pre-siguiente dosis.',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final [statusRes, ringRes] = await Future.wait([
        _api.getCycleStatus(),
        _api.getDashboardRing(),
      ]);
      final status = statusRes as CycleStatus;
      final ringData = ringRes as Map<String, dynamic>;
      setState(() {
        _status  = status;
        _ringDays = (ringData['ring'] as List).map((j) => RingDayData.fromJson(j)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

    return Scaffold(
      appBar: AppBar(
        title: Text(greeting),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: () { setState(() => _loading = true); _load(); },
          ),
        ],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: TCColors.pinkAccent))
        : _error != null
          ? _ErrorView(error: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              color: TCColors.pinkAccent,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_status?.daysUntilGhostPeriod != null &&
                        _status!.daysUntilGhostPeriod! <= 5)
                      _GhostBanner(days: _status!.daysUntilGhostPeriod!),

                    const SizedBox(height: 4),
                    _DashboardHero(
                      status: _status!,
                      ringDays: _ringDays,
                      phaseName: _phaseNames[_status!.phase] ?? _status!.phase,
                    ),
                    const SizedBox(height: 20),
                    _PhaseCard(
                      name: _phaseNames[_status!.phase] ?? _status!.phase,
                      description: _phaseDescriptions[_status!.phase] ?? '',
                      color: TCColors.forPhase(_status!.phase),
                    ),
                    const SizedBox(height: 14),
                    _MiniStatsRow(status: _status!),
                    const SizedBox(height: 20),
                    _ConfidenceBar(score: _status!.confidenceScore),
                  ],
                ),
              ),
            ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────

class _GhostBanner extends StatelessWidget {
  final int days;
  const _GhostBanner({required this.days});

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      color: const Color(0xFFFDF0F0),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: TCColors.trough.withOpacity(0.3), width: 0.5),
    ),
    child: Row(
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.8, end: 1.2),
          duration: const Duration(milliseconds: 800),
          builder: (_, v, child) => Transform.scale(scale: v, child: child),
          child: Container(
            width: 10, height: 10,
            decoration: const BoxDecoration(color: TCColors.trough, shape: BoxShape.circle),
          ),
          onEnd: () {},
        ),
        const SizedBox(width: 12),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 13, color: TCColors.textSecondary),
              children: [
                const TextSpan(text: 'Período fantasma ', style: TextStyle(fontWeight: FontWeight.w500, color: Color(0xFFC05050))),
                TextSpan(text: days == 0 ? 'hoy' : 'en $days día${days == 1 ? '' : 's'}'),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _DashboardHero extends StatelessWidget {
  final CycleStatus status;
  final List<RingDayData> ringDays;
  final String phaseName;

  const _DashboardHero({required this.status, required this.ringDays, required this.phaseName});

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      if (ringDays.isNotEmpty)
        CycleRingWidget(
          days: ringDays,
          currentDay: status.currentDay,
          phaseName: phaseName,
        ),
    ],
  );
}

class _PhaseCard extends StatelessWidget {
  final String name, description;
  final Color color;
  const _PhaseCard({required this.name, required this.description, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: TCColors.bg2,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: TCColors.border, width: 0.5),
      // Borde de color de fase a la izquierda
    ),
    child: Row(
      children: [
        Container(width: 3, height: 48, decoration: BoxDecoration(
          color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
              const SizedBox(height: 4),
              Text(description, style: const TextStyle(fontSize: 12, color: TCColors.textSecondary, height: 1.5)),
            ],
          ),
        ),
      ],
    ),
  );
}

class _MiniStatsRow extends StatelessWidget {
  final CycleStatus status;
  const _MiniStatsRow({required this.status});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(child: _Stat(
        value: '${status.currentDay}/28',
        label: 'Día del ciclo',
        color: TCColors.forPhase(status.phase),
      )),
      const SizedBox(width: 10),
      Expanded(child: _Stat(
        value: status.daysUntilGhostPeriod != null ? '${status.daysUntilGhostPeriod}d' : '—',
        label: 'Hasta período',
        color: TCColors.trough,
      )),
      const SizedBox(width: 10),
      Expanded(child: _Stat(
        value: _trendLabel(status.e2Trend),
        label: 'Tendencia E2',
        color: TCColors.pinkAccent,
      )),
    ],
  );

  String _trendLabel(String t) => t == 'rising' ? '↑' : t == 'falling' ? '↓' : '→';
}

class _Stat extends StatelessWidget {
  final String value, label;
  final Color color;
  const _Stat({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
    decoration: BoxDecoration(
      color: TCColors.bg2,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: TCColors.border, width: 0.5),
    ),
    child: Column(
      children: [
        Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w400, color: color, height: 1)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 10, color: TCColors.textTertiary, letterSpacing: 0.06)),
      ],
    ),
  );
}

class _ConfidenceBar extends StatelessWidget {
  final double score;
  const _ConfidenceBar({required this.score});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text('Confianza del modelo', style: TextStyle(fontSize: 11, color: TCColors.textTertiary, letterSpacing: 0.06)),
          Text('${(score * 100).round()}%', style: const TextStyle(fontSize: 11, color: TCColors.textTertiary)),
        ],
      ),
      const SizedBox(height: 6),
      ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: LinearProgressIndicator(
          value: score,
          minHeight: 3,
          backgroundColor: TCColors.bg3,
          valueColor: AlwaysStoppedAnimation(TCColors.pinkAccent.withOpacity(0.7)),
        ),
      ),
      if (score < 0.4)
        const Padding(
          padding: EdgeInsets.only(top: 6),
          child: Text('Registra síntomas diariamente para mejorar la precisión.',
            style: TextStyle(fontSize: 11, color: TCColors.textTertiary)),
        ),
    ],
  );
}

class _ErrorView extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;
  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 48, color: TCColors.textTertiary),
          const SizedBox(height: 16),
          Text('No se pudo conectar al servidor', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(error, style: const TextStyle(fontSize: 12, color: TCColors.textTertiary), textAlign: TextAlign.center),
          const SizedBox(height: 20),
          ElevatedButton(onPressed: onRetry, child: const Text('Reintentar')),
        ],
      ),
    ),
  );
}
