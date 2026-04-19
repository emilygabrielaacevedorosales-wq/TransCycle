import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'theme/app_theme.dart';
import 'services/api_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/symptoms/symptoms_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const TransCycleApp());
}

class TransCycleApp extends StatelessWidget {
  const TransCycleApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'TransCycle',
    theme: AppTheme.light,
    debugShowCheckedModeBanner: false,
    home: const AppGate(),
  );
}

// ── Gate: decide si mostrar login o la app principal ──────────

class AppGate extends StatefulWidget {
  const AppGate({super.key});
  @override
  State<AppGate> createState() => _AppGateState();
}

class _AppGateState extends State<AppGate> with WidgetsBindingObserver {
  final _api  = ApiService();
  final _auth = LocalAuthentication();
  bool _checking = true, _authed = false, _biometricPassed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _check();
  }

  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }

  // Bloquear con biometría al volver a la app desde background
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _authed) _biometric();
  }

  Future<void> _check() async {
    final logged = await _api.isLoggedIn;
    if (!logged) { setState(() { _authed = false; _checking = false; }); return; }
    await _biometric();
    setState(() => _checking = false);
  }

  Future<void> _biometric() async {
    final canCheck = await _auth.canCheckBiometrics;
    if (!canCheck) { setState(() { _authed = true; _biometricPassed = true; }); return; }
    try {
      final ok = await _auth.authenticate(
        localizedReason: 'Verifica tu identidad para acceder a TransCycle',
        options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
      );
      setState(() { _authed = ok; _biometricPassed = ok; });
    } catch (_) {
      setState(() { _authed = true; _biometricPassed = true; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) return const Scaffold(
      backgroundColor: TCColors.bg,
      body: Center(child: CircularProgressIndicator(color: TCColors.pinkAccent)),
    );

    if (!_authed) return LoginScreen(onLogin: () => setState(() { _authed = true; _biometricPassed = true; }));

    if (!_biometricPassed) return _BiometricPrompt(onTap: _biometric);

    return const MainShell();
  }
}

class _BiometricPrompt extends StatelessWidget {
  final VoidCallback onTap;
  const _BiometricPrompt({required this.onTap});
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: TCColors.bg,
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.fingerprint, size: 56, color: TCColors.pinkAccent),
          const SizedBox(height: 16),
          const Text('Verifica tu identidad', style: TextStyle(fontSize: 16)),
          const SizedBox(height: 20),
          ElevatedButton(onPressed: onTap, child: const Text('Desbloquear')),
        ],
      ),
    ),
  );
}

// ── Shell principal con bottom nav ────────────────────────────

class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _idx = 0;

  final _screens = const [
    DashboardScreen(),
    SymptomsScreen(),
    _HRTPlaceholder(),
    _AnalyticsPlaceholder(),
    _DiaryPlaceholder(),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
    body: IndexedStack(index: _idx, children: _screens),
    bottomNavigationBar: NavigationBar(
      selectedIndex: _idx,
      onDestinationSelected: (i) => setState(() => _idx = i),
      backgroundColor: TCColors.bg,
      indicatorColor: TCColors.pinkAccent.withOpacity(0.12),
      labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
      destinations: const [
        NavigationDestination(icon: Icon(Icons.circle_outlined), selectedIcon: Icon(Icons.circle), label: 'Ciclo'),
        NavigationDestination(icon: Icon(Icons.edit_outlined), selectedIcon: Icon(Icons.edit), label: 'Síntomas'),
        NavigationDestination(icon: Icon(Icons.medication_outlined), selectedIcon: Icon(Icons.medication), label: 'TRH'),
        NavigationDestination(icon: Icon(Icons.show_chart_outlined), selectedIcon: Icon(Icons.show_chart), label: 'Analíticas'),
        NavigationDestination(icon: Icon(Icons.book_outlined), selectedIcon: Icon(Icons.book), label: 'Diario'),
      ],
    ),
  );
}

// ── Placeholders para las pantallas pendientes ────────────────

class _HRTPlaceholder extends StatelessWidget {
  const _HRTPlaceholder();
  @override
  Widget build(BuildContext context) => const Scaffold(
    appBar: AppBar(title: Text('Terapia hormonal')),
    body: Center(child: Text('Módulo TRH — próximamente', style: TextStyle(color: TCColors.textTertiary))),
  );
}

class _AnalyticsPlaceholder extends StatelessWidget {
  const _AnalyticsPlaceholder();
  @override
  Widget build(BuildContext context) => const Scaffold(
    appBar: AppBar(title: Text('Analíticas')),
    body: Center(child: Text('Módulo analíticas — próximamente', style: TextStyle(color: TCColors.textTertiary))),
  );
}

class _DiaryPlaceholder extends StatelessWidget {
  const _DiaryPlaceholder();
  @override
  Widget build(BuildContext context) => const Scaffold(
    appBar: AppBar(title: Text('Diario')),
    body: Center(child: Text('Módulo diario — próximamente', style: TextStyle(color: TCColors.textTertiary))),
  );
}
