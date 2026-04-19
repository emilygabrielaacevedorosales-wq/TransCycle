import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLogin;
  const LoginScreen({super.key, required this.onLogin});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _api = ApiService();
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool _loading = false, _register = false, _obscure = true;
  final _nameCtrl     = TextEditingController();
  final _pronounsCtrl = TextEditingController();

  Future<void> _submit() async {
    setState(() => _loading = true);
    try {
      if (_register) {
        await _api.register(
          email: _emailCtrl.text.trim(),
          password: _passCtrl.text,
          displayName: _nameCtrl.text.trim(),
          pronouns: _pronounsCtrl.text.trim().isEmpty ? null : _pronounsCtrl.text.trim(),
        );
      } else {
        await _api.login(_emailCtrl.text.trim(), _passCtrl.text);
      }
      widget.onLogin();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade300));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 32),
            Text('TransCycle', style: Theme.of(context).textTheme.displayMedium?.copyWith(color: TCColors.pinkAccent)),
            const SizedBox(height: 6),
            Text(_register ? 'Crear cuenta' : 'Iniciar sesión',
              style: const TextStyle(fontSize: 14, color: TCColors.textSecondary)),
            const SizedBox(height: 32),
            if (_register) ...[
              TextField(controller: _nameCtrl,
                decoration: const InputDecoration(labelText: 'Nombre o apodo')),
              const SizedBox(height: 12),
              TextField(controller: _pronounsCtrl,
                decoration: const InputDecoration(labelText: 'Pronombres (opcional)', hintText: 'ella/ella')),
              const SizedBox(height: 12),
            ],
            TextField(controller: _emailCtrl, keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 12),
            TextField(controller: _passCtrl, obscureText: _obscure,
              decoration: InputDecoration(
                labelText: 'Contraseña',
                suffixIcon: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, size: 18, color: TCColors.textTertiary),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_register ? 'Registrarme' : 'Entrar'),
              ),
            ),
            const SizedBox(height: 14),
            Center(
              child: TextButton(
                onPressed: () => setState(() => _register = !_register),
                child: Text(
                  _register ? '¿Ya tienes cuenta? Inicia sesión' : '¿Primera vez? Crear cuenta',
                  style: const TextStyle(fontSize: 13, color: TCColors.pinkAccent),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
