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

  Future<void> _completeStage(StudioStageRow stage) async {
    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null || !canCompleteStudioStage(scope.permissions)) return;

    setState(() {
      _busy = true;
      _actionError = null;
      _actionSuccess = null;
    });

    final repo = ref.read(studioWriteRepositoryProvider);
    final result = await repo.completeStage(stage.id);

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _busy = false;
        _actionError = result.error ?? 'Complete failed.';
      });
      return;
    }

    ref.invalidate(studioSaleDetailProvider(widget.saleId));
    setState(() {
      _busy = false;
      _actionSuccess = 'Stage ${stage.stageType} marked complete.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final asyncDetail = ref.watch(studioSaleDetailProvider(widget.saleId));
    final scope = SessionScope.from(ref.watch(authSessionProvider));
    final canComplete = scope != null && canCompleteStudioStage(scope.permissions);

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
            canComplete: canComplete,
            actionError: _actionError,
            actionSuccess: _actionSuccess,
            onCompleteStage: _completeStage,
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
    required this.canComplete,
    required this.actionError,
    required this.actionSuccess,
    required this.onCompleteStage,
  });

  final StudioSaleDetail detail;
  final bool busy;
  final bool canComplete;
  final String? actionError;
  final String? actionSuccess;
  final Future<void> Function(StudioStageRow stage) onCompleteStage;

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
            subtitle: 'Production rows will appear when the order is linked on the server.',
          ),
        ],
        for (final production in detail.productions) ...[
          const SizedBox(height: 16),
          Text(
            production.productionNo,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
          ),
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
                canComplete: canComplete,
                onComplete: () => onCompleteStage(stage),
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
    required this.canComplete,
    required this.onComplete,
  });

  final StudioStageRow stage;
  final bool busy;
  final bool canComplete;
  final VoidCallback onComplete;

  bool get _canCompleteNow {
    final s = stage.status.toLowerCase();
    return s == 'received' || s == 'in_progress' || s == 'sent_to_worker';
  }

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
              Expanded(
                child: Text(stage.stageType, style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
              Text(stage.status, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 4),
          Text('Worker: ${stage.workerName}', style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          if (stage.cost > 0)
            Text('Cost ${formatMoney(stage.cost)}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          if (canComplete && _canCompleteNow) ...[
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: busy ? null : onComplete,
              child: const Text('Complete stage'),
            ),
          ],
        ],
      ),
    );
  }
}
