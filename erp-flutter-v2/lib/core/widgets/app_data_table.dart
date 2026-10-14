import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

/// MD3-styled scrollable data table for ERP list screens.
class AppDataTable extends StatelessWidget {
  const AppDataTable({
    super.key,
    required this.columns,
    required this.rows,
    this.columnSpacing = 16,
    this.horizontalMargin = 16,
    this.headingRowHeight = 44,
    this.dataRowMinHeight = 48,
  });

  final List<DataColumn> columns;
  final List<DataRow> rows;
  final double columnSpacing;
  final double horizontalMargin;
  final double headingRowHeight;
  final double dataRowMinHeight;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: BoxConstraints(minWidth: constraints.maxWidth),
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.surface),
              dataRowColor: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return AppColors.primary.withValues(alpha: 0.12);
                }
                return AppColors.background;
              }),
              headingTextStyle: const TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
              dataTextStyle: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
              ),
              columnSpacing: columnSpacing,
              horizontalMargin: horizontalMargin,
              headingRowHeight: headingRowHeight,
              dataRowMinHeight: dataRowMinHeight,
              columns: columns,
              rows: rows,
            ),
          ),
        );
      },
    );
  }
}
