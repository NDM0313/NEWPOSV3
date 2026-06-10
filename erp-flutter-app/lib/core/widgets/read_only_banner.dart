import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

class ReadOnlyBanner extends StatelessWidget {
  const ReadOnlyBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 16),
      child: Text(
        'Read-only preview — write actions come in a later phase.',
        style: TextStyle(color: AppColors.muted, fontSize: 12),
        textAlign: TextAlign.center,
      ),
    );
  }
}
