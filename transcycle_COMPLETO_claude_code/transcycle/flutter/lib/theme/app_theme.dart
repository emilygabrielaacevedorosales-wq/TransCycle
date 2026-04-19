import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class TCColors {
  static const follicularEarly  = Color(0xFF8BBFB8);
  static const follicularLate   = Color(0xFFB8AED4);
  static const ovulationVirtual = Color(0xFFE8A4B0);
  static const lutealEarly      = Color(0xFFD4B87A);
  static const lutealLate       = Color(0xFFD4A96A);
  static const trough           = Color(0xFFE88C8C);
  static const bg               = Color(0xFFFAF8F5);
  static const bg2              = Color(0xFFF2EFE9);
  static const textPrimary      = Color(0xFF1C1A17);
  static const textSecondary    = Color(0xFF6B6459);
  static const textTertiary     = Color(0xFFA09890);
  static const pinkAccent       = Color(0xFFC4728A);
  static const border           = Color(0x14000000);

  static Color forPhase(String phase) {
    switch (phase) {
      case 'follicular_early':  return follicularEarly;
      case 'follicular_late':   return follicularLate;
      case 'ovulation_virtual': return ovulationVirtual;
      case 'luteal_early':      return lutealEarly;
      case 'luteal_late':       return lutealLate;
      default:                  return trough;
    }
  }
}

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: TCColors.bg,
    colorScheme: const ColorScheme.light(
      primary: TCColors.pinkAccent, surface: TCColors.bg2,
      onPrimary: Colors.white, onSurface: TCColors.textPrimary,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: TCColors.bg, elevation: 0,
      titleTextStyle: GoogleFonts.dmSerifDisplay(fontSize: 22, fontWeight: FontWeight.w400, color: TCColors.textPrimary),
      iconTheme: const IconThemeData(color: TCColors.textSecondary),
    ),
    cardTheme: CardTheme(
      color: TCColors.bg2, elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: TCColors.border, width: 0.5),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: TCColors.pinkAccent, foregroundColor: Colors.white, elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
  );
}
