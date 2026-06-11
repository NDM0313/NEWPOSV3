import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/local_date.dart';
import 'sales_write_repository.dart';

class StudioWriteRepository {
  final _client = SupabaseBootstrap.client;
  final _salesWrite = SalesWriteRepository();

  Future<({bool success, String? error})> assignWorkerToStage({
    required String stageId,
    required String workerId,
    required double expectedCost,
    String? expectedCompletionDate,
    String? notes,
  }) async {
    return _rpcOk(
      'rpc_assign_worker_to_stage',
      {
        'p_stage_id': stageId,
        'p_worker_id': workerId,
        'p_expected_cost': expectedCost,
        'p_expected_completion_date': expectedCompletionDate,
        'p_notes': notes,
      },
    );
  }

  Future<({bool success, String? error})> sendToWorker({
    required String stageId,
    String? notes,
  }) async {
    final params = <String, dynamic>{'p_stage_id': stageId};
    if (notes != null && notes.trim().isNotEmpty) {
      params['p_notes'] = notes.trim();
    }
    params['p_sent_date'] = localTodayIso();
    return _rpcOk('rpc_send_to_worker', params);
  }

  Future<({bool success, String? error})> receiveWork({
    required String stageId,
    String? notes,
  }) async {
    final params = <String, dynamic>{
      'p_stage_id': stageId,
      'p_received_date': localTodayIso(),
    };
    if (notes != null && notes.trim().isNotEmpty) {
      params['p_notes'] = notes.trim();
    }
    return _rpcOk('rpc_receive_work', params);
  }

  Future<({bool success, String? error})> confirmStagePayment({
    required String stageId,
    required double finalCost,
    bool payNow = false,
    String? paymentAccountId,
    String? notes,
  }) async {
    return _rpcOk(
      'rpc_confirm_stage_payment',
      {
        'p_stage_id': stageId,
        'p_final_cost': finalCost,
        'p_pay_now': payNow,
        'p_payment_account_id': payNow ? paymentAccountId : null,
        'p_notes': notes,
      },
    );
  }

  Future<({bool success, String? error})> completeStage(String stageId) async {
    return _rpcOk('rpc_complete_stage', {'p_stage_id': stageId});
  }

  Future<({bool success, String? error})> reopenStage(String stageId) async {
    return _rpcOk('rpc_reopen_stage', {'p_stage_id': stageId});
  }

  /// When invoice line exists and all stages completed, finalize linked sale (GL via server RPC).
  Future<({bool ok, String? error, String? skipped})> tryFinalizeStudioProduction(
    String productionId,
  ) async {
    try {
      final prod = await _client
          .from('studio_productions')
          .select('id, sale_id, generated_invoice_item_id, status')
          .eq('id', productionId)
          .maybeSingle();
      if (prod == null) return (ok: false, error: 'Production not found.', skipped: null);

      final saleId = prod['sale_id']?.toString();
      if (saleId == null || saleId.isEmpty) {
        return (ok: true, error: null, skipped: 'no_sale_id');
      }
      if (prod['generated_invoice_item_id'] == null) {
        return (ok: true, error: null, skipped: 'no_invoice_line');
      }

      final stages = await _client
          .from('studio_production_stages')
          .select('status')
          .eq('production_id', productionId);
      final list = stages as List;
      if (list.isEmpty) return (ok: true, error: null, skipped: 'no_stages');
      final allDone = list.every(
        (s) => (s as Map)['status']?.toString().toLowerCase() == 'completed',
      );
      if (!allDone) return (ok: true, error: null, skipped: 'stages_incomplete');

      final sale = await _client.from('sales').select('status').eq('id', saleId).maybeSingle();
      final status = sale?['status']?.toString().toLowerCase() ?? '';
      if (status == 'final') {
        await _client.from('studio_productions').update({
          'status': 'completed',
          'completed_at': DateTime.now().toIso8601String(),
        }).eq('id', productionId);
        return (ok: true, error: null, skipped: 'already_final');
      }

      final fin = await _salesWrite.finalizeSale(saleId);
      if (!fin.success) {
        return (ok: false, error: fin.error, skipped: null);
      }

      await _client.from('studio_productions').update({
        'status': 'completed',
        'completed_at': DateTime.now().toIso8601String(),
      }).eq('id', productionId);

      return (ok: true, error: null, skipped: null);
    } catch (e) {
      return (ok: false, error: e.toString(), skipped: null);
    }
  }

  Future<({bool success, String? error})> _rpcOk(
    String fn,
    Map<String, dynamic> params,
  ) async {
    try {
      final raw = await _client.rpc(fn, params: params);
      if (raw is Map) {
        final res = Map<String, dynamic>.from(raw);
        if (res['ok'] == true) {
          return (success: true, error: null);
        }
        return (success: false, error: res['error']?.toString() ?? '$fn failed.');
      }
      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }
}
