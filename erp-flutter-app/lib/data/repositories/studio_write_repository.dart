import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/local_date.dart';

class StudioWriteRepository {
  final _client = SupabaseBootstrap.client;

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
