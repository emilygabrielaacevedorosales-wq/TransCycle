import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../models/cycle_models.dart';

class CycleRingPainter extends CustomPainter {
  final List<RingDayData> days;
  final int currentDay;
  final int totalDays;

  CycleRingPainter({required this.days, required this.currentDay, this.totalDays = 28});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final outerR = math.min(cx, cy) - 8;
    final innerR = outerR * 0.62;
    final gap = 0.025;
    final segAngle = (math.pi * 2) / totalDays;

    for (final day in days) {
      final i = day.day - 1;
      final startAngle = i * segAngle - math.pi / 2 + gap;
      final sweepAngle = segAngle - gap * 2;

      final phaseColor = TCColors.forPhase(day.phase);
      final isGhost   = day.isGhostPeriod;
      final isCurrent = day.day == currentDay;
      final isPast    = day.day < currentDay;

      final color = isGhost ? TCColors.trough : phaseColor;
      final opacity = isCurrent ? 1.0 : (isPast ? 0.85 : 0.22);

      final paint = Paint()
        ..color = color.withOpacity(opacity)
        ..style = PaintingStyle.fill;

      final path = Path();
      final rect = Rect.fromCircle(center: Offset(cx, cy), radius: outerR);
      path.arcTo(rect, startAngle, sweepAngle, true);
      final innerRect = Rect.fromCircle(center: Offset(cx, cy), radius: innerR);
      path.arcTo(innerRect, startAngle + sweepAngle, -sweepAngle, false);
      path.close();
      canvas.drawPath(path, paint);

      // Punto indicador del día actual
      if (isCurrent) {
        final midAngle = startAngle + sweepAngle / 2;
        final midR = (outerR + innerR) / 2;
        final markerX = cx + midR * math.cos(midAngle);
        final markerY = cy + midR * math.sin(midAngle);
        canvas.drawCircle(
          Offset(markerX, markerY), 4,
          Paint()..color = TCColors.textPrimary,
        );
      }
    }
  }

  @override
  bool shouldRepaint(CycleRingPainter old) =>
    old.currentDay != currentDay || old.days != days;
}

class CycleRingWidget extends StatefulWidget {
  final List<RingDayData> days;
  final int currentDay;
  final String phaseName;
  final String phaseEmoji;

  const CycleRingWidget({
    super.key,
    required this.days,
    required this.currentDay,
    required this.phaseName,
    this.phaseEmoji = '',
  });

  @override
  State<CycleRingWidget> createState() => _CycleRingWidgetState();
}

class _CycleRingWidgetState extends State<CycleRingWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _scale = CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut);
    _ctrl.forward();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final phaseColor = widget.days.isNotEmpty
      ? TCColors.forPhase(widget.days[widget.currentDay - 1].phase)
      : TCColors.follicularEarly;

    return ScaleTransition(
      scale: _scale,
      child: SizedBox(
        width: 220, height: 220,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: const Size(220, 220),
              painter: CycleRingPainter(days: widget.days, currentDay: widget.currentDay),
            ),
            // Centro
            Container(
              width: 136, height: 136,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: TCColors.bg,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('${widget.currentDay}',
                    style: TextStyle(
                      fontFamily: 'DMSerifDisplay',
                      fontSize: 48, fontWeight: FontWeight.w400,
                      color: phaseColor, height: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text('día del ciclo',
                    style: const TextStyle(
                      fontSize: 10, letterSpacing: 0.1,
                      color: TCColors.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(widget.phaseName.split(' ').last,
                    style: const TextStyle(fontSize: 11, color: TCColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
