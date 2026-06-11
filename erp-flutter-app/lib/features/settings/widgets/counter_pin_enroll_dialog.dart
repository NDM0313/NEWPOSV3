import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../data/local/counter_worker_store.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/counter_worker_provider.dart';

class CounterPinEnrollDialog extends ConsumerStatefulWidget {
  const CounterPinEnrollDialog({super.key});

  @override
  ConsumerState<CounterPinEnrollDialog> createState() => _CounterPinEnrollDialogState();
}

class _CounterPinEnrollDialogState extends ConsumerState<CounterPinEnrollDialog> {
  final _pinController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _pinController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _enroll() async {
    final pin = _pinController.text;
    final confirm = _confirmController.text;
    if (pin != confirm) {
      setState(() => _error = 'PINs do not match.');
      return;
    }
    if (!isFourDigitPin(pin)) {
      setState(() => _error = 'PIN must be exactly 4 digits.');
      return;
    }

    final session = ref.read(authSessionProvider);
    final profile = session.profile;
    if (profile?.companyId == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(counterWorkerStoreProvider).saveWorker(
            pin: pin,
            userId: profile!.authUserId,
            displayName: profile.name,
            email: profile.email,
            role: profile.role,
            companyId: profile.companyId!,
            profileId: profile.profileId,
            branchId: session.selectedBranch?.id,
          );
      await ref.read(sharedCounterModeProvider.notifier).setEnabled(true);
      ref.invalidate(enrolledWorkersProvider);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() {
        _saving = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Enroll counter PIN'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Choose a 4-digit PIN for this worker on shared tablets.'),
          const SizedBox(height: 12),
          TextField(
            controller: _pinController,
            keyboardType: TextInputType.number,
            maxLength: 4,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'PIN', border: OutlineInputBorder()),
          ),
          TextField(
            controller: _confirmController,
            keyboardType: TextInputType.number,
            maxLength: 4,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Confirm PIN', border: OutlineInputBorder()),
          ),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: AppColors.error)),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _saving ? null : _enroll,
          child: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Enroll'),
        ),
      ],
    );
  }
}
