import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../auth/providers/counter_worker_provider.dart';

class PosLockScreen extends ConsumerStatefulWidget {
  const PosLockScreen({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PosLockScreen> createState() => _PosLockScreenState();
}

class _PosLockScreenState extends ConsumerState<PosLockScreen> {
  final _pinController = TextEditingController();
  String? _selectedUserId;
  String? _error;

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _unlock() async {
    final userId = _selectedUserId;
    if (userId == null) {
      setState(() => _error = 'Select a worker.');
      return;
    }
    final ok = await ref.read(counterWorkerProvider.notifier).activateWithPin(
          userId: userId,
          pin: _pinController.text,
        );
    if (!mounted) return;
    if (ok) {
      setState(() {
        _error = null;
        _pinController.clear();
      });
    } else {
      setState(() => _error = 'Wrong PIN.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final sharedMode = ref.watch(sharedCounterModeProvider);
    final active = ref.watch(counterWorkerProvider);
    if (!sharedMode || active != null) {
      return widget.child;
    }

    final workersAsync = ref.watch(enrolledWorkersProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Counter locked', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('Select worker and enter PIN to continue.', style: TextStyle(color: AppColors.muted)),
              const SizedBox(height: 24),
              workersAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text(e.toString()),
                data: (workers) {
                  if (workers.isEmpty) {
                    return const Text('No workers enrolled. Enable counter mode in Settings.');
                  }
                  return DropdownButtonFormField<String>(
                    decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Worker'),
                    items: workers
                        .map(
                          (w) => DropdownMenuItem<String>(
                            value: w.userId,
                            child: Text(w.displayName),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _selectedUserId = v),
                  );
                },
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _pinController,
                keyboardType: TextInputType.number,
                maxLength: 4,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: '4-digit PIN',
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (_) => _unlock(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: AppColors.error)),
              ],
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _unlock, child: const Text('Unlock')),
            ],
          ),
        ),
      ),
    );
  }
}
