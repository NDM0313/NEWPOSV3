import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

class ReadOnlyBanner extends StatelessWidget {
  const ReadOnlyBanner({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        message ?? 'View only on mobile — create/edit not available here yet.',
        style: const TextStyle(color: AppColors.muted, fontSize: 12),
        textAlign: TextAlign.center,
      ),
    );
  }
}
