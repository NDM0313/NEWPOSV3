import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/permissions/studio_actions.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/detail_section.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/repositories/studio_read_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/studio_detail_providers.dart';
import '../providers/studio_workers_provider.dart';

class StudioDetailScreen extends ConsumerStatefulWidget {
  const StudioDetailScreen({super.key, required this.saleId});

  final String saleId;

  @override
  ConsumerState<StudioDetailScreen> createState() => _StudioDetailScreenState();
}

class _StudioDetailScreenState extends ConsumerState<StudioDetailScreen> {
  bool _busy = false;
  String? _actionError;
  String? _actionSuccess;

  Future<void> _runAction(Future<({bool success, String? error})> task, String okMsg) async {
    setState(() {
      _busy = true;
      _actionError = null;
      _actionSuccess = null;
    });
    final result = await task;
    if (!mounted) return;
    if (!result.success) {
      setState(() {
        _busy = false;
        _actionError = result.error ?? 'Action failed.';
      });
      return;
    }
    ref.invalidate(studioSaleDetailProvider(widget.saleId));
    setState(() {
      _busy = false;
      _actionSuccess = okMsg;
    });
  }

  Future<void> _assignWorker(StudioStageRow stage) async {
    final workers = await ref.read(studioWorkersProvider.future);
    if (workers.isEmpty) {
      setState(() => _actionError = 'No workers found.');
      return;
    }

    StudioWorkerRow? picked = workers.first;
    final costController = TextEditingController(
      text: picked.rate > 0 ? picked.rate.toString() : '',
    );

    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Assign worker'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<StudioWorkerRow>(
                initialValue: picked,
                items: workers
                    .map((w) => DropdownMenuItem(value: w, child: Text(w.name)))
                    .toList(),
                onChanged: (w) {
                  if (w != null) {
                    picked = w;
                    if (w.rate > 0) costController.text = w.rate.toString();
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: costController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Expected cost'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Assign')),
          ],
        );
      },
    );
    if (ok != true || picked == null) return;

    final cost = double.tryParse(costController.text.trim()) ?? 0;
    if (cost <= 0) {
      setState(() => _actionError = 'Enter expected cost.');
      return;
    }

    final repo = ref.read(studioWriteRepositoryProvider);
    await _runAction(
      repo.assignWorkerToStage(
        stageId: stage.id,
        workerId: picked!.id,
        expectedCost: cost,
      ),
      'Worker assigned.',
    );
  }

  Future<void> _sendToWorker(StudioStageRow stage) async {
    final repo = ref.read(studioWriteRepositoryProvider);
    await _runAction(repo.sendToWorker(stageId: stage.id), 'Sent to worker.');
  }

  Future<void> _receiveWork(StudioStageRow stage) async {
    final repo = ref.read(studioWriteRepositoryProvider);
    await _runAction(repo.receiveWork(stageId: stage.id), 'Work received.');
  }

  Future<void> _confirmPayment(StudioStageRow stage) async {
    final costController = TextEditingController(
      text: stage.cost > 0 ? stage.cost.toString() : '',
    );
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm stage cost'),
        content: TextField(
          controller: costController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Final cost (pay later)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (ok != true) return;
    final cost = double.tryParse(costController.text.trim()) ?? 0;
    if (cost <= 0) {
      setState(() => _actionError = 'Enter final cost.');
      return;
    }
    final repo = ref.read(studioWriteRepositoryProvider);
    await _runAction(
      repo.confirmStagePayment(stageId: stage.id, finalCost: cost, payNow: false),
      'Stage cost confirmed.',
    );
  }

  Future<void> _completeStage(StudioStageRow stage) async {
    final repo = ref.read(studioWriteRepositoryProvider);
    await _runAction(repo.completeStage(stage.id), 'Stage completed.');
  }

  @override
  Widget build(BuildContext context) {
    final asyncDetail = ref.watch(studioSaleDetailProvider(widget.saleId));
    final scope = SessionScope.from(ref.watch(authSessionProvider));
    final canManage = scope != null && canManageStudio(scope.permissions);

    return ModuleScaffold(
      title: 'Studio order',
      actions: [
        IconButton(
          icon: const Icon(Icons.receipt_long_outlined),
          tooltip: 'Sale detail',
          onPressed: () => context.push('/sales/${widget.saleId}'),
        ),
      ],
      body: asyncDetail.when(
        loading: () => const AppLoading(message: 'Loading studio order…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(studioSaleDetailProvider(widget.saleId)),
        ),
        data: (detail) {
          if (detail == null) {
            return const AppEmptyState(
              title: 'Studio order not found',
              subtitle: 'It may have been removed or you lack access.',
            );
          }
          return _StudioBody(
            detail: detail,
            busy: _busy,
            canManage: canManage,
            actionError: _actionError,
            actionSuccess: _actionSuccess,
            onAssign: _assignWorker,
            onSend: _sendToWorker,
            onReceive: _receiveWork,
            onConfirmPayment: _confirmPayment,
            onComplete: _completeStage,
          );
        },
      ),
    );
  }
}

class _StudioBody extends StatelessWidget {
  const _StudioBody({
    required this.detail,
    required this.busy,
    required this.canManage,
    required this.actionError,
    required this.actionSuccess,
    required this.onAssign,
    required this.onSend,
    required this.onReceive,
    required this.onConfirmPayment,
    required this.onComplete,
  });

  final StudioSaleDetail detail;
  final bool busy;
  final bool canManage;
  final String? actionError;
  final String? actionSuccess;
  final Future<void> Function(StudioStageRow stage) onAssign;
  final Future<void> Function(StudioStageRow stage) onSend;
  final Future<void> Function(StudioStageRow stage) onReceive;
  final Future<void> Function(StudioStageRow stage) onConfirmPayment;
  final Future<void> Function(StudioStageRow stage) onComplete;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (actionError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(actionError!, style: const TextStyle(color: AppColors.error)),
          ),
        if (actionSuccess != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(actionSuccess!, style: const TextStyle(color: AppColors.success)),
          ),
        Text(
          detail.documentNo,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        DetailSection(
          children: [
            DetailRow(label: 'Customer', value: detail.customerName),
            DetailRow(label: 'Date', value: detail.date),
            DetailRow(label: 'Status', value: detail.status),
            DetailRow(label: 'Total', value: formatMoney(detail.total)),
          ],
        ),
        if (detail.productions.isEmpty) ...[
          const SizedBox(height: 24),
          const AppEmptyState(
            title: 'No productions',
            subtitle: 'Production rows appear when linked on the server.',
          ),
        ],
        for (final production in detail.productions) ...[
          const SizedBox(height: 16),
          Text(production.productionNo, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          if (production.designName.trim().isNotEmpty)
            Text(production.designName, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          Text('Status: ${production.status}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          const SizedBox(height: 8),
          if (production.stages.isEmpty)
            const Text('No stages yet.', style: TextStyle(color: AppColors.muted, fontSize: 13))
          else
            ...production.stages.map(
              (stage) => _StageTile(
                stage: stage,
                busy: busy,
                canManage: canManage,
                onAssign: () => onAssign(stage),
                onSend: () => onSend(stage),
                onReceive: () => onReceive(stage),
                onConfirmPayment: () => onConfirmPayment(stage),
                onComplete: () => onComplete(stage),
              ),
            ),
        ],
      ],
    );
  }
}

class _StageTile extends StatelessWidget {
  const _StageTile({
    required this.stage,
    required this.busy,
    required this.canManage,
    required this.onAssign,
    required this.onSend,
    required this.onReceive,
    required this.onConfirmPayment,
    required this.onComplete,
  });

  final StudioStageRow stage;
  final bool busy;
  final bool canManage;
  final VoidCallback onAssign;
  final VoidCallback onSend;
  final VoidCallback onReceive;
  final VoidCallback onConfirmPayment;
  final VoidCallback onComplete;

  String get _status => stage.status.toLowerCase();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(stage.stageType, style: const TextStyle(fontWeight: FontWeight.w600))),
              Text(stage.status, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 4),
          Text('Worker: ${stage.workerName}', style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          if (stage.cost > 0)
            Text('Cost ${formatMoney(stage.cost)}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          if (canManage && _status != 'completed') ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (_status == 'pending')
                  OutlinedButton(onPressed: busy ? null : onAssign, child: const Text('Assign')),
                if (_status == 'assigned')
                  OutlinedButton(onPressed: busy ? null : onSend, child: const Text('Send')),
                if (_status == 'sent_to_worker' || _status == 'in-progress' || _status == 'in_progress')
                  OutlinedButton(onPressed: busy ? null : onReceive, child: const Text('Receive')),
                if (_status == 'received')
                  OutlinedButton(onPressed: busy ? null : onConfirmPayment, child: const Text('Confirm cost')),
                if (_status == 'received' || _status == 'in_progress' || _status == 'in-progress')
                  OutlinedButton(onPressed: busy ? null : onComplete, child: const Text('Complete')),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
