import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/sale_document_no.dart';

class StudioStageRow {
  const StudioStageRow({
    required this.id,
    required this.productionId,
    required this.stageType,
    required this.status,
    required this.cost,
    required this.workerName,
    required this.stageOrder,
  });

  final String id;
  final String productionId;
  final String stageType;
  final String status;
  final double cost;
  final String workerName;
  final int stageOrder;
}

class StudioProductionRow {
  const StudioProductionRow({
    required this.id,
    required this.saleId,
    required this.productionNo,
    required this.status,
    required this.designName,
    required this.stages,
  });

  final String id;
  final String saleId;
  final String productionNo;
  final String status;
  final String designName;
  final List<StudioStageRow> stages;
}

class StudioSaleDetail {
  const StudioSaleDetail({
    required this.saleId,
    required this.documentNo,
    required this.customerName,
    required this.total,
    required this.status,
    required this.date,
    required this.productions,
  });

  final String saleId;
  final String documentNo;
  final String customerName;
  final double total;
  final String status;
  final String date;
  final List<StudioProductionRow> productions;
}

class StudioSaleRow {
  const StudioSaleRow({
    required this.id,
    required this.documentNo,
    required this.customerName,
    required this.total,
    required this.paid,
    required this.due,
    required this.status,
    required this.date,
  });

  final String id;
  final String documentNo;
  final String customerName;
  final double total;
  final double paid;
  final double due;
  final String status;
  final String date;
}

class StudioReadRepository {
  final _client = SupabaseBootstrap.client;

  Future<({List<StudioSaleRow> sales, String? error})> getStudioSales({
    required String companyId,
    String? branchId,
    List<String>? accessibleBranchIds,
  }) async {
    try {
      var query = _client
          .from('sales')
          .select(
            'id, invoice_no, order_no, invoice_date, customer_name, total, paid_amount, due_amount, payment_status, status, branch_id, is_studio',
          )
          .eq('company_id', companyId)
          .eq('is_studio', true);

      final branch = safeRpcBranchId(branchId);
      if (branch != null) {
        query = query.eq('branch_id', branch);
      } else if (accessibleBranchIds != null && accessibleBranchIds.isNotEmpty) {
        query = query.inFilter('branch_id', accessibleBranchIds);
      }

      final data = await query
          .order('invoice_date', ascending: false)
          .limit(100);

      final sales = (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        final dateRaw = map['invoice_date']?.toString() ?? '';
        return StudioSaleRow(
          id: map['id'] as String,
          documentNo: readSaleDocumentNo(map),
          customerName: map['customer_name'] as String? ?? '—',
          total: _num(map['total']),
          paid: _num(map['paid_amount']),
          due: _num(map['due_amount']),
          status: map['status'] as String? ?? '—',
          date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
        );
      }).toList();

      return (sales: sales, error: null);
    } catch (e) {
      return (sales: <StudioSaleRow>[], error: e.toString());
    }
  }

  Future<({StudioSaleDetail? detail, String? error})> getStudioSaleDetail({
    required String companyId,
    required String saleId,
  }) async {
    try {
      final saleRow = await _client
          .from('sales')
          .select(
            'id, invoice_no, order_no, invoice_date, customer_name, total, status, is_studio',
          )
          .eq('company_id', companyId)
          .eq('id', saleId)
          .eq('is_studio', true)
          .maybeSingle();

      if (saleRow == null) {
        return (detail: null, error: 'Studio sale not found.');
      }

      final saleMap = Map<String, dynamic>.from(saleRow);
      final dateRaw = saleMap['invoice_date']?.toString() ?? '';

      final prodRows = await _client
          .from('studio_productions')
          .select('id, sale_id, production_no, status, design_name')
          .eq('company_id', companyId)
          .eq('sale_id', saleId)
          .order('created_at', ascending: true);

      final productions = <StudioProductionRow>[];
      for (final row in prodRows as List) {
        final map = Map<String, dynamic>.from(row as Map);
        final productionId = map['id'] as String;
        final stagesRaw = await _client
            .from('studio_production_stages')
            .select('id, production_id, stage_type, status, cost, stage_order, worker:workers(name)')
            .eq('production_id', productionId)
            .order('stage_order', ascending: true);

        final stages = (stagesRaw as List).map((s) {
          final m = Map<String, dynamic>.from(s as Map);
          final worker = m['worker'];
          String workerName = '—';
          if (worker is Map) {
            workerName = worker['name']?.toString() ?? '—';
          }
          return StudioStageRow(
            id: m['id'] as String,
            productionId: productionId,
            stageType: m['stage_type']?.toString() ?? 'stage',
            status: m['status']?.toString() ?? '—',
            cost: _num(m['cost']),
            workerName: workerName,
            stageOrder: (m['stage_order'] as num?)?.toInt() ?? 0,
          );
        }).toList();

        final prodNo = map['production_no']?.toString();
        productions.add(
          StudioProductionRow(
            id: productionId,
            saleId: saleId,
            productionNo: (prodNo != null && prodNo.isNotEmpty)
                ? prodNo
                : 'PRD-${productionId.substring(0, 8)}',
            status: map['status']?.toString() ?? '—',
            designName: map['design_name']?.toString() ?? '—',
            stages: stages,
          ),
        );
      }

      return (
        detail: StudioSaleDetail(
          saleId: saleId,
          documentNo: readSaleDocumentNo(saleMap),
          customerName: saleMap['customer_name'] as String? ?? '—',
          total: _num(saleMap['total']),
          status: saleMap['status'] as String? ?? '—',
          date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
          productions: productions,
        ),
        error: null,
      );
    } catch (e) {
      return (detail: null, error: e.toString());
    }
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
