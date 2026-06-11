import '../../core/supabase/supabase_bootstrap.dart';

class StudioWriteRepository {
  final _client = SupabaseBootstrap.client;

  Future<({bool success, String? error})> completeStage(String stageId) async {
    try {
      final raw = await _client.rpc('rpc_complete_stage', params: {'p_stage_id': stageId});
      if (raw is Map) {
        final res = Map<String, dynamic>.from(raw);
        if (res['ok'] == true) {
          return (success: true, error: null);
        }
        return (success: false, error: res['error']?.toString() ?? 'Complete failed.');
      }
      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }
}
